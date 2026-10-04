using System.Runtime.InteropServices.WindowsRuntime;
using System.Text;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
using WinRT.Interop;

namespace LoKeyTyper;

public sealed partial class MainWindow : Window
{
    private string _webContentPath = "";

    public MainWindow()
    {
        InitializeComponent();
        ExtendsContentIntoTitleBar = true;
        SetWindowSize(1200, 800);

        // Initialize WebView2 once the window is ready
        AppWebView.Loaded += OnWebViewLoaded;
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

    private static void LaunchOutside(Uri uri)
    {
        // Starts immediately. The WebView handler must not await this.
        var launch = Windows.System.Launcher.LaunchUriAsync(uri);
        _ = launch.Status;
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

            args.Response = ToResponse(decision);
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
        var outcome = WebContentHost.OnNavigationCompleted(args.IsSuccess, args.WebErrorStatus.ToString());
        if (outcome.Unsubscribe)
            sender.NavigationCompleted -= OnNavigationCompleted;

        if (outcome.CollapseSplash)
        {
            SplashOverlay.Visibility = Visibility.Collapsed;
            return;
        }

        SplashProgress.IsActive = false;
        SplashSubtitle.Text = outcome.Subtitle ?? "The page did not load.";
        SplashRetry.Visibility = Visibility.Visible;
    }

    private void OnSplashRetry(object sender, RoutedEventArgs e)
    {
        if (AppWebView.CoreWebView2 is null)
            return;

        SplashProgress.IsActive = true;
        SplashRetry.Visibility = Visibility.Collapsed;
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
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.Gray),
            TextWrapping = Microsoft.UI.Xaml.TextWrapping.Wrap,
            MaxWidth = 500
        });

        RootGrid.Children.Clear();
        RootGrid.Children.Add(errorPanel);
    }

    private void SetWindowSize(int width, int height)
    {
        var hwnd = WindowNative.GetWindowHandle(this);
        var windowId = Win32Interop.GetWindowIdFromWindow(hwnd);
        var appWindow = AppWindow.GetFromWindowId(windowId);
        appWindow.Resize(new Windows.Graphics.SizeInt32(width, height));
    }
}
