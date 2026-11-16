import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";
import { useGame } from "./GameProvider";
import { seatPortrait, tableArt } from "./TableScene";
import { canUseWebGL, TableWorldContext } from "./three/context";
import type { TableWorld } from "./three/world";
import "./stage.css";

/** Long enough for the bar to be seen filling, even when the art is already on the phone. */
const MIN_LOADING_MS = 900;
/** A slow or failed image never keeps anyone out of the game. */
const MAX_LOADING_MS = 10_000;

/**
 * The landscape room every in-game Mafia screen is shown in. It loads the room, the table and the
 * seated players' portraits behind a progress bar first, so the table never appears half drawn.
 * Where the device has WebGL it also loads the 3D table, which every table screen then shares.
 */
export function MafiaStage({ children }: { children: ReactNode }) {
  const { view } = useGame();
  const { t, n } = useLanguage();
  const seats = view?.players.length ?? 0;
  const urls = useMemo(() => [tableArt.room, tableArt.table, ...Array.from({ length: seats }, (_, i) => seatPortrait(i))].filter((url, i, all) => all.indexOf(url) === i), [seats]);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const started = useRef(0);
  const want3d = useMemo(() => canUseWebGL(), []);
  const [world, setWorld] = useState<TableWorld | null>(null);
  const [worldDone, setWorldDone] = useState(!want3d);
  // The art the 3D table needs from the start; later portraits load as players appear.
  const [startArt] = useState(() => [tableArt.table, ...Array.from({ length: seats }, (_, i) => seatPortrait(i))]);

  // The 3D table: its code is only downloaded here, so the rest of the app never carries it.
  useEffect(() => {
    if (!want3d) return;
    let cancelled = false;
    let made: TableWorld | null = null;
    import("./three/world")
      .then(({ TableWorld: World }) => {
        if (cancelled) return;
        made = World.create();
        const created = made;
        if (!created) {
          setWorldDone(true);
          return;
        }
        created.onLost = () => setWorld(null);
        return created.preload(startArt).then(() => {
          if (cancelled) return;
          setWorld(created);
          setWorldDone(true);
        });
      })
      .catch(() => {
        if (!cancelled) setWorldDone(true);
      });
    return () => {
      cancelled = true;
      made?.dispose();
      setWorld(null);
    };
  }, [want3d, startArt]);

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    let count = 0;
    started.current = Date.now();
    const finish = () => {
      if (!cancelled) setReady(true);
    };
    const giveUp = window.setTimeout(finish, MAX_LOADING_MS);
    const one = () => {
      if (cancelled) return;
      count++;
      setLoaded(count);
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
    };
  }, [urls, ready]);

  // In once every image and the 3D table (or the news that there will be none) are ready.
  const allLoaded = loaded >= urls.length && worldDone;
  useEffect(() => {
    if (ready || !allLoaded) return;
    const hold = window.setTimeout(() => setReady(true), Math.max(0, MIN_LOADING_MS - (Date.now() - started.current)));
    return () => window.clearTimeout(hold);
  }, [allLoaded, ready]);

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

  const steps = urls.length + (want3d ? 1 : 0);
  const percent = Math.round(((Math.min(loaded, urls.length) + (want3d && worldDone ? 1 : 0)) / steps) * 100);

  return (
    <div className="mafia-stage">
      <div className="mafia-stage__room" aria-hidden="true" />
      <TableWorldContext.Provider value={world}>{children}</TableWorldContext.Provider>
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
