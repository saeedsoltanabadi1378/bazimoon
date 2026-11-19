// Small pieces shared by the Brick Breaker screens: icons, the coin pill, headers and reward toasts.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { IconButton } from "../../ui/components";
import type { BrickType, PowerKey } from "./engine";
import { takeNotices, useNoticeCount, type Notice } from "./progress";
import { play } from "./audio";

export const ACCENT = "#FF9A62";
export const INK = "#2A1206";
export const GOLD = "#FFD166";
export const LIME = "#B8F24A";

export const POWER_ICON: Record<PowerKey, string> = {
  hlaser: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  vlaser: "M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",
  bomb: "M11 9a6 6 0 1 0 4 1.5M14 7l2.5-2.5M18 2.5v1.5M20 5h1.5",
  double: "M13 2 4 14h7l-1 8 9-12h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
};

export const BRICK_ICON: Record<Exclude<BrickType, "std">, string> = {
  armor: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12h6",
  bomb: "M12 3l1.8 4.6L18.4 6l-1.6 4.6L21 12l-4.2 1.4 1.6 4.6-4.6-1.6L12 21l-1.8-4.6L5.6 18l1.6-4.6L3 12l4.2-1.4L5.6 6l4.6 1.6z",
  hlaser: "M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4",
  vlaser: "M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",
  mystery: "M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.2-1.5 2.4M12 18v.5",
};

export function Svg({ d, size = 22, color = "currentColor", width = 2, style }: { d: string; size?: number; color?: string; width?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
      <path d={d} />
    </svg>
  );
}

export function CoinIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill={GOLD} />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#B8860B" strokeWidth="1.6" />
    </svg>
  );
}

export const STAR_PATH = "M12 3l2.6 5.6 6 .6-4.5 4 1.3 6L12 16.2 6.6 19.2l1.3-6-4.5-4 6-.6z";

export function StarIcon({ size = 14, on }: { size?: number; on: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAR_PATH} fill={on ? GOLD : "#2E3252"} />
    </svg>
  );
}

export function Stars({ count, size = 14, gap = 1 }: { count: number; size?: number; gap?: number }) {
  return (
    <span style={{ display: "inline-flex", gap }} aria-hidden="true">
      {[0, 1, 2].map((i) => <StarIcon key={i} size={size} on={i < count} />)}
    </span>
  );
}

export function CoinPill({ coins, onClick }: { coins: number; onClick?: () => void }) {
  const { t, n } = useLanguage();
  const body = (
    <>
      <CoinIcon />
      <span className="num">{n(coins)}</span>
    </>
  );
  const style: CSSProperties = { display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 12px", borderRadius: 14, background: "#2A2113", color: GOLD, fontWeight: 700, fontSize: 15, border: 0, flex: "none" };
  if (!onClick) return <div style={style} aria-label={t("bricksCoinsAria", { coins: n(coins) })}>{body}</div>;
  return <button type="button" style={{ ...style, cursor: "pointer", fontFamily: "inherit" }} onClick={onClick} aria-label={t("bricksCoinsShopAria", { coins: n(coins) })}>{body}</button>;
}

/** Back button, title and subtitle, with something on the far side (coins, stars). */
export function BricksHeader({ title, sub, onBack, backLabel, right }: { title: ReactNode; sub?: ReactNode; onBack: () => void; backLabel: string; right?: ReactNode }) {
  return (
    <header className="row" style={{ gap: 10, padding: "14px 16px 8px" }}>
      <IconButton icon="back" label={backLabel} onClick={() => { play("button"); onBack(); }} />
      <div className="grow" style={{ minWidth: 0 }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{title}</h1>
        {sub && <div className="tiny muted">{sub}</div>}
      </div>
      {right}
    </header>
  );
}

export function Tabs<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 4, padding: 4, borderRadius: 14, background: "var(--surface)" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="tab" aria-selected={on} onClick={() => { play("button"); onChange(o.value); }}
            style={{ minHeight: 44, borderRadius: 11, border: 0, background: on ? "#EDEBF5" : "transparent", color: on ? "#0B0D1A" : "var(--text-2)", font: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function noticeText(t: (k: TranslationKey, p?: Record<string, string | number>) => string, n: (v: number) => string, notice: Notice): string {
  switch (notice.kind) {
    case "achievement": return t("bricksToastAchievement", { name: t(`bricksAch_${notice.id}` as TranslationKey), coins: n(notice.coins) });
    case "mission": return t("bricksToastMission", { coins: n(notice.coins) });
    case "streak": return notice.item ? t("bricksToastStreakItem", { days: n(notice.days) }) : t("bricksToastStreak", { days: n(notice.days), coins: n(notice.coins) });
    case "world": return t("bricksToastWorld", { world: n(notice.world + 1), coins: n(notice.coins) });
    case "coins": return notice.why === "milestone" ? t("bricksToastMilestone", { coins: n(notice.coins) }) : t("bricksToastMystery", { coins: n(notice.coins) });
  }
}

/** Shows rewards one after another at the top of the screen; never blocks the board. */
export function NoticeToasts({ top = 120, onNotice }: { top?: number; onNotice?: (n: Notice) => void }) {
  const { t, n } = useLanguage();
  const count = useNoticeCount();
  const [queue, setQueue] = useState<Notice[]>([]);
  const [shown, setShown] = useState<Notice | null>(null);
  useEffect(() => {
    if (!count) return;
    const fresh = takeNotices();
    if (fresh.length) {
      setQueue((q) => [...q, ...fresh]);
      fresh.forEach((x) => onNotice?.(x));
    }
  }, [count, onNotice]);
  useEffect(() => {
    if (shown || !queue.length) return;
    const [next, ...rest] = queue;
    setShown(next);
    setQueue(rest);
    play(next.kind === "achievement" || next.kind === "world" ? "achievement" : next.kind === "streak" ? "unlock" : "coin");
  }, [queue, shown]);
  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown(null), 2600);
    return () => window.clearTimeout(id);
  }, [shown]);
  if (!shown) return null;
  return (
    <div role="status" style={{ position: "fixed", insetInline: 16, top, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "#2A2113", color: GOLD, fontSize: 13, fontWeight: 700, boxShadow: "0 6px 18px rgba(0,0,0,0.4)", maxWidth: "100%" }}>
        <CoinIcon size={16} />
        <span>{noticeText(t, n, shown)}</span>
      </div>
    </div>
  );
}
