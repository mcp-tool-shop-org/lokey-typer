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
    string? Subtitle);

public readonly record struct LaunchPanel(
    string Title,
    string Guidance,
    string Detail,
    bool PointsAtRuntimeDownload);

public static class WebContentHost
{
    public const string VirtualHost = "lokey.local";

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

    public static HostedResource NotFoundPage() => new(
        HostedResourceKind.NotFound,
        null,
        404,
        "Not Found",
        "Content-Type: text/html; charset=utf-8",
        "<!doctype html><title>Not found</title><p>Not found.</p>");

    public static HostedResource FailurePage() => new(
        HostedResourceKind.Error,
        null,
        500,
        "Internal Server Error",
        "Content-Type: text/html; charset=utf-8",
        "<!doctype html><title>Error</title><p>The page could not be loaded.</p>");

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

    public static NavigationOutcome OnNavigationCompleted(bool isSuccess, string? webErrorStatus)
    {
        if (isSuccess)
            return new NavigationOutcome(true, true, false, null);

        var status = string.IsNullOrWhiteSpace(webErrorStatus) ? "Unknown" : webErrorStatus.Trim();
        return new NavigationOutcome(
            false,
            false,
            true,
            "The page did not load. " + status);
    }

    public static LaunchPanel DescribeLaunchFailure(string? exceptionTypeName, string? message)
    {
        var typeName = exceptionTypeName ?? "";
        var detail = string.IsNullOrWhiteSpace(message) ? typeName : message.Trim();
        if (IsMissingWebView2Runtime(typeName, detail))
        {
            return new LaunchPanel(
                "WebView2 Runtime Required",
                "Please install the Microsoft Edge WebView2 Runtime from:\nhttps://developer.microsoft.com/en-us/microsoft-edge/webview2/",
                detail,
                true);
        }

        return new LaunchPanel(
            "LoKey Typer could not start",
            detail,
            typeName,
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
