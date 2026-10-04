using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Automation;
using Microsoft.UI.Xaml.Automation.Peers;
using Microsoft.Web.WebView2.Core;
using Windows.Foundation;
using Windows.Storage;
using WinRT.Interop;

namespace LoKeyTyper;

public sealed partial class MainWindow : Window
{
    private string _webContentPath = "";
    private AppWindow? _appWindow;
    private bool _restoringPlacement;

    [DllImport("user32.dll")]
    private static extern uint GetDpiForWindow(IntPtr hwnd);

    public MainWindow()
    {
        InitializeComponent();
        AutomationProperties.SetLiveSetting(SplashSubtitle, AutomationLiveSetting.Polite);
        AutomationProperties.SetLiveSetting(SplashDetail, AutomationLiveSetting.Polite);
        AutomationProperties.SetLiveSetting(LinkNotice, AutomationLiveSetting.Polite);
        ExtendsContentIntoTitleBar = true;
        _appWindow = ResolveAppWindow();
        RestorePlacement();
        if (_appWindow is not null)
            _appWindow.Changed += OnAppWindowChanged;

        // Initialize WebView2 once the window is ready
        AppWebView.Loaded += OnWebViewLoaded;
    }

    public void BringToFront()
    {
        var appWindow = _appWindow ?? ResolveAppWindow();
        if (appWindow?.Presenter is OverlappedPresenter presenter
            && presenter.State == OverlappedPresenterState.Minimized)
            presenter.Restore();

        appWindow?.Show();
        Activate();
    }

