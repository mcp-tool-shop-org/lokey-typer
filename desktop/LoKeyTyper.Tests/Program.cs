using LoKeyTyper.Tests;

WebContentHostTests.Run();
if (Check.Failures > 0)
{
    Console.Error.WriteLine(Check.Failures + " failed");
    return 1;
}

Console.WriteLine("ok");
return 0;
