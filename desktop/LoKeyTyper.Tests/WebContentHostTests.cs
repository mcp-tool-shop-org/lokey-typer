namespace LoKeyTyper.Tests;

internal static class Check
{
    public static int Failures { get; private set; }

    public static void That(bool condition, string message)
    {
        if (condition)
            return;

        Failures++;
        Console.Error.WriteLine("FAIL " + message);
    }
}

public static class WebContentHostTests
{
    public static void Run()
    {
        var root = Path.Combine(Path.GetTempPath(), "lokey-host-" + Guid.NewGuid().ToString("N"));
        var outside = Path.Combine(Path.GetTempPath(), "lokey-outside-" + Guid.NewGuid().ToString("N") + ".txt");
        try
        {
            Directory.CreateDirectory(root);
            File.WriteAllText(Path.Combine(root, "index.html"), "index");
            File.WriteAllText(Path.Combine(root, "app.js"), "script");
            File.WriteAllText(Path.Combine(root, "sw.js"), "worker");
            File.WriteAllText(outside, "secret");

            PackageFileStaysInside(root);
            ClientRouteServesIndex(root);
            RootedDocumentStaysInside(root, outside);
            RootedSubresourceIsNotFound(root, outside);
            MissingSubresourceIsNotTheSpa(root);
            ServiceWorkerFileStaysInside(root);
            BadUriIs500();
            MissingPagesUseTheDarkShell();
            FailedNavigationRequiresFallback();
            SuccessfulNavigationClearsSplash();
            LaunchTitleFollowsTheException();
        }
        finally
        {
            if (File.Exists(outside))
                File.Delete(outside);
            if (Directory.Exists(root))
                Directory.Delete(root, true);
        }
    }

    private static void PackageFileStaysInside(string root)
    {
        var decision = WebContentHost.OnWebResourceRequested(root, "https://lokey.local/app.js", false);
        Check.That(decision.Kind == HostedResourceKind.File, "package file is served");
        Check.That(decision.Path is not null && WebContentHost.IsInsideContentRoot(root, decision.Path),
            "package file stays inside WebContent");
        Check.That(decision.StatusCode == 200, "package file is 200");
        Check.That(decision.Headers.Contains("javascript", StringComparison.OrdinalIgnoreCase),
            "package script has a script type");
    }

    private static void ClientRouteServesIndex(string root)
    {
        var decision = WebContentHost.OnWebResourceRequested(root, "https://lokey.local/focus", true);
        Check.That(decision.Kind == HostedResourceKind.File, "client route serves a file");
        Check.That(decision.Path is not null
            && decision.Path.EndsWith("index.html", StringComparison.OrdinalIgnoreCase)
            && WebContentHost.IsInsideContentRoot(root, decision.Path),
            "client route stays on index.html inside WebContent");
    }

    private static void RootedDocumentStaysInside(string root, string outside)
    {
        var uri = "https://lokey.local/" + outside.Replace('\\', '/');
        var decision = WebContentHost.OnWebResourceRequested(root, uri, true);
        Check.That(decision.Kind == HostedResourceKind.File, "rooted document falls back to the app");
        Check.That(decision.Path is not null
            && decision.Path.EndsWith("index.html", StringComparison.OrdinalIgnoreCase)
            && WebContentHost.IsInsideContentRoot(root, decision.Path),
            "rooted document stays inside WebContent");
        Check.That(!string.Equals(decision.Path, outside, StringComparison.OrdinalIgnoreCase),
            "rooted document does not read the outside file");
    }

    private static void RootedSubresourceIsNotFound(string root, string outside)
    {
        var uri = "https://lokey.local/" + outside.Replace('\\', '/');
        var decision = WebContentHost.OnWebResourceRequested(root, uri, false);
        Check.That(decision.Kind == HostedResourceKind.NotFound, "escaped subresource is 404");
        Check.That(decision.StatusCode == 404, "escaped subresource status is 404");
        Check.That(decision.Path is null, "escaped subresource does not select a path");
    }

    private static void MissingSubresourceIsNotTheSpa(string root)
    {
        var decision = WebContentHost.OnWebResourceRequested(root, "https://lokey.local/missing.js", false);
        Check.That(decision.Kind == HostedResourceKind.NotFound, "missing script is 404");
        Check.That(decision.Path is null, "missing script is not index.html");
    }

    private static void ServiceWorkerFileStaysInside(string root)
    {
        var decision = WebContentHost.OnWebResourceRequested(root, "https://lokey.local/sw.js", false);
        Check.That(decision.Kind == HostedResourceKind.File, "service worker is served from the package");
        Check.That(decision.Path is not null && WebContentHost.IsInsideContentRoot(root, decision.Path),
            "service worker stays inside WebContent");
    }

