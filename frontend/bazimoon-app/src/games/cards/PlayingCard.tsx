import type { CSSProperties } from "react";

export type CardSize = "mini" | "table" | "hand";
const SUITS = {
  C: { label: "clubs", symbol: "♣", red: false },
  D: { label: "diamonds", symbol: "♦", red: true },
  H: { label: "hearts", symbol: "♥", red: true },
  S: { label: "spades", symbol: "♠", red: false },
} as const;

export function PlayingCard({ code, faceDown = false, size = "hand", selected = false, playable = true, onClick, style }: {
  code?: string; faceDown?: boolean; size?: CardSize; selected?: boolean; playable?: boolean; onClick?: () => void; style?: CSSProperties;
}) {
  const suit = code ? SUITS[code.at(-1) as keyof typeof SUITS] : null;
  const rank = code?.slice(0, -1).replace("T", "10") ?? "";
  const label = faceDown || !suit ? "Face-down card" : `${rank} of ${suit.label}`;
  return (
    <button
      type="button" className={`playing-card playing-card--${size}${faceDown ? " is-back" : ""}${selected ? " is-selected" : ""}${playable ? " is-playable" : " is-blocked"}`}
      onClick={onClick} disabled={!onClick} aria-label={label} aria-pressed={onClick ? selected : undefined} style={style}
    >
      {faceDown || !suit ? (
        <span className="playing-card__back"><span className="playing-card__moon">✦</span></span>
      ) : (
        <>
          <span className={`playing-card__corner${suit.red ? " is-red" : ""}`}><b>{rank}</b><i>{suit.symbol}</i></span>
          <span className={`playing-card__pip${suit.red ? " is-red" : ""}`}>{suit.symbol}</span>
          <span className={`playing-card__corner playing-card__corner--bottom${suit.red ? " is-red" : ""}`}><b>{rank}</b><i>{suit.symbol}</i></span>
        </>
      )}
    </button>
  );
}

export function CardBackFan({ count, vertical = false }: { count: number; vertical?: boolean }) {
  return <div className={`card-back-fan${vertical ? " card-back-fan--vertical" : ""}`} aria-label={`${count} cards`}>
    {Array.from({ length: Math.min(count, 8) }, (_, i) => <PlayingCard key={i} faceDown size="mini" style={{ zIndex: i }} />)}
  </div>;
}
