import type { ReactNode } from "react";
import type { PuzzleResult } from "../../api/hub";
import { useLanguage } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { Body, IconButton, IconDisc, Screen } from "../../ui/components";
import type { IconName } from "../../ui/Icon";
import { shareToTelegram } from "../../lib/telegram";
import { botLink } from "../../lib/links";

export interface Metric {
  value: ReactNode;
  label: string;
  color?: string;
}

/** The shared end-of-game screen (ZipResult and siblings): hero, metrics, XP, extras, actions. */
export function ResultScreen({
  win, heroIcon, kicker, title, sub, metrics, xp, xpNote, children, share, primary, secondary, accent, accentInk = "#0B0D1A", onClose,
}: {
  win: boolean;
  heroIcon?: IconName;
  kicker: string;
  title: string;
  sub: string;
  metrics: Metric[];
  xp: PuzzleResult | null;
  xpNote?: string;
  children?: ReactNode;
  share?: { text: string };
  primary: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  accent: string;
  accentInk?: string;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const { reset } = useNavigation();
  const heroBg = win ? "#13302C" : "#2A1418";
  const heroFg = win ? "#5FD0BE" : "#F08A7A";

  return (
    <Screen theme="night">
      <div className="row" style={{ justifyContent: "flex-end", padding: "14px 16px 0" }}>
        <IconButton icon="close" label={t("close")} onClick={onClose ?? (() => reset({ name: "home" }))} />
      </div>
      <Body style={{ paddingTop: 0, paddingBottom: 20 }}>
        <section className="stack center" style={{ gap: 8, textAlign: "center" }}>
          <IconDisc icon={heroIcon ?? (win ? "check" : "warning")} size={76} iconSize={36} bg={heroBg} fg={heroFg} strokeWidth={2} />
          <div className="kicker" style={{ color: heroFg }}>{kicker}</div>
          <h1 className="display" style={{ fontSize: 32, lineHeight: 1.05 }}>{title}</h1>
          <p style={{ fontSize: 15, color: "var(--text-2)" }}>{sub}</p>
        </section>

        <div className="stat-grid">
          {metrics.map((m) => (
            <div key={m.label} className="stat stat--center">
              <div className="stat__value" style={{ color: m.color }}>{m.value}</div>
              <div className="stat__label">{m.label}</div>
            </div>
          ))}
        </div>

        {xp ? <XpCard xp={xp} note={xpNote} /> : (
          <div className="card small muted">{t("resultSavedLater")}</div>
        )}

        {children}

        {share && <div className="visually-hidden">{share.text}</div>}
      </Body>

      <div className="screen__bar">
        <div className="row" style={{ gap: 8 }}>
          {share && (
            <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={() => shareToTelegram(botLink(), share.text)}>
              {t("shareToGroup")}
            </button>
          )}
          {secondary && !share && (
            <button type="button" className="btn btn--outline" style={{ flex: 1, fontSize: 15 }} onClick={secondary.onClick}>{secondary.label}</button>
          )}
          <button type="button" className="btn" style={{ flex: 1.3, fontSize: 15, background: accent, color: accentInk }} onClick={primary.onClick}>
            {primary.label}
          </button>
        </div>
        {secondary && share && (
          <button type="button" className="btn btn--ghost" onClick={secondary.onClick}>{secondary.label}</button>
        )}
      </div>
    </Screen>
  );
}

export function XpCard({ xp, note }: { xp: PuzzleResult; note?: string }) {
  const { t, n } = useLanguage();
  const leveledUp = xp.level > xp.levelBefore;
  const base = leveledUp ? 0 : (xp.xpIntoLevelBefore / xp.xpForNext) * 100;
  const gain = leveledUp ? (xp.xpIntoLevel / xp.xpForNext) * 100 : Math.max(1, (xp.xpGained / xp.xpForNext) * 100);
  return (
    <section className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <div className="row row--between row--baseline">
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t("xpGained", { xp: n(xp.xpGained) })}</span>
        <span className="tiny muted">{t("levelProgress", { level: xp.level, xp: n(xp.xpIntoLevel), next: n(xp.xpForNext) })}</span>
      </div>
      <div className="progress progress--8" style={{ background: "#262A44" }} aria-hidden="true">
        <span style={{ width: `${base}%`, background: "#F0A83A", borderRadius: 0 }} />
        <span style={{ width: `${Math.min(100 - base, gain)}%`, background: "#F6C377", borderRadius: 0 }} />
      </div>
      {leveledUp && <div className="small" style={{ color: "#F0A83A", fontWeight: 600 }}>{t("levelUp", { level: xp.level })}</div>}
      {note && <div className="small" style={{ color: "var(--text-2)" }}>{note}</div>}
    </section>
  );
}

/** "Your group today" list: rank, avatar, name, time/score. */
export function GroupBoard({ title, rows, onSeeAll, empty }: {
  title: string;
  rows: { rank: ReactNode; name: string; value: string; isYou: boolean }[];
  onSeeAll?: () => void;
  empty?: string;
}) {
  const { t } = useLanguage();
  const colors = ["#5FD0BE", "#B79CF2", "#F0A83A", "#8FA8FF", "#E9D8A6", "#F08A7A"];
  return (
    <section className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <div className="row row--between">
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} style={{ border: 0, background: "transparent", color: "var(--accent)", fontSize: 13, cursor: "pointer", minHeight: 32 }}>
            {t("seeAll")}
          </button>
        )}
      </div>
      {rows.length === 0 && <div className="small muted">{empty ?? t("boardEmpty")}</div>}
      {rows.map((row, i) => (
        <div key={`${row.name}-${i}`} className="row" style={{ gap: 10, padding: "4px 6px", borderRadius: 10, background: row.isYou ? "#1E2138" : "transparent" }}>
          <span style={{ width: 18, fontSize: 13, color: "var(--muted)" }}>{row.rank}</span>
          <span className="avatar" aria-hidden="true" style={{ width: 28, height: 28, fontSize: 12, background: row.isYou ? "#EDEBF5" : colors[i % colors.length] }}>
            {Array.from(row.name)[0]?.toUpperCase()}
          </span>
          <span className="grow" style={{ fontSize: 14 }}>{row.isYou ? t("youName", { name: row.name }) : row.name}</span>
          <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{row.value}</span>
        </div>
      ))}
    </section>
  );
}
