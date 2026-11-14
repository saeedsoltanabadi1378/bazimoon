import { useLanguage } from "../i18n/LanguageContext";

// Small, fixed previews of each puzzle's board for the Home rail. Decorative: the card carries the name.

const cell = (i: number) => 10 + i * 20;
const zipPath: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4], [3, 3]];
const zipDots: [number, number, boolean][] = [[0, 0, true], [2, 2, true], [0, 4, true], [4, 1, false]];

export function ZipBoard({ size = 122 }: { size?: number }) {
  const { n } = useLanguage();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ fontFamily: "var(--font-display)" }}>
      {Array.from({ length: 25 }, (_, i) => (
        <rect key={i} x={(i % 5) * 20 + 1.5} y={Math.floor(i / 5) * 20 + 1.5} width="17" height="17" rx="3.5" fill="rgb(255 255 255 / 8%)" />
      ))}
      <polyline points={zipPath.map(([x, y]) => `${cell(x)},${cell(y)}`).join(" ")} fill="none" stroke="#5FD0BE" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
      {zipDots.map(([x, y, reached], i) => (
        <g key={i}>
          <circle cx={cell(x)} cy={cell(y)} r="6.5" fill={reached ? "#0F2B28" : "#101218"} stroke={reached ? "#5FD0BE" : "rgb(255 255 255 / 35%)"} strokeWidth="1.5" />
          <text x={cell(x)} y={cell(y) + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={reached ? "#5FD0BE" : "#C5CAD6"}>{n(i + 1)}</text>
        </g>
      ))}
    </svg>
  );
}

const queensRegions = ["AABBB", "ACCBD", "ACEDD", "FCEED", "FFFED"];
const queensColors: Record<string, string> = { A: "#B79CF2", B: "#5FD0BE", C: "#F0A83A", D: "#F08A7A", E: "#8FA8FF", F: "#9ED98C" };
const queensPlaced = new Set(["0,0", "3,1", "1,2"]);

export function QueensBoard({ size = 122 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {queensRegions.flatMap((row, y) => Array.from(row, (region, x) => (
        <g key={`${x},${y}`}>
          <rect x={x * 20 + 1.5} y={y * 20 + 1.5} width="17" height="17" rx="3.5" fill={queensColors[region]} opacity=".78" />
          {queensPlaced.has(`${x},${y}`) && (
            <path transform={`translate(${x * 20 + 4.5} ${y * 20 + 4.5}) scale(.46)`} d="M4 18h16l-2-10-4 4-2-6-2 6-4-4z" fill="#17121F" stroke="#17121F" strokeWidth="2" strokeLinejoin="round" />
          )}
        </g>
      )))}
    </svg>
  );
}

/** The level's own start and goal words, with the steps between left open. */
export function LadderBoard({ start, end }: { start?: string; end?: string }) {
  const { language } = useLanguage();
  const row = (word: string, className?: string) => (
    <span className={className}>
      {Array.from(word, (letter, i) => <b key={i}>{letter.trim()}</b>)}
    </span>
  );
  const blank = " ".repeat(Array.from(start ?? "    ").length);
  return (
    <span className="home-ladder" dir={language === "fa" ? "rtl" : "ltr"} aria-hidden="true">
      {row(start ?? blank, start ? undefined : "is-todo")}
      {row(blank, "is-todo")}
      {row(blank, "is-todo")}
      {row(end ?? blank, end ? "is-goal" : "is-todo")}
    </span>
  );
}

const mergeTiles = [2, 8, 0, 16, 64, 4, 0, 128, 512];
const mergeColors: Record<number, string> = { 2: "#3E3A78", 4: "#4A4590", 8: "#54449E", 16: "#6B5BD0", 64: "#9C8CFF", 128: "#C98A2E", 512: "#F0A83A" };

export function MergeBoard() {
  const { n } = useLanguage();
  return (
    <span className="home-merge" dir="ltr" aria-hidden="true">
      {mergeTiles.map((value, i) => (
        <b key={i} style={value ? { background: mergeColors[value], color: value >= 128 ? "#1A1206" : undefined } : undefined}>{value ? n(value) : ""}</b>
      ))}
    </span>
  );
}
