import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";

// Small, fixed previews of the boards that Home's rail does not show, for the Games tab's cards.
// Decorative like HomeBoards: the card carries the name. All draw on a 100 × 100 view box.

const tile = (i: number, step: number) => i * step + 1.5;

/** Opened ground, a few counts, two flags and the covered tiles still to clear. */
const minesRows = ["01###", "01F##", "0122#", "001F#", "00111"];
const minesInk: Record<string, string> = { 1: "#8FA8FF", 2: "#5FD0BE", 3: "#F08A7A" };

export function MinesBoard({ size = 110 }: { size?: number }) {
  const { n } = useLanguage();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ fontFamily: "var(--font-display)" }}>
      {minesRows.flatMap((row, y) => Array.from(row, (c, x) => {
        const covered = c === "#" || c === "F";
        return (
          <g key={`${x},${y}`}>
            <rect x={tile(x, 20)} y={tile(y, 20)} width="17" height="17" rx="3.5" fill={covered ? "rgb(255 255 255 / 20%)" : "rgb(0 0 0 / 22%)"} />
            {c === "F" && <path transform={`translate(${x * 20 + 6} ${y * 20 + 4.5})`} d="M1.5 1v10M1.5 1.2l7 2.8-7 2.8" fill="#F08A7A" stroke="#F08A7A" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />}
            {/^[1-9]$/.test(c) && <text x={x * 20 + 10} y={y * 20 + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill={minesInk[c]}>{n(Number(c))}</text>}
          </g>
        );
      }))}
    </svg>
  );
}

/** Face-down cards, one matched pair already set aside and two just turned up. */
const memoryCards: ("back" | "star" | "done")[] = ["back", "star", "back", "back", "back", "done", "back", "star", "done", "back", "back", "back"];

export function MemoryBoard({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {memoryCards.map((card, i) => {
        const x = (i % 4) * 26;
        const y = Math.floor(i / 4) * 34;
        return (
          <g key={i} opacity={card === "done" ? 0.4 : 1}>
            <rect x={x + 1} y={y + 1} width="22" height="30" rx="4" fill={card === "back" ? "#2E4170" : "#DCE4FF"} stroke={card === "back" ? "#4A63A3" : "none"} strokeWidth="1.2" />
            {card === "back" && <circle cx={x + 12} cy={y + 16} r="3" fill="none" stroke="#8FA8FF" strokeWidth="1.4" opacity=".7" />}
            {card === "star" && <path transform={`translate(${x + 4} ${y + 8}) scale(.67)`} d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" fill="#F0A83A" />}
            {card === "done" && <circle cx={x + 12} cy={y + 16} r="6" fill="#5FD0BE" />}
          </g>
        );
      })}
    </svg>
  );
}

/** A real, valid sudoku with most cells left open; one cell is selected. */
const sudokuGivens = "530070000600195000098000060800060003400803001700020006060000280000419005000080079".split("").map(Number);
const sudokuPicked = 40;

export function SudokuBoard({ size = 110 }: { size?: number }) {
  const { n } = useLanguage();
  const c = 100 / 9;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ fontFamily: "var(--font-display)" }}>
      <rect x="0.5" y="0.5" width="99" height="99" rx="5" fill="rgb(255 255 255 / 7%)" />
      <rect x={(sudokuPicked % 9) * c} y={Math.floor(sudokuPicked / 9) * c} width={c} height={c} fill="rgb(124 196 250 / 35%)" />
      {Array.from({ length: 8 }, (_, i) => {
        const at = (i + 1) * c;
        const thick = (i + 1) % 3 === 0;
        const style = { stroke: thick ? "rgb(124 196 250 / 70%)" : "rgb(255 255 255 / 12%)", strokeWidth: thick ? 1.4 : 0.6 };
        return (
          <g key={i}>
            <line x1={at} y1="1" x2={at} y2="99" {...style} />
            <line x1="1" y1={at} x2="99" y2={at} {...style} />
          </g>
        );
      })}
      {sudokuGivens.map((digit, i) => digit > 0 && (
        <text key={i} x={(i % 9) * c + c / 2} y={Math.floor(i / 9) * c + c / 2 + 2.7} textAnchor="middle" fontSize="7.6" fontWeight="700" fill="#DCEFFF">{n(digit)}</text>
      ))}
    </svg>
  );
}

/** Two scored guesses and the third being typed, in the player's language. */
const wordRows: Record<"en" | "fa", { letters: string; score: string }[]> = {
  en: [{ letters: "CRANE", score: "02202" }, { letters: "GRAPE", score: "02202" }, { letters: "BRA", score: "" }, { letters: "", score: "" }],
  fa: [{ letters: "ستاره", score: "00012" }, { letters: "برنده", score: "02222" }, { letters: "پر", score: "" }, { letters: "", score: "" }],
};
const wordFill = ["#2B3042", "#F0A83A", "#3FB8A6"];

