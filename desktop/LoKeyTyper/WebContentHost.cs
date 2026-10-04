using System.Security;

namespace LoKeyTyper;

public enum HostedResourceKind
{
    Ignore,
    File,
    NotFound,
    Error
}

public readonly record struct HostedResource(
    HostedResourceKind Kind,
    string? Path,
    int StatusCode,
    string ReasonPhrase,
    string Headers,
    string? HtmlBody)
{
    public static HostedResource Ignore() => new(HostedResourceKind.Ignore, null, 0, "", "", null);
}

public readonly record struct NavigationOutcome(
    bool Unsubscribe,
    bool CollapseSplash,
    bool FallbackPanelRequired,
    string? Subtitle,
    string? Detail);

public readonly record struct LaunchPanel(
    string Title,
    string Guidance,
    string Detail,
    bool PointsAtRuntimeDownload);

public readonly record struct ExternalLaunchNotice(bool StayOnPage, string? Message);

public static class WebContentHost
{
    public const string VirtualHost = "lokey.local";

    /// <summary>
    /// Packaged pages must not keep a service worker. An older precache can
    /// shadow the files in the package. The script file itself stays on disk.
    /// </summary>
    public const string UnregisterWorkersScript =
        "navigator.serviceWorker&&navigator.serviceWorker.getRegistrations().then(function(list){list.forEach(function(registration){registration.unregister()})})";

    public const string SplashRetryLead =
        "Try again reloads LoKey Typer. If it fails again, reinstall the app.";

    public const string WebView2DownloadPage =
        "https://developer.microsoft.com/en-us/microsoft-edge/webview2/";

    public const string RuntimeNextStep =
        "Install the WebView2 Runtime, then reopen LoKey Typer.";

    public const string LaunchNextStep =
        "Reinstall LoKey Typer, or try the launch again.";

    public static string ExternalLinkNotice(string address) =>
        "The link could not be opened. " + address;

    public static ExternalLaunchNotice DescribeExternalLaunch(bool opened, string address) =>
        opened
            ? new ExternalLaunchNotice(true, null)
            : new ExternalLaunchNotice(true, ExternalLinkNotice(address));

    public static QuietBrowser QuietBrowserSettings() => new(
        AcceleratorKeys: false,
        DevTools: false,
        DefaultContextMenus: false,
        StatusBar: false,
        SwipeNavigation: false,
        Zoom: true);

    public static FileStream? OpenInside(string? webContentPath, string? candidatePath)
    {
        if (!IsInsideContentRoot(webContentPath, candidatePath) || candidatePath is null)
            return null;

        return new FileStream(
            candidatePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read,
            4096,
            FileOptions.Asynchronous | FileOptions.SequentialScan);
    }

