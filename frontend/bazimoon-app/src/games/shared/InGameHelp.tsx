import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { readLocal, writeLocal } from "../../lib/storage";
import { IconButton } from "../../ui/components";
import type { IntroStep } from "./IntroScreen";

/** Persistent in-game rules button. It opens automatically the first time a game is played. */
export function InGameHelp({ game, accent, steps, example }: {
  game: string;
  accent: string;
  steps: IntroStep[];
  example?: ReactNode;
}) {
  const { t, n } = useLanguage();
  const storageKey = `bazimoon-help-seen-${game}`;
  const [open, setOpen] = useState(() => !readLocal(storageKey, false));
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    writeLocal(storageKey, true);
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  return (
    <>
      <IconButton icon="info" label={t("howToPlay")} onClick={() => setOpen(true)} />
      {open && (
        <div className="help-sheet" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className="help-sheet__panel" role="dialog" aria-modal="true" aria-labelledby={`${game}-help-title`}>
            <div className="row row--between">
              <h2 id={`${game}-help-title`} className="display" style={{ fontSize: 23 }}>{t("howToPlay")}</h2>
              <IconButton ref={closeRef} icon="close" label={t("close")} onClick={close} />
            </div>
            {example}
            <div className="stack" style={{ gap: 14 }}>
              {steps.map((step, index) => (
                <div key={step.title} className="help-step">
                  <span className="help-step__number" style={{ color: accent }}>{n(index + 1)}</span>
                  <div>
                    <div className="strong">{step.title}</div>
                    <div className="small soft">{step.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="btn" style={{ background: accent, color: "#0B0D1A" }} onClick={close}>
              {t("gotIt")}
            </button>
          </section>
        </div>
      )}
    </>
  );
}