export function WordBoard() {
  const { language } = useLanguage();
  return (
    <span className="games-word" dir={language === "fa" ? "rtl" : "ltr"} aria-hidden="true" style={language === "fa" ? { fontFamily: "Vazirmatn, sans-serif" } : undefined}>
      {wordRows[language].map((row, y) => {
        const letters = Array.from(row.letters);
        return (
          <span key={y}>
            {Array.from({ length: 5 }, (_, x) => {
              const score = row.score[x];
              return (
                <b key={x} className={score ? undefined : letters[x] ? "is-typed" : "is-empty"} style={score ? { background: wordFill[Number(score)], color: score === "0" ? "#9A9CB8" : "#101218" } : undefined}>
                  {letters[x] ?? ""}
                </b>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

/** A tower of slabs, each a little narrower, with the next one sliding in above. */
const stackSlabs: [number, number][] = [[14, 72], [17, 66], [20, 62], [20, 58], [24, 50]];

export function StackBoard({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {stackSlabs.map(([x, w], i) => {
        const y = 86 - i * 12;
        const shade = 0.45 + i * 0.12;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height="10" rx="2" fill={`rgb(95 208 190 / ${shade})`} />
            <rect x={x} y={y} width={w} height="2.5" rx="1.2" fill="rgb(255 255 255 / 30%)" />
          </g>
        );
      })}
      <rect x="46" y="14" width="50" height="10" rx="2" fill="#F0A83A" />
      <rect x="46" y="14" width="50" height="2.5" rx="1.2" fill="rgb(255 255 255 / 40%)" />
      <path d="M38 17h-8M38 21h-13" stroke="rgb(240 168 58 / 55%)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Two answer cards, one each, with the heart where they meet. */
export function CoupleBoard({ size = 110 }: { size?: number }) {
  const lines = (fill: string) => (
    <>
      <rect x="7" y="9" width="20" height="4" rx="2" fill={fill} />
      <rect x="7" y="19" width="26" height="6" rx="3" fill="rgb(255 255 255 / 14%)" />
      <rect x="7" y="29" width="26" height="6" rx="3" fill={fill} opacity=".85" />
      <rect x="7" y="39" width="26" height="6" rx="3" fill="rgb(255 255 255 / 14%)" />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <g transform="translate(10 22) rotate(-9 20 28)">
        <rect width="40" height="56" rx="7" fill="#3A1D2B" stroke="rgb(242 167 195 / 45%)" strokeWidth="1.2" />
        {lines("#F2A7C3")}
      </g>
      <g transform="translate(50 22) rotate(9 20 28)">
        <rect width="40" height="56" rx="7" fill="#3A1D2B" stroke="rgb(242 167 195 / 45%)" strokeWidth="1.2" />
        {lines("#F2A7C3")}
      </g>
      <circle cx="50" cy="78" r="13" fill="#24121C" />
      <path transform="translate(39.5 67.5) scale(.875)" d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6.3 5.2 5.2 0 0 1 21.3 12C19 16.6 12 21 12 21z" fill="#F2A7C3" />
    </svg>
  );
}

/** The round's letter and a half-filled answer sheet. */
export function EsmFamilBoard() {
  const { language } = useLanguage();
  const letter = language === "fa" ? "م" : "M";
  const filled = [0.9, 0.6, 0.75, 0];
  return (
    <span className="games-sheet" aria-hidden="true">
      <span className="games-sheet__letter" style={language === "fa" ? { fontFamily: "Vazirmatn, sans-serif" } : undefined}>{letter}</span>
      {filled.map((w, i) => (
        <span key={i} className="games-sheet__row">
          <i />
          <b style={{ width: `${w * 100}%`, opacity: w ? 1 : 0 }} />
        </span>
      ))}
    </span>
  );
}

/** A fanned hand from the real card faces Shelem plays with. */
const shelemHand = ["queen_of_hearts", "ace_of_spades", "king_of_diamonds"];

export function ShelemBoard() {
  return (
    <span className="games-fan" dir="ltr" aria-hidden="true">
      {shelemHand.map((card) => <img key={card} src={`/images/cards/${card}.svg`} alt="" draggable={false} />)}
    </span>
  );
}

/** Everyone's card face down except the one that says spy. */
export function SpyBoard() {
  return (
    <span className="games-spy" dir="ltr" aria-hidden="true">
      <b>?</b>
      <b className="is-spy"><Icon name="spy" size={26} /></b>
      <b>?</b>
    </span>
  );
}

/** Three in a row, struck through. */
export function DoozBoard({ size = 110 }: { size?: number }) {
  const marks = ["X", "O", "", "", "X", "O", "O", "", "X"];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M36 8v84M64 8v84M8 36h84M8 64h84" stroke="rgb(255 255 255 / 22%)" strokeWidth="3" strokeLinecap="round" />
      {marks.map((mark, i) => {
        const cx = (i % 3) * 28 + 22;
        const cy = Math.floor(i / 3) * 28 + 22;
        if (mark === "X") return <path key={i} d={`M${cx - 8} ${cy - 8}l16 16M${cx + 8} ${cy - 8}l-16 16`} stroke="#C3B9FF" strokeWidth="5" strokeLinecap="round" />;
        if (mark === "O") return <circle key={i} cx={cx} cy={cy} r="9" fill="none" stroke="#F0A83A" strokeWidth="5" />;
        return null;
      })}
      <path d="M14 14l72 72" stroke="#C3B9FF" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

/** A coiled snake heading for its fruit. */
const snakePath: [number, number][] = [[1, 5], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [4, 3], [3, 3]];

export function SnakeBoard({ size = 110 }: { size?: number }) {
  const at = (i: number) => i * 14 + 8;
  const [hx, hy] = snakePath[snakePath.length - 1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {Array.from({ length: 49 }, (_, i) => <circle key={i} cx={at(i % 7)} cy={at(Math.floor(i / 7))} r="1.3" fill="rgb(255 255 255 / 14%)" />)}
      <polyline points={snakePath.map(([x, y]) => `${at(x)},${at(y)}`).join(" ")} fill="none" stroke="#9ED98C" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={at(hx) - 2} cy={at(hy) - 2.5} r="1.6" fill="#0F1F0B" />
      <circle cx={at(hx) - 2} cy={at(hy) + 2.5} r="1.6" fill="#0F1F0B" />
      <circle cx={at(3)} cy={at(5)} r="5" fill="#F08A7A" />
      <path d={`M${at(3)} ${at(5) - 5}l2-3`} stroke="#9ED98C" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** An 8 × 8 board with one row a block away from clearing. */
const blocksRows = ["........", ".....AA.", "B....AA.", "BB.....C", "DDDDD.DD", "...E...C", "..EEE..C", "FF...GGG"];
const blocksColors: Record<string, string> = { A: "#F2B8D0", B: "#8FA8FF", C: "#5FD0BE", D: "#F0A83A", E: "#B79CF2", F: "#F08A7A", G: "#9ED98C" };

export function BlocksBoard({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {blocksRows.flatMap((row, y) => Array.from(row, (c, x) => (
        <rect key={`${x},${y}`} x={x * 12.5 + 0.8} y={y * 12.5 + 0.8} width="10.9" height="10.9" rx="2.4" fill={c === "." ? "rgb(255 255 255 / 7%)" : blocksColors[c]} />
      )))}
      <rect x={5 * 12.5 + 0.8} y={4 * 12.5 + 0.8} width="10.9" height="10.9" rx="2.4" fill="none" stroke="#F0A83A" strokeWidth="1.2" strokeDasharray="2.5 2" />
    </svg>
  );
}

/** Brick Breaker: numbered bricks, a +1 ring and a fan of balls bouncing up from the launcher. */
const bricksCells: [number, number, string, number][] = [
  [0, 0, "#FFD166", 24], [1, 0, "#FF9A62", 31], [3, 0, "#6E8BFF", 12], [5, 0, "#FF5C7A", 48], [6, 0, "#4FC3F7", 7],
  [0, 1, "#4FC3F7", 6], [2, 1, "#5BD69A", 3], [4, 1, "#FFD166", 21], [6, 1, "#6E8BFF", 14], [1, 2, "#5BD69A", 2], [5, 2, "#4FC3F7", 8],
];

export function BricksBoard({ size = 110 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {bricksCells.map(([x, y, c, v]) => (
        <g key={`${x},${y}`}>
          <rect x={x * 14.2 + 1} y={y * 14.2 + 4} width="12.4" height="12.4" rx="2.6" fill={c} />
          <text x={x * 14.2 + 7.2} y={y * 14.2 + 12.8} textAnchor="middle" fontSize="6.4" fontWeight="800" fill="#0B0D1A">{v}</text>
        </g>
      ))}
      <circle cx={3 * 14.2 + 7.2} cy={2 * 14.2 + 10.2} r="4.4" fill="none" stroke="#B8F24A" strokeWidth="1.6" />
      {[[50, 88], [55, 76], [60, 64], [66, 52]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r="2.4" fill="#FFFFFF" />)}
      <circle cx="44" cy="92" r="2.8" fill="#FFFFFF" />
      <line x1="0" y1="82" x2="100" y2="82" stroke="rgb(255 255 255 / 18%)" strokeWidth="0.8" strokeDasharray="3 2" />
    </svg>
  );
}
