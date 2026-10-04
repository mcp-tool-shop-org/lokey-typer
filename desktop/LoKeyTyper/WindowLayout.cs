using System.Globalization;

namespace LoKeyTyper;

public readonly record struct WindowPlacement(int X, int Y, int Width, int Height, bool Maximized);

public readonly record struct QuietBrowser(
    bool AcceleratorKeys,
    bool DevTools,
    bool DefaultContextMenus,
    bool StatusBar,
    bool SwipeNavigation,
    bool Zoom);

/// <summary>
/// First-launch size is in CSS pixels, then scaled. The wordmark hides below 640 CSS pixels,
/// so the minimum stays above that. Saved placements are clamped back onto the work area.
/// </summary>
public static class WindowLayout
{
    public const int PreferredWidthCss = 1100;
    public const int PreferredHeightCss = 760;
    public const int MinimumWidthCss = 800;
    public const int MinimumHeightCss = 600;
    public const string SettingsKey = "window-placement-v1";

    public static int Physical(int cssPixels, double scale)
    {
        if (double.IsNaN(scale) || scale < 1)
            scale = 1;
        var px = (int)Math.Ceiling(cssPixels * scale);
        return px < 1 ? 1 : px;
    }

    public static WindowPlacement Clamp(
        WindowPlacement desired,
        int workX,
        int workY,
        int workWidth,
        int workHeight,
        double scale)
    {
        var minW = Physical(MinimumWidthCss, scale);
        var minH = Physical(MinimumHeightCss, scale);
        var maxW = workWidth < 1 ? minW : workWidth;
        var maxH = workHeight < 1 ? minH : workHeight;

        var width = desired.Width < 1 ? minW : desired.Width;
        if (width < minW)
            width = minW;
        if (width > maxW)
            width = maxW;

        var height = desired.Height < 1 ? minH : desired.Height;
        if (height < minH)
            height = minH;
        if (height > maxH)
            height = maxH;

        var maxX = workX + Math.Max(0, maxW - width);
        var maxY = workY + Math.Max(0, maxH - height);
        var x = desired.X < workX ? workX : desired.X;
        if (x > maxX)
            x = maxX;
        var y = desired.Y < workY ? workY : desired.Y;
        if (y > maxY)
            y = maxY;

        return new WindowPlacement(x, y, width, height, desired.Maximized);
    }

    public static WindowPlacement First(int workX, int workY, int workWidth, int workHeight, double scale)
    {
        var width = Physical(PreferredWidthCss, scale);
        var height = Physical(PreferredHeightCss, scale);
        var x = workX + Math.Max(0, (workWidth - width) / 2);
        var y = workY + Math.Max(0, (workHeight - height) / 2);
        return Clamp(new WindowPlacement(x, y, width, height, false), workX, workY, workWidth, workHeight, scale);
    }

    public static string Encode(WindowPlacement placement) =>
        string.Create(CultureInfo.InvariantCulture, $"{placement.X},{placement.Y},{placement.Width},{placement.Height},{(placement.Maximized ? 1 : 0)}");

    public static bool TryDecode(string? text, out WindowPlacement placement)
    {
        placement = default;
        if (string.IsNullOrWhiteSpace(text))
            return false;

        var parts = text.Split(',');
        if (parts.Length != 5)
            return false;

        if (!int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out var x)
            || !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var y)
            || !int.TryParse(parts[2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var width)
            || !int.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out var height))
            return false;

        if (width < 1 || height < 1)
            return false;

        placement = new WindowPlacement(x, y, width, height, parts[4] == "1");
        return true;
    }
}