    public static HostedResource OnWebResourceRequested(string? webContentPath, string? requestUri, bool isDocument)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(requestUri)
                || !Uri.TryCreate(requestUri, UriKind.Absolute, out var uri))
                return FailurePage();

            if (!uri.Host.Equals(VirtualHost, StringComparison.OrdinalIgnoreCase))
                return HostedResource.Ignore();

            if (string.IsNullOrWhiteSpace(webContentPath))
                return FailurePage();

            var root = WithSeparator(Path.GetFullPath(webContentPath));
            var relative = uri.AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var full = Path.GetFullPath(Path.Combine(root, relative));

            // A rooted path exists on disk and must not count as a package file.
            if (IsUnder(root, full) && File.Exists(full))
                return FilePage(full);

            if (isDocument)
            {
                var index = Path.GetFullPath(Path.Combine(root, "index.html"));
                if (IsUnder(root, index) && File.Exists(index))
                    return FilePage(index);
            }

            return NotFoundPage();
        }
        catch (Exception ex) when (IsPathOrIo(ex) || ex is UriFormatException || ex is InvalidOperationException)
        {
            return FailurePage();
        }
    }

    public static HostedResource NotFoundPage() => ErrorDocument(
        HostedResourceKind.NotFound,
        404,
        "Not Found",
        "Not found",
        "Not found. Reinstall LoKey Typer if this file should be in the package.");

    public static HostedResource FailurePage() => ErrorDocument(
        HostedResourceKind.Error,
        500,
        "Internal Server Error",
        "Error",
        "The page could not be loaded. Try again. If it still fails, reinstall LoKey Typer.");

    private static HostedResource ErrorDocument(
        HostedResourceKind kind,
        int statusCode,
        string reasonPhrase,
        string title,
        string message) => new(
        kind,
        null,
        statusCode,
        reasonPhrase,
        "Content-Type: text/html; charset=utf-8",
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + title +
        "</title><style>html,body{margin:0;min-height:100%;background:#09090b;color:#fafafa;font:16px/1.5 'Segoe UI',sans-serif}main{max-width:36rem;margin:4rem auto;padding:0 1.5rem}</style></head><body><main><p>" +
        message + "</p></main></body></html>");

    public static bool IsInsideContentRoot(string? webContentPath, string? candidatePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(webContentPath) || string.IsNullOrWhiteSpace(candidatePath))
                return false;

            var root = WithSeparator(Path.GetFullPath(webContentPath));
            var full = Path.GetFullPath(candidatePath);
            return IsUnder(root, full);
        }
        catch (Exception ex) when (IsPathOrIo(ex))
        {
            return false;
        }
    }

    public static NavigationOutcome OnNavigationCompleted(bool isSuccess, string? webErrorStatus, int httpStatus)
    {
        // WebView2 uses 0 when it has no code. Only 400 and above fails the document.
        if (httpStatus >= 400)
            return FailedNavigation("HTTP " + httpStatus);

        if (isSuccess)
            return new NavigationOutcome(true, true, false, null, null);

        var status = string.IsNullOrWhiteSpace(webErrorStatus) ? "Unknown" : webErrorStatus.Trim();
        return FailedNavigation(status);
    }

    private static NavigationOutcome FailedNavigation(string detail) => new(
        false,
        false,
        true,
        SplashRetryLead,
        detail);

    public static LaunchPanel DescribeLaunchFailure(string? exceptionTypeName, string? message)
    {
        var typeName = exceptionTypeName ?? "";
        var detail = string.IsNullOrWhiteSpace(message) ? typeName : message.Trim();
        if (IsMissingWebView2Runtime(typeName, detail))
        {
            return new LaunchPanel(
                "WebView2 Runtime Required",
                RuntimeNextStep,
                detail,
                true);
        }

        return new LaunchPanel(
            "LoKey Typer could not start",
            LaunchNextStep,
            detail,
            false);
    }

    private static HostedResource FilePage(string fullPath) => new(
        HostedResourceKind.File,
        fullPath,
        200,
        "OK",
        ContentTypeHeader(fullPath),
        null);

    private static bool IsMissingWebView2Runtime(string typeName, string message)
    {
        if (typeName.Contains("WebView2RuntimeNotFound", StringComparison.Ordinal))
            return true;

        if (message.Contains("compatible WebView2 Runtime", StringComparison.OrdinalIgnoreCase))
            return true;

        if (message.Contains("WebView2 Runtime", StringComparison.OrdinalIgnoreCase)
            && (message.Contains("not found", StringComparison.OrdinalIgnoreCase)
                || message.Contains("not installed", StringComparison.OrdinalIgnoreCase)
                || message.Contains("could not find", StringComparison.OrdinalIgnoreCase)
                || message.Contains("couldn't find", StringComparison.OrdinalIgnoreCase)))
            return true;

        return false;
    }

    private static string ContentTypeHeader(string path)
    {
        var type = Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".html" or ".htm" => "text/html; charset=utf-8",
            ".js" or ".mjs" => "application/javascript; charset=utf-8",
            ".css" => "text/css; charset=utf-8",
            ".json" => "application/json; charset=utf-8",
            ".webmanifest" => "application/manifest+json; charset=utf-8",
            ".svg" => "image/svg+xml",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".ico" => "image/x-icon",
            ".wav" => "audio/wav",
            ".mp3" => "audio/mpeg",
            ".txt" or ".md" => "text/plain; charset=utf-8",
            ".woff2" => "font/woff2",
            _ => "application/octet-stream"
        };
        return "Content-Type: " + type;
    }

    private static string WithSeparator(string full)
    {
        full = full.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return full + Path.DirectorySeparatorChar;
    }

    private static bool IsUnder(string rootWithSeparator, string fullPath) =>
        fullPath.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase);

    private static bool IsPathOrIo(Exception ex) =>
        ex is IOException
            or ArgumentException
            or NotSupportedException
            or UnauthorizedAccessException
            or SecurityException;
}
