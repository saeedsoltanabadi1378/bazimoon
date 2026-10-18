namespace Bazimoon.Tests;

internal static class TestIds
{
    /// <summary>A readable, stable user id for tests that build records directly: U(990001) is
    /// 00000000-0000-0000-0000-000000990001.</summary>
    public static Guid U(long n) => Guid.Parse($"00000000-0000-0000-0000-{n:D12}");
}
