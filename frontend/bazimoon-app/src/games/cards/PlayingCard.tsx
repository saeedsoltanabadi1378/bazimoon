import { useRef, type CSSProperties } from "react";

export type CardSize = "mini" | "table" | "hand";
const SUITS = {
  C: { label: "clubs", symbol: "♣", red: false },
  D: { label: "diamonds", symbol: "♦", red: true },
  H: { label: "hearts", symbol: "♥", red: true },
  S: { label: "spades", symbol: "♠", red: false },
} as const;

export function PlayingCard({ code, faceDown = false, size = "hand", selected = false, playable = true, onClick, style, dropTarget = '.shelem-table' }: {
  code?: string; faceDown?: boolean; size?: CardSize; selected?: boolean; playable?: boolean; onClick?: () => void; style?: CSSProperties; dropTarget?: string;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suit = code ? SUITS[code.at(-1) as keyof typeof SUITS] : null;
  const rank = code?.slice(0, -1).replace("T", "10") ?? "";
  const assetRank = ({ A: 'ace', K: 'king', Q: 'queen', J: 'jack' } as Record<string, string>)[rank] ?? rank;
  const label = faceDown || !suit ? "Face-down card" : `${rank} of ${suit.label}`;
  return (
    <button
      type="button" className={`playing-card playing-card--${size}${faceDown ? " is-back" : ""}${selected ? " is-selected" : ""}${playable ? " is-playable" : " is-blocked"}`}
      onPointerDown={(e) => { if (!onClick) return; drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; const x = e.clientX-d.x, y = e.clientY-d.y; if (Math.hypot(x,y)>8) d.moved=true; if(d.moved) { e.currentTarget.style.transform=`translate(${x}px, ${y}px) rotate(${x/15}deg)`; e.currentTarget.style.zIndex='100'; } }}
      onPointerUp={(e) => { const d=drag.current; if(!d) return; e.currentTarget.style.transform=''; e.currentTarget.style.zIndex=String(style?.zIndex ?? ''); if(d.moved && document.elementsFromPoint(e.clientX,e.clientY).some(el=>el.matches(dropTarget))) onClick?.(); }}
      onPointerCancel={(e) => { drag.current=null; e.currentTarget.style.transform=''; e.currentTarget.style.zIndex=String(style?.zIndex ?? ''); }}
      onClick={() => { if(!drag.current?.moved) onClick?.(); drag.current=null; }} disabled={!onClick} aria-label={label} aria-pressed={onClick ? selected : undefined} style={{...style, touchAction: onClick ? 'none' : undefined}}
    >
      {faceDown || !suit ? (
        <span className="playing-card__back"><span className="playing-card__moon">✦</span></span>
      ) : (
        <img className="playing-card__face" src={`/images/cards/${assetRank}_of_${suit.label}.svg`} alt="" draggable={false} />
      )}
    </button>
  );
}

export function CardBackFan({ count, vertical = false }: { count: number; vertical?: boolean }) {
  return <div className={`card-back-fan${vertical ? " card-back-fan--vertical" : ""}`} aria-label={`${count} cards`}>
    {Array.from({ length: Math.min(count, 8) }, (_, i) => <PlayingCard key={i} faceDown size="mini" style={{ zIndex: i }} />)}
  </div>;
}
