using System.Runtime.InteropServices.WindowsRuntime;
using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
using Windows.Storage.Streams;
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

            // SPA fallback: intercept requests for paths that don't map to
            // real files (e.g. /focus, /competitive/run/123) and serve
            // index.html so React Router can handle client-side routing.
            AppWebView.CoreWebView2.AddWebResourceRequestedFilter(
                "https://lokey.local/*",
                CoreWebView2WebResourceContext.Document);
            AppWebView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;

            // Hide splash once the page has rendered
            AppWebView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;

            // Suppress new-window requests (open in same view)
            AppWebView.CoreWebView2.NewWindowRequested += (s, args) =>
            {
                args.Handled = true;
                AppWebView.CoreWebView2.Navigate(args.Uri);
            };

            // Navigate to the bundled app
            AppWebView.CoreWebView2.Navigate("https://lokey.local/index.html");
        }
        catch (Exception ex)
        {
            // If WebView2 runtime is missing, show a helpful message
            ShowFallbackError(ex.Message);
        }
    }

    private void OnWebResourceRequested(CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
    {
        // Only handle document navigations on our virtual host
        var uri = new Uri(args.Request.Uri);
        if (!uri.Host.Equals("lokey.local", StringComparison.OrdinalIgnoreCase))
            return;

        // If the path maps to an actual file, let the default handler serve it
        var relativePath = uri.AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var fullPath = Path.Combine(_webContentPath, relativePath);
        if (File.Exists(fullPath))
            return;

        // SPA fallback: serve index.html for any path that doesn't match a file
        var indexPath = Path.Combine(_webContentPath, "index.html");
        if (File.Exists(indexPath))
        {
            var bytes = File.ReadAllBytes(indexPath);
            var memStream = new MemoryStream(bytes);
            var winStream = memStream.AsRandomAccessStream();
            var response = AppWebView.CoreWebView2.Environment.CreateWebResourceResponse(
                winStream, 200, "OK", "Content-Type: text/html; charset=utf-8");
            args.Response = response;
        }
    }

    private void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
    {
        sender.NavigationCompleted -= OnNavigationCompleted;

        // Fade out splash, reveal the web app
        SplashOverlay.Visibility = Visibility.Collapsed;
    }

    private void ShowFallbackError(string detail)
    {
        SplashOverlay.Visibility = Visibility.Collapsed;

        var errorPanel = new Microsoft.UI.Xaml.Controls.StackPanel
        {
            VerticalAlignment = VerticalAlignment.Center,
            HorizontalAlignment = HorizontalAlignment.Center,
            Spacing = 12
        };

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = "WebView2 Runtime Required",
            FontSize = 20,
            FontWeight = Microsoft.UI.Text.FontWeights.SemiBold,
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.White)
        });

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = "Please install the Microsoft Edge WebView2 Runtime from:\nhttps://developer.microsoft.com/en-us/microsoft-edge/webview2/",
            FontSize = 14,
            TextWrapping = Microsoft.UI.Xaml.TextWrapping.Wrap,
            Foreground = new Microsoft.UI.Xaml.Media.SolidColorBrush(
                Microsoft.UI.Colors.LightGray),
            MaxWidth = 500
        });

        errorPanel.Children.Add(new Microsoft.UI.Xaml.Controls.TextBlock
        {
            Text = detail,
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
