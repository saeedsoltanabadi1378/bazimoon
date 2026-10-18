using Bazimoon.Bot;

namespace Bazimoon.Tests;

public class CommandDispatcherParsingTests
{
    [Theory]
    [InlineData("/newgame", "newgame")]
    [InlineData("/newgame@BazimoonBot", "newgame")]
    [InlineData("/newgame arg1 arg2", "newgame")]
    [InlineData("/newgame@BazimoonBot arg1", "newgame")]
    [InlineData("/StartGame", "startgame")]
    [InlineData("/join\nextra line", "join")]
    public void ParseCommand_ExtractsLowercasedCommandWord(string text, string expected)
    {
        Assert.Equal(expected, CommandDispatcher.ParseCommand(text));
    }

    [Theory]
    [InlineData("hello there")]
    [InlineData("")]
    [InlineData("/")]
    [InlineData("just some text with / in the middle")]
    public void ParseCommand_NonCommandText_ReturnsNull(string text)
    {
        Assert.Null(CommandDispatcher.ParseCommand(text));
    }
}