    private async void OnWebViewLoaded(object sender, RoutedEventArgs e)
    {
        AppWebView.Loaded -= OnWebViewLoaded;

        try
        {
            await AppWebView.EnsureCoreWebView2Async();

            // Map a virtual HTTPS host to the bundled WebContent folder.
            // This gives us a secure origin so localStorage, AudioContext,
            // and all web APIs work correctly.
            _webContentPath = Path.Combine(
                AppContext.BaseDirectory, "WebContent");

            AppWebView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "lokey.local",
                _webContentPath,
                CoreWebView2HostResourceAccessKind.Allow);

            // Virtual host mapping does not serve service-worker scripts.
            // Answer every https://lokey.local resource from WebContent.
            AppWebView.CoreWebView2.AddWebResourceRequestedFilter(
                "https://lokey.local/*",
                CoreWebView2WebResourceContext.All);
            AppWebView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;

            // Hide splash only after a successful navigation.
            AppWebView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

            // Only https://lokey.local stays in this WebView. Other http(s) leaves the app.
            AppWebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
            AppWebView.CoreWebView2.NavigationStarting += OnNavigationStarting;
            ApplyQuietBrowser(AppWebView.CoreWebView2.Settings);

            // Navigate to the bundled app
            AppWebView.CoreWebView2.Navigate("https://lokey.local/index.html");
        }
        catch (Exception ex)
        {
            ShowFallbackError(ex);
        }
    }

    private void OnNewWindowRequested(CoreWebView2 sender, CoreWebView2NewWindowRequestedEventArgs args)
    {
        args.Handled = true;
        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri))
            return;

        if (IsLokeyHttps(uri))
        {
            sender.Navigate(args.Uri);
            return;
        }

        if (IsExternalHttp(uri))
            LaunchOutside(uri);
    }

    private void OnNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args)
    {
        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var uri))
            return;

        if (IsLokeyHttps(uri))
            return;

        args.Cancel = true;
        if (uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
            || uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            LaunchOutside(uri);
    }

    private static bool IsLokeyHttps(Uri uri)
    {
        return uri.IsAbsoluteUri
            && uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
            && uri.Host.Equals("lokey.local", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsExternalHttp(Uri uri)
    {
        return uri.IsAbsoluteUri
            && (uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
                || uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            && !uri.Host.Equals("lokey.local", StringComparison.OrdinalIgnoreCase);
    }

    private void LaunchOutside(Uri uri)
    {
        // Starts immediately. The WebView handler must not await this.
        var address = uri.AbsoluteUri;
        var launch = Windows.System.Launcher.LaunchUriAsync(uri);
        launch.Completed = (operation, status) =>
        {
            var opened = false;
            if (status == AsyncStatus.Completed)
            {
                try
                {
                    opened = operation.GetResults();
                }
                catch (Exception)
                {
                    opened = false;
                }
            }

            var notice = WebContentHost.DescribeExternalLaunch(opened, address);
            var message = notice.Message;
            DispatcherQueue.TryEnqueue(() => ShowLinkNotice(message));
        };
    }

    private void ShowLinkNotice(string? message)
    {
        if (string.IsNullOrEmpty(message))
        {
            LinkNotice.Text = "";
            LinkNotice.Visibility = Visibility.Collapsed;
            return;
        }

        LinkNotice.Text = message;
        LinkNotice.Visibility = Visibility.Visible;
    }

    private static void ApplyQuietBrowser(CoreWebView2Settings settings)
    {
        var quiet = WebContentHost.QuietBrowserSettings();
        settings.AreBrowserAcceleratorKeysEnabled = quiet.AcceleratorKeys;
        settings.AreDevToolsEnabled = quiet.DevTools;
        settings.AreDefaultContextMenusEnabled = quiet.DefaultContextMenus;
        settings.IsStatusBarEnabled = quiet.StatusBar;
        settings.IsSwipeNavigationEnabled = quiet.SwipeNavigation;
        settings.IsZoomControlEnabled = quiet.Zoom;
    }

    private void OnWebResourceRequested(CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
    {
        try
        {
            var isDocument = args.ResourceContext == CoreWebView2WebResourceContext.Document;
            var decision = WebContentHost.OnWebResourceRequested(
                _webContentPath, args.Request.Uri, isDocument);
            if (decision.Kind == HostedResourceKind.Ignore)
                return;

            if (decision.Kind != HostedResourceKind.File)
            {
                args.Response = ToResponse(decision);
                return;
            }

            StreamFileOffTheUiThread(args, decision);
        }
        catch (Exception)
        {
            try
            {
                args.Response = ToResponse(WebContentHost.FailurePage());
            }
            catch (Exception)
            {
                // Leave the response unset. Do not escape the event.
            }
        }
    }

    private void StreamFileOffTheUiThread(CoreWebView2WebResourceRequestedEventArgs args, HostedResource decision)
    {
        if (decision.Path is null || !WebContentHost.IsInsideContentRoot(_webContentPath, decision.Path))
        {
            args.Response = ToResponse(WebContentHost.NotFoundPage());
            return;
        }

        var deferral = args.GetDeferral();
        var path = decision.Path;
        var headers = decision.Headers;
        var status = decision.StatusCode;
        var reason = decision.ReasonPhrase;
        var environment = AppWebView.CoreWebView2.Environment;
        var queue = DispatcherQueue;
        var root = _webContentPath;

        // The open happens off this call. The response object is attached on the
        // UI thread, because it belongs to the view. Complete runs after that.
        _ = Task.Run(() =>
        {
            FileStream? file = null;
            try
            {
                file = WebContentHost.OpenInside(root, path);
            }
            catch (Exception)
            {
                file = null;
            }

            var attached = new ManualResetEventSlim(false);
            var posted = queue.TryEnqueue(() =>
            {
                try
                {
                    if (file is null)
                    {
                        args.Response = ToResponse(WebContentHost.NotFoundPage());
                    }
                    else
                    {
                        args.Response = environment.CreateWebResourceResponse(
                            file.AsRandomAccessStream(), status, reason, headers);
                    }
                }
                catch (Exception)
                {
                    try { file?.Dispose(); } catch (Exception) { }
                    try { args.Response = ToResponse(WebContentHost.FailurePage()); } catch (Exception) { }
                }
                finally
                {
                    attached.Set();
                }
            });

            if (!posted)
            {
                try { file?.Dispose(); } catch (Exception) { }
                deferral.Complete();
                return;
            }

            attached.Wait();
            deferral.Complete();
        });
    }

    private CoreWebView2WebResourceResponse ToResponse(HostedResource decision)
    {
        if (decision.Kind == HostedResourceKind.File)
        {
            if (decision.Path is null || !WebContentHost.IsInsideContentRoot(_webContentPath, decision.Path))
                decision = WebContentHost.NotFoundPage();
            else
            {
                var bytes = File.ReadAllBytes(decision.Path);
                return StreamResponse(bytes, decision);
            }
        }

        var body = Encoding.UTF8.GetBytes(decision.HtmlBody ?? "");
        return StreamResponse(body, decision);
    }

    private CoreWebView2WebResourceResponse StreamResponse(byte[] bytes, HostedResource decision)
    {
        var memStream = new MemoryStream(bytes);
        var winStream = memStream.AsRandomAccessStream();
        return AppWebView.CoreWebView2.Environment.CreateWebResourceResponse(
            winStream, decision.StatusCode, decision.ReasonPhrase, decision.Headers);
    }

    private void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        var outcome = WebContentHost.OnNavigationCompleted(
            args.IsSuccess, args.WebErrorStatus.ToString(), args.HttpStatusCode);
        if (outcome.Unsubscribe)
            sender.NavigationCompleted -= OnNavigationCompleted;

        if (outcome.CollapseSplash)
        {
            SplashOverlay.Visibility = Visibility.Collapsed;
            try
            {
                _ = sender.ExecuteScriptAsync(WebContentHost.UnregisterWorkersScript);
            }
            catch (Exception)
            {
                // An old worker is annoying. It is not a failed launch.
            }
            return;
        }

        SplashProgress.IsActive = false;
        SplashSubtitle.Text = outcome.Subtitle ?? WebContentHost.SplashRetryLead;
        SplashDetail.Text = outcome.Detail ?? "";
        SplashDetail.Visibility = string.IsNullOrEmpty(outcome.Detail) ? Visibility.Collapsed : Visibility.Visible;
        SplashRetry.Visibility = Visibility.Visible;
        SplashRetry.Focus(FocusState.Programmatic);
    }

    private void OnSplashRetry(object sender, RoutedEventArgs e)
    {
        if (AppWebView.CoreWebView2 is null)
            return;

        SplashProgress.IsActive = true;
        SplashRetry.Visibility = Visibility.Collapsed;
        SplashDetail.Visibility = Visibility.Collapsed;
        SplashDetail.Text = "";
        SplashSubtitle.Text = "Loading again";
        AppWebView.CoreWebView2.Navigate("https://lokey.local/index.html");
    }

    private void ShowFallbackError(Exception ex)
    {
        var panel = WebContentHost.DescribeLaunchFailure(ex.GetType().Name, ex.Message);
        SplashOverlay.Visibility = Visibility.Collapsed;

        var errorPanel = new Microsoft.UI.Xaml.Controls.StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Spacing = 12
        };

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = panel.Title,
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.White)
        });

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = panel.Guidance,
            FontSize = 14,
            TextWrapping = Microsoft.UI.Xaml.TextWrapping.Wrap,
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.LightGray),
            MaxWidth = 500
        });

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = panel.Detail,
            FontSize = 11,
            IsTextSelectionEnabled = true,
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.Gray),
            TextWrapping = Microsoft.UI.Xaml.TextWrapping.Wrap,
            MaxWidth = 500
        });

        Microsoft.UI.Xaml.Controls.Button? download = null;
        if (panel.PointsAtRuntimeDownload)
        {
            download = new Microsoft.UI.Xaml.Controls.Button
            {
                Content = "Download WebView2 Runtime",
                HorizontalAlignment = HorizontalAlignment.Center
            };
            download.Click += (_, _) =>
            {
                _ = Windows.System.Launcher.LaunchUriAsync(new Uri(WebContentHost.WebView2DownloadPage));
            };
            errorPanel.Children.Add(download);
        }

        RootGrid.Children.Clear();
        RootGrid.Children.Add(errorPanel);
        download?.Focus(FocusState.Programmatic);
    }

    private AppWindow? ResolveAppWindow()
    {
        var hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        return AppWindow.GetFromWindowId(windowId);
    }

    private void RestorePlacement()
    {
        var appWindow = _appWindow;
        if (appWindow is null)
            return;

        var hwnd = WindowNative.GetWindowHandle(this);
        var dpi = GetDpiForWindow(hwnd);
        var scale = dpi == 0 ? 1d : dpi / 96d;
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        var work = DisplayArea.GetFromWindowId(windowId, DisplayAreaFallback.Primary).WorkArea;
        WindowLayout.TryDecode(ReadPlacement(), out var saved);
        var placement = saved.Width > 0
            ? WindowLayout.Clamp(saved, work.X, work.Y, work.Width, work.Height, scale)
            : WindowLayout.First(work.X, work.Y, work.Width, work.Height, scale);

        _restoringPlacement = true;
        try
        {
            appWindow.Move(new Windows.Graphics.PointInt32(placement.X, placement.Y));
            appWindow.Resize(new Windows.Graphics.SizeInt32(placement.Width, placement.Height));
            if (placement.Maximized && appWindow.Presenter is OverlappedPresenter presenter)
                presenter.Maximize();
        }
        finally
        {
            _restoringPlacement = false;
        }
    }

    private void OnAppWindowChanged(AppWindow sender, AppWindowChangedEventArgs args)
    {
        if (_restoringPlacement)
            return;
        if (!args.DidPositionChange && !args.DidSizeChange && !args.DidPresenterChange)
            return;

        var maximized = false;
        if (sender.Presenter is OverlappedPresenter presenter)
        {
            if (presenter.State == OverlappedPresenterState.Minimized)
                return;
            maximized = presenter.State == OverlappedPresenterState.Maximized;
        }

        var position = sender.Position;
        var size = sender.Size;
        if (size.Width < 1 || size.Height < 1)
            return;

        WritePlacement(WindowLayout.Encode(new WindowPlacement(
            position.X, position.Y, size.Width, size.Height, maximized)));
    }

    private static string? ReadPlacement()
    {
        try
        {
            if (ApplicationData.Current.LocalSettings.Values[WindowLayout.SettingsKey] is string saved
                && saved.Length > 0)
                return saved;
        }
        catch (Exception)
        {
            // Unpackaged launch has no package settings.
        }

        try
        {
            var path = PlacementFile();
            return File.Exists(path) ? File.ReadAllText(path) : null;
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void WritePlacement(string text)
    {
        try
        {
            ApplicationData.Current.LocalSettings.Values[WindowLayout.SettingsKey] = text;
            return;
        }
        catch (Exception)
        {
            // Unpackaged launch has no package settings.
        }

        try
        {
            var path = PlacementFile();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, text);
        }
        catch (Exception)
        {
            // A missed save still leaves the window usable.
        }
    }

    private static string PlacementFile()
    {
        var root = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(root, "LoKeyTyper", WindowLayout.SettingsKey + ".txt");
    }
}