    private static void BadUriIs500()
    {
        var decision = WebContentHost.OnWebResourceRequested(Path.GetTempPath(), "not a uri", true);
        Check.That(decision.Kind == HostedResourceKind.Error, "bad uri is an error page");
        Check.That(decision.StatusCode == 500, "bad uri is 500");
        Check.That(!string.IsNullOrEmpty(decision.HtmlBody), "bad uri has a body");
        Check.That(decision.HtmlBody!.Contains("background:#09090b", StringComparison.Ordinal),
            "bad uri page uses the dark shell");
    }

    private static void MissingPagesUseTheDarkShell()
    {
        var missing = WebContentHost.NotFoundPage();
        var failed = WebContentHost.FailurePage();
        Check.That(IsDarkPage(missing.HtmlBody) && missing.HtmlBody!.Contains("Not found.", StringComparison.Ordinal),
            "a missing file is a dark page");
        Check.That(missing.HtmlBody!.Contains("Not found. Reinstall LoKey Typer if this file should be in the package.", StringComparison.Ordinal)
            && missing.HtmlBody.Contains("Reinstall LoKey Typer", StringComparison.Ordinal),
            "a body that is only Not found. fails");
        Check.That(IsDarkPage(failed.HtmlBody) && failed.HtmlBody!.Contains("The page could not be loaded.", StringComparison.Ordinal),
            "a failed load is a dark page");
        Check.That(failed.HtmlBody!.Contains("The page could not be loaded. Try again. If it still fails, reinstall LoKey Typer.", StringComparison.Ordinal)
            && failed.HtmlBody.Contains("Try again.", StringComparison.Ordinal),
            "a failed load says to try again");
    }

    private static bool IsDarkPage(string? html) =>
        html is not null
        && html.Contains("background:#09090b", StringComparison.Ordinal)
        && html.Contains("color:#fafafa", StringComparison.Ordinal);

    private static void FailedNavigationRequiresFallback()
    {
        var outcome = WebContentHost.OnNavigationCompleted(false, "ConnectionAborted", 0);
        Check.That(outcome.FallbackPanelRequired, "failed navigation requires the fallback panel");
        Check.That(!outcome.Unsubscribe, "failed navigation keeps the completion handler");
        Check.That(!outcome.CollapseSplash, "failed navigation leaves the splash up");
        Check.That(outcome.Subtitle == "The page did not load. ConnectionAborted",
            "failed navigation includes WebErrorStatus");

        var missing = WebContentHost.OnNavigationCompleted(true, "Unknown", 404);
        Check.That(missing.FallbackPanelRequired && !missing.Unsubscribe && !missing.CollapseSplash,
            "HTTP 404 requires the fallback panel");
        Check.That(missing.Subtitle == "The page did not load. HTTP 404",
            "HTTP 404 names the status");

        var broken = WebContentHost.OnNavigationCompleted(true, "Unknown", 500);
        Check.That(broken.FallbackPanelRequired && !broken.Unsubscribe && !broken.CollapseSplash,
            "HTTP 500 requires the fallback panel");
        Check.That(broken.Subtitle == "The page did not load. HTTP 500",
            "HTTP 500 names the status");
    }

    private static void SuccessfulNavigationClearsSplash()
    {
        var failed = WebContentHost.OnNavigationCompleted(false, "FileNotFound", 0);
        var succeeded = WebContentHost.OnNavigationCompleted(true, "Unknown", 0);
        var loaded = WebContentHost.OnNavigationCompleted(true, "Unknown", 200);
        Check.That(failed.FallbackPanelRequired && !failed.Unsubscribe, "a failure still listens");
        Check.That(failed.Subtitle == "The page did not load. FileNotFound",
            "a status of 0 keeps the WebErrorStatus subtitle");
        Check.That(succeeded.Unsubscribe && succeeded.CollapseSplash && !succeeded.FallbackPanelRequired,
            "a later success clears the splash");
        Check.That(loaded.Unsubscribe && loaded.CollapseSplash && !loaded.FallbackPanelRequired,
            "HTTP 200 clears the splash");
    }

    private static void LaunchTitleFollowsTheException()
    {
        var missing = WebContentHost.DescribeLaunchFailure(
            "WebView2RuntimeNotFoundException",
            "Couldn't find a compatible WebView2 Runtime installation.");
        Check.That(missing.Title == "WebView2 Runtime Required", "missing runtime keeps the runtime title");
        Check.That(missing.PointsAtRuntimeDownload, "missing runtime points at the download");

        var denied = WebContentHost.DescribeLaunchFailure("UnauthorizedAccessException", "Access is denied.");
        Check.That(denied.Title == "LoKey Typer could not start", "other failures do not say the runtime is required");
        Check.That(!denied.PointsAtRuntimeDownload, "other failures do not send the user to the runtime download");
        Check.That(denied.Guidance == "Access is denied.", "other failures show the real message");

        var folder = WebContentHost.DescribeLaunchFailure(
            "COMException",
            "The WebView2 user data folder could not be created.");
        Check.That(folder.Title == "LoKey Typer could not start", "a user-data failure is not a runtime title");
        Check.That(folder.Guidance.Contains("user data folder", StringComparison.Ordinal),
            "a user-data failure shows its own message");
    }
}
