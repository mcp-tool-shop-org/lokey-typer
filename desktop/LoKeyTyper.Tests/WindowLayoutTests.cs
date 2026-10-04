namespace LoKeyTyper.Tests;

public static class WindowLayoutTests
{
    public static void Run()
    {
        FirstSizeFitsTheWorkArea();
        OffScreenPlacementComesBack();
        RoundTripKeepsMaximized();
        GarbageDoesNotRestore();
    }

    private static void FirstSizeFitsTheWorkArea()
    {
        var placed = WindowLayout.First(0, 0, 1920, 1080, 2);
        Check.That(placed.Width <= 1920 && placed.Height <= 1080, "a 2x first size stays on a 1920x1080 work area");
        Check.That(placed.Width >= 1 && placed.Height >= 1, "a first size is positive");
        Check.That(!placed.Maximized, "the first launch is not maximized");
        Check.That(placed.X >= 0 && placed.Y >= 0, "the first launch stays in the work area");

        var wide = WindowLayout.First(10, 20, 2560, 1440, 1);
        Check.That(wide.Width == WindowLayout.PreferredWidthCss, "a large display keeps the preferred width");
        Check.That(wide.X > 10 && wide.Y > 20, "a large display centers the first window");
    }

    private static void OffScreenPlacementComesBack()
    {
        var saved = new WindowPlacement(-4000, 9000, 400, 200, false);
        var placed = WindowLayout.Clamp(saved, 100, 50, 1600, 900, 1);
        Check.That(placed.X >= 100 && placed.Y >= 50, "a saved window off the work area is pulled back");
        Check.That(placed.X + placed.Width <= 1700, "the restored window does not hang off the right");
        Check.That(placed.Y + placed.Height <= 950, "the restored window does not hang off the bottom");
        Check.That(placed.Width >= WindowLayout.MinimumWidthCss, "the restored width stays above the wordmark breakpoint");
        Check.That(placed.Height >= WindowLayout.MinimumHeightCss, "the restored height keeps the minimum");
    }

    private static void RoundTripKeepsMaximized()
    {
        var text = WindowLayout.Encode(new WindowPlacement(12, 34, 1100, 760, true));
        Check.That(WindowLayout.TryDecode(text, out var parsed), "a saved placement parses");
        Check.That(parsed.X == 12 && parsed.Y == 34 && parsed.Width == 1100 && parsed.Height == 760, "a saved placement keeps its numbers");
        Check.That(parsed.Maximized, "a maximized placement stays maximized");
    }

    private static void GarbageDoesNotRestore()
    {
        Check.That(!WindowLayout.TryDecode("nope", out _), "words are not a placement");
        Check.That(!WindowLayout.TryDecode("1,2,0,4,0", out _), "a zero width is not a placement");
        Check.That(!WindowLayout.TryDecode(null, out _), "a missing placement is not restored");
    }
}
