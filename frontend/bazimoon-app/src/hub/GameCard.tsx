import type { ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";

/** A game's card on Home's rail and the Games tab: its board, a line about where the player is, and a way in. */
export function GameCard({ tint, board, title, meta, tag, solvedToday = 0, action, gold, onPlay }: {
  tint: string;
  board: ReactNode;
  title: string;
  meta: string;
  /** A small label over the board's corner, such as Daily or Endless. */
  tag?: { text: string; bg: string; fg: string };
  solvedToday?: number;
  action: string;
  gold?: boolean;
  onPlay: () => void;
}) {
  const { t } = useLanguage();
  return (
    <button type="button" className="home-card interactive-card" style={{ background: tint }} onClick={onPlay}>
      <span className="home-card__board">
        {board}
        {tag && <span className="tag home-card__tag" style={{ background: tag.bg, color: tag.fg }}>{tag.text}</span>}
      </span>
      <span>
        <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{title}</span>
        <span className="home-card__meta" style={{ display: "block" }}>{meta}</span>
        {solvedToday > 0 && (
          <span className="row tiny" style={{ gap: 4, marginTop: 2, color: "#5FD0BE", fontWeight: 600 }}>
            <Icon name="check" size={12} strokeWidth={3} />
            {t("levelsSolvedToday", { count: solvedToday })}
          </span>
        )}
      </span>
      <span className={`home-btn home-btn--sm ${gold ? "home-btn--gold" : "home-btn--glass"}`} style={{ marginTop: "auto" }}>
        {action}
      </span>
    </button>
  );
}
