import { useRef, type CSSProperties } from "react";

export type CardSize = "mini" | "table" | "hand";
const SUITS = {
  C: { label: "clubs", symbol: "♣", red: false },
  D: { label: "diamonds", symbol: "♦", red: true },
  H: { label: "hearts", symbol: "♥", red: true },
  S: { label: "spades", symbol: "♠", red: false },
} as const;

export function PlayingCard({ code, faceDown = false, size = "hand", selected = false, playable = true, onClick, onDrop, style, dropTarget = '.shelem-table' }: {
  code?: string; faceDown?: boolean; size?: CardSize; selected?: boolean; playable?: boolean; onClick?: () => void; onDrop?: () => void; style?: CSSProperties; dropTarget?: string;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean; lift: number } | null>(null);
  const suit = code ? SUITS[code.at(-1) as keyof typeof SUITS] : null;
  const rank = code?.slice(0, -1).replace("T", "10") ?? "";
  const assetRank = ({ A: 'ace', K: 'king', Q: 'queen', J: 'jack' } as Record<string, string>)[rank] ?? rank;
  const label = faceDown || !suit ? "Face-down card" : `${rank} of ${suit.label}`;
  return (
    <button
      type="button" className={`playing-card playing-card--${size}${faceDown ? " is-back" : ""}${selected ? " is-selected" : ""}${playable ? " is-playable" : " is-blocked"}`}
      onPointerDown={(e) => { if (!onClick) return; e.currentTarget.getAnimations().forEach(animation => animation.cancel()); drag.current = { x: e.clientX, y: e.clientY, moved: false, lift:selected ? -18 : 0 }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { const d = drag.current; if (!d) return; const x = e.clientX-d.x, y = e.clientY-d.y; if (Math.hypot(x,y)>8) d.moved=true; if(d.moved) { e.currentTarget.style.transition='none'; e.currentTarget.style.transform=`translate3d(${x}px, ${y+d.lift}px,0) rotate(${Math.max(-12,Math.min(12,x/25))}deg) scale(1.08)`; e.currentTarget.style.zIndex='100'; } }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d) return;
        const card = e.currentTarget;
        const target = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.matches(dropTarget));
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const transform = card.style.transform;
        if (d.moved && target && onClick) {
          if (!reduced) {
            // A temporary visual keeps moving even when the server response removes the hand card.
            const start = card.getBoundingClientRect();
            const landing = target.querySelector('.shelem-trick') ?? target;
            const end = landing.getBoundingClientRect();
            const slot = target.querySelector('.shelem-zamin-slot')?.getBoundingClientRect();
            const x = slot ? slot.left + slot.width / 2 : end.left + end.width / 2;
            const y = slot ? slot.top + slot.height / 2 : end.top + end.height * (landing !== target ? 5 / 6 : .5);
            const ghost = card.cloneNode(true) as HTMLButtonElement;
            ghost.disabled = true;
            ghost.removeAttribute('aria-pressed');
            ghost.setAttribute('aria-hidden', 'true');
            Object.assign(ghost.style, { position:'fixed', left:`${start.left}px`, top:`${start.top}px`, width:`${start.width}px`, height:`${start.height}px`, margin:'0', transform:'none', animation:'none', transition:'none', zIndex:'1000', pointerEvents:'none' });
            document.body.appendChild(ghost);
            const dx = x - start.left - start.width / 2;
            const dy = y - start.top - start.height / 2;
            const flight = ghost.animate([
              { transform:'translate(0,0) scale(1.05)', opacity:1 },
              { transform:`translate(${dx}px,${dy - 5}px) scale(1.02)`, opacity:1, offset:.75 },
              { transform:`translate(${dx}px,${dy}px) scale(1)`, opacity:0 }
            ], { duration:300, easing:'cubic-bezier(.2,.75,.25,1)' });
            void flight.finished.catch(() => {}).finally(() => ghost.remove());
          }
          // Submit immediately: visual motion never delays the network request.
          (onDrop ?? onClick)();
        }
        card.style.transform = '';
        card.style.transition = '';
        card.style.zIndex = String(style?.zIndex ?? '');
        if (d.moved && !target && !reduced) card.animate([{transform}, {transform:selected ? 'translateY(-18px) rotate(-1deg)' : 'translate(0,0) rotate(0deg)'}], {duration:220, easing:'cubic-bezier(.2,.8,.2,1)'});
      }}
      onPointerCancel={(e) => { drag.current=null; e.currentTarget.style.transform=''; e.currentTarget.style.transition=''; e.currentTarget.style.zIndex=String(style?.zIndex ?? ''); }}
      onClick={(e) => { if(!drag.current?.moved) { if (selected && onDrop && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) animateTapPlay(e.currentTarget); onClick?.(); } drag.current=null; }} disabled={!onClick} aria-label={label} aria-pressed={onClick ? selected : undefined} style={{...style, touchAction: onClick ? 'none' : undefined}}
    >
      {faceDown || !suit ? (
        <span className="playing-card__back"><span className="playing-card__moon">✦</span></span>
      ) : (
        <img className="playing-card__face" src={`/images/cards/${assetRank}_of_${suit.label}.svg`} alt="" draggable={false} />
      )}
    </button>
  );
}

function animateTapPlay(card: HTMLButtonElement) {
  const target = card.closest('.screen')?.querySelector('.shelem-trick');
  if (!target) return;
  const start = card.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  const ghost = card.cloneNode(true) as HTMLButtonElement;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.disabled = true;
  Object.assign(ghost.style, {position:'fixed', left:`${start.left}px`, top:`${start.top}px`, width:`${start.width}px`, height:`${start.height}px`, margin:'0', transform:'none', animation:'none', transition:'none', zIndex:'1000', pointerEvents:'none'});
  document.body.appendChild(ghost);
  const x = end.left + end.width / 2 - start.left - start.width / 2;
  const y = end.top + end.height * 5 / 6 - start.top - start.height / 2;
  const animation = ghost.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${x}px,${y}px) scale(.9)`,opacity:1,offset:.85},{transform:`translate(${x}px,${y}px) scale(.9)`,opacity:0}], {duration:320,easing:'cubic-bezier(.2,.75,.25,1)'});
  void animation.finished.catch(()=>{}).finally(()=>ghost.remove());
}

export function CardBackFan({ count, vertical = false }: { count: number; vertical?: boolean }) {
  return <div className={`card-back-fan${vertical ? " card-back-fan--vertical" : ""}`} aria-label={`${count} cards`}>
    {Array.from({ length: Math.min(count, 8) }, (_, i) => <PlayingCard key={i} faceDown size="mini" style={{ zIndex: i }} />)}
  </div>;
}
