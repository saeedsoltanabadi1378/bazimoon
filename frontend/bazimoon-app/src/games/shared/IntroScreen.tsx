import { useState, type ReactNode } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { Body, Screen, Segmented, TopBar } from "../../ui/components";

export interface IntroMode {
  key: string;
  label: ReactNode;
  desc: string;
  play: string;
  onPlay: () => void;
  disabled?: boolean;
}

export interface IntroStep {
  title: string;
  text: string;
}

/** The shared "how to play" screen every solo game opens with (ZipIntro and siblings in the design). */
export function IntroScreen({
  title, tagline, accent, heroBg, preview, badge, heroTitle, heroSub, modeTitle, modes, initialMode = 0,
  stats, steps, rewards, extra, secondary, accentInk = "#0B0D1A",
}: {
  title: string;
  tagline: string;
  accent: string;
  accentInk?: string;
  heroBg: string;
  preview: ReactNode;
  badge?: string;
  heroTitle: string;
  heroSub: string;
  modeTitle?: string;
  modes: IntroMode[];
  initialMode?: number;
  stats: { value: ReactNode; label: string }[];
  steps: IntroStep[];
  rewards?: string[];
  extra?: (mode: string) => ReactNode;
  secondary?: { label: string; onClick: () => void };
}) {
  const { t, n } = useLanguage();
  const { back } = useNavigation();
  const [modeIndex, setModeIndex] = useState(Math.min(initialMode, modes.length - 1));
  const mode = modes[modeIndex];

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToSolo")} title={title} subtitle={tagline} />
      <Body style={{ gap: 18, paddingBottom: 20 }}>
        <section className="row" style={{ gap: 16, padding: 16, borderRadius: 22, background: heroBg }}>
          <div style={{ width: 120, flex: "none" }} aria-hidden="true">{preview}</div>
          <div className="stack stack--sm">
            {badge && (
              <span style={{ alignSelf: "flex-start", padding: "3px 10px", borderRadius: 999, background: "#0B0D1A", color: accent, fontSize: 12, fontWeight: 600 }}>{badge}</span>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{heroTitle}</div>
            <div className="small" style={{ color: "var(--text-2)" }}>{heroSub}</div>
          </div>
        </section>

        {modes.length > 1 && (
          <section className="stack">
            <h2 className="h2">{modeTitle ?? t("mode")}</h2>
            <Segmented
              label={modeTitle ?? t("mode")}
              value={modeIndex}
              onChange={setModeIndex}
              options={modes.map((m, i) => ({ value: i, label: m.label }))}
            />
            <div className="small muted">{mode.desc}</div>
          </section>
        )}
        {modes.length === 1 && <div className="small muted">{mode.desc}</div>}

        {extra?.(mode.key)}

        {stats.length > 0 && (
          <div className="stat-grid stat-grid--4">
            {stats.map((s) => (
              <div key={s.label} className="stat stat--center" style={{ padding: "10px 8px" }}>
                <div className="stat__value" style={{ fontSize: 18 }}>{typeof s.value === "number" ? n(s.value) : s.value}</div>
                <div className="stat__label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <section className="stack stack--lg" style={{ gap: 12 }}>
          <h2 className="h2">{t("howToPlay")}</h2>
          {steps.map((step, i) => (
            <div key={step.title} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: "var(--surface)", color: accent, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {n(i + 1)}
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{step.title}</div>
                <div className="small" style={{ color: "var(--text-2)" }}>{step.text}</div>
              </div>
            </div>
          ))}
        </section>

        {rewards && rewards.length > 0 && (
          <div className="row row--wrap">
            {rewards.map((r) => (
              <span key={r} style={{ padding: "6px 12px", borderRadius: 999, background: "#2A2113", color: "#F0A83A", fontSize: 12, fontWeight: 600 }}>{r}</span>
            ))}
          </div>
        )}
      </Body>

      <div className="screen__bar screen__bar--row" style={{ gap: 8 }}>
        {secondary && (
          <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={secondary.onClick}>{secondary.label}</button>
        )}
        <button
          type="button"
          className="btn"
          style={{ flex: secondary ? 1.4 : 1, background: mode.disabled ? "var(--surface-2)" : accent, color: mode.disabled ? "var(--faint)" : accentInk }}
          disabled={mode.disabled}
          onClick={mode.onPlay}
        >
          {mode.play}
        </button>
      </div>
    </Screen>
  );
}

/** Small square-cell preview grid used in intro heroes. */
export function PreviewGrid({ cols, cells, gap = 3, radius = 4 }: { cols: number; cells: { bg: string; fg?: string; text?: ReactNode }[]; gap?: number; radius?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap }}>
      {cells.map((c, i) => (
        <div key={i} style={{ aspectRatio: "1", borderRadius: radius, background: c.bg, color: c.fg ?? "#0B0D1A", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {c.text}
        </div>
      ))}
    </div>
  );
}
