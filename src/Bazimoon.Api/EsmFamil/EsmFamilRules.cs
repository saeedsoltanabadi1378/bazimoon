using System.Text;
using System.Text.RegularExpressions;

namespace Bazimoon.Api.EsmFamil;

/// <summary>Pure Esm-Famil rules shared by online rooms: letters, answer folding and scoring.</summary>
public static partial class EsmFamilRules
{
    public const int MinCategories = 3;
    public const int MaxCategories = 12;
    public const int MaxPlayers = 8;
    public const int StopGraceSeconds = 5;
    public const int JudgingSeconds = 90;
    public const int ScoresSeconds = 10;

    /// <summary>Built-in category keys; anything else must be "custom:&lt;label&gt;".</summary>
    public static readonly IReadOnlySet<string> BuiltInCategories = new HashSet<string>
    {
        "name", "family", "city", "country", "animal", "food", "thing", "color",
        "fruit", "flower", "job", "car", "body", "sport", "celeb", "clothes",
    };

    public static readonly string[] ClassicCategories = ["name", "family", "city", "country", "animal", "food", "thing", "color"];

    public static readonly IReadOnlyDictionary<string, string[]> Letters = new Dictionary<string, string[]>
    {
        ["fa"] = ["ا", "ب", "پ", "ت", "ج", "چ", "ح", "خ", "د", "ر", "ز", "س", "ش", "ع", "ف", "ق", "ک", "گ", "ل", "م", "ن", "و", "ه", "ی"],
        ["en"] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T", "V", "W", "Y"],
    };

    /// <summary>Folds the spellings people treat as the same: case, آ/ا, Arabic ي/ك, ZWNJ, repeated spaces.</summary>
    public static string Normalize(string text)
    {
        var s = (text ?? string.Empty).Trim().ToLowerInvariant();
        var sb = new StringBuilder(s.Length);
        foreach (var ch in s)
        {
            switch (ch)
            {
                case '‌' or '‎' or '‏':
                    continue;
                case >= 'ً' and <= 'ٟ':
                    continue;
                case 'آ' or 'أ' or 'إ':
                    sb.Append('ا');
                    break;
                case 'ي':
                    sb.Append('ی');
                    break;
                case 'ك':
                    sb.Append('ک');
                    break;
                case 'ة':
                    sb.Append('ه');
                    break;
                default:
                    sb.Append(ch);
                    break;
            }
        }
        return Spaces().Replace(sb.ToString(), " ");
    }

    public static bool StartsWithLetter(string answer, string letter)
    {
        var a = Normalize(answer);
        return a.Length > 1 && a.StartsWith(Normalize(letter), StringComparison.Ordinal);
    }

    /// <summary>20 for the only valid answer, 10 for a valid answer nobody else gave, 5 for a shared one, 0 otherwise.</summary>
    public static int[] ScoreCategory(IReadOnlyList<string> answers, IReadOnlyList<bool> valid)
    {
        var keys = answers.Select((a, i) => valid[i] ? Normalize(a) : null).ToArray();
        int validCount = keys.Count(k => k is not null);
        return keys.Select(k =>
        {
            if (k is null) return 0;
            if (validCount == 1) return 20;
            return keys.Count(o => o == k) > 1 ? 5 : 10;
        }).ToArray();
    }

    /// <summary>Validates and tidies a category list: built-ins by key, the rest as "custom:label".</summary>
    public static List<string> CleanCategories(IEnumerable<string>? categories)
    {
        var list = new List<string>();
        foreach (var raw in categories ?? [])
        {
            var c = (raw ?? string.Empty).Trim();
            if (BuiltInCategories.Contains(c)) { if (!list.Contains(c)) list.Add(c); continue; }
            if (c.StartsWith("custom:", StringComparison.Ordinal))
            {
                var label = c["custom:".Length..].Trim();
                if (label.Length is > 0 and <= 20 && !list.Contains("custom:" + label)) list.Add("custom:" + label);
                continue;
            }
            throw new Bazimoon.Domain.GameException("Unknown category.");
        }
        if (list.Count is < MinCategories or > MaxCategories) throw new Bazimoon.Domain.GameException("Pick between 3 and 12 categories.");
        return list;
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();
}
