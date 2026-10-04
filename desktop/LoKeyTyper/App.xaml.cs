using System.Diagnostics;
using Microsoft.UI.Xaml;
using Microsoft.Windows.AppLifecycle;

namespace LoKeyTyper;

public partial class App : Application
{
    private const string InstanceKey = "LoKeyTyper.Main";
    private MainWindow? _window;

    public App()
    {
        InitializeComponent();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        try
        {
            var instance = AppInstance.FindOrRegisterForKey(InstanceKey);
            if (!instance.IsCurrent)
            {
                RedirectAndLeave(instance);
                return;
            }

            instance.Activated += OnInstanceActivated;
        }
        catch (Exception)
        {
            // A launch without the App SDK lifecycle still gets one window.
        }

        _window = new MainWindow();
        _window.Activate();
    }

    private static void RedirectAndLeave(AppInstance first)
    {
        try
        {
            var activated = AppInstance.GetCurrent().GetActivatedEventArgs();
            first.RedirectActivationToAsync(activated).AsTask().GetAwaiter().GetResult();
        }
        catch (Exception)
        {
            // Still do not construct a second WebView.
        }

        Process.GetCurrentProcess().Kill();
    }

    private void OnInstanceActivated(object? sender, AppActivationArguments args)
    {
        var window = _window;
        if (window is null)
            return;

        window.DispatcherQueue.TryEnqueue(window.BringToFront);
    }
}
