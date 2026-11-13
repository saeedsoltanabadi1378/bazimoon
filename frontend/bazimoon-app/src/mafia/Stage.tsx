import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { seatPortrait, tableArt } from "./TableScene";
import "./stage.css";

/** Long enough for the bar to be seen filling, even when the art is already on the phone. */
const MIN_LOADING_MS = 900;
/** A slow or failed image never keeps anyone out of the game. */
const MAX_LOADING_MS = 10_000;

/**
 * The landscape room every in-game Mafia screen is shown in. It loads the room, the table and the
 * seated players' portraits behind a progress bar first, so the table never appears half drawn.
 */
export function MafiaStage({ children }: { children: ReactNode }) {
  const { view } = useGame();
  const { t, n } = useLanguage();
  const seats = view?.players.length ?? 0;
  const urls = useMemo(() => [tableArt.room, tableArt.table, ...Array.from({ length: seats }, (_, i) => seatPortrait(i))].filter((url, i, all) => all.indexOf(url) === i), [seats]);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let count = 0;
    const started = Date.now();
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    const giveUp = window.setTimeout(finish, MAX_LOADING_MS);
    let hold: number | undefined;
    const one = () => {
      if (cancelled) return;
      count++;
      setLoaded(count);
      if (count >= urls.length) hold = window.setTimeout(finish, Math.max(0, MIN_LOADING_MS - (Date.now() - started)));
    };
    for (const url of urls) {
      const image = new Image();
      image.onload = one;
      image.onerror = one;
      image.src = url;
    }
    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      window.clearTimeout(hold);
    };
  }, [urls, ready]);

  useEffect(() => {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (orientation: string) => Promise<void> }) | undefined;
    // Only installed apps and full-screen pages may lock; everywhere else this is refused and the
    // stage is simply drawn sideways (see stage.css).
    orientation?.lock?.("landscape").catch(() => undefined);
    return () => {
      try {
        orientation?.unlock?.();
      } catch {
        // Nothing was locked.
      }
    };
  }, []);

  const percent = Math.round((Math.min(loaded, urls.length) / urls.length) * 100);

  return (
    <div className="mafia-stage">
      <div className="mafia-stage__room" aria-hidden="true" />
      {children}
      {!ready && (
        <div className="stage-loader" role="status">
          <div className="stage-loader__title">{t("stageLoadingTitle")}</div>
          <div className="stage-loader__text">{t("stageLoadingText")}</div>
          <div className="stage-loader__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t("stageLoadingTitle")}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="stage-loader__pct num">{n(percent / 100, { style: "percent" })}</div>
          <div className="stage-loader__turn">
            <span><Icon name="phone" size={20} /></span>
            <span>{t("stageTurnPhone")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
