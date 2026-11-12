import type { ReactNode } from "react";
import type { FunnelStep } from "./adminApi";
import { useAdminI18n, type AdminKey } from "./i18n";
import { gameName } from "./ui";

/** Colours for each tracked flow, shared by the interactions charts, legends and feed tags. */
export const FLOW_COLORS: Record<string, string> = {
  signup: "#F0A83A",
  mafia: "#B79CF2",
  puzzle: "#5FD0BE",
  couple: "#F2A7C3",
  navigation: "#8FA8FF",
  friends: "#9ED98C",
};
export const flowColor = (flow: string) => FLOW_COLORS[flow] ?? "#C9C8DC";

/** A translated label for a key the server sends as a plain string (step_*, flow_*, outcome_* …). Falls back
 * to the raw key when the console has no label for it yet, so a new server value still shows something. */
export function useDynamicLabel() {
  const { t } = useAdminI18n();
  return (prefix: string, key: string) => {
    const full = `${prefix}_${key}`;
    const text = t(full as AdminKey);
    return text === undefined || text === full ? key : text;
  };
}

export function Kpi({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="adm-kpi">
      <span className="small muted">{label}</span>
      <strong>{value}</strong>
      {note != null && <span className="tiny muted">{note}</span>}
    </div>
  );
}

export function Section({ title, sub, actions, flush, children }: { title: string; sub?: ReactNode; actions?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <section className={flush ? "adm-panel flush" : "adm-panel"} aria-label={title}>
      <div className="adm-panel-head" style={flush ? { padding: "16px 18px" } : undefined}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <h2>{title}</h2>
          {sub != null && <span className="small muted">{sub}</span>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }} className="tiny text-2">
      {items.map((i) => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Bars per day: "stack" piles the series up (parts of one total); "group" puts them side by side. */
export function DayBars({ days, series, mode = "group", label }: {
  days: { date: string; values: number[] }[];
  series: { label: string; color: string }[];
  mode?: "stack" | "group";
  label: string;
}) {
  const { n, date } = useAdminI18n();
  const max = Math.max(1, ...days.map((d) => (mode === "stack" ? d.values.reduce((a, b) => a + b, 0) : Math.max(0, ...d.values))));
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Legend items={series} />
      <div className="adm-bars" role="img" aria-label={label} dir="ltr">
        {days.map((d) => (
          <div key={d.date} title={`${date(d.date)} · ${series.map((s, i) => `${s.label} ${n(d.values[i] ?? 0)}`).join(" · ")}`}
            style={mode === "group" ? { flexDirection: "row", alignItems: "flex-end", gap: 1 } : undefined}>
            {series.map((s, i) => {
              const v = d.values[i] ?? 0;
              const style = { height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0, background: s.color, display: "block" } as const;
              return mode === "group"
                ? <span key={s.label} style={{ ...style, flex: 1, borderRadius: "3px 3px 0 0" }} />
                : <span key={s.label} style={{ ...style, borderRadius: i === series.length - 1 ? "3px 3px 0 0" : 0 }} />;
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }} className="tiny muted" dir="ltr">
        <span>{first && date(first)}</span>
        <span>{last && date(last)}</span>
      </div>
    </div>
  );
}

/** One labelled horizontal bar, for share-of-total lists. */
export function Meter({ label, value, max, right, color = "#F0A83A" }: { label: ReactNode; value: number; max: number; right?: ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }} className="small">
        <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
        <span className="num text-2" style={{ whiteSpace: "nowrap" }}>{right}</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#0B0D1A", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${max <= 0 ? 0 : Math.max(value > 0 ? 2 : 0, Math.round((100 * value) / max))}%`, borderRadius: 999, background: color }} />
      </div>
    </div>
  );
}

export function FunnelChart({ steps, stepLabel }: { steps: FunnelStep[]; stepLabel(name: string): string }) {
  const { t, n, lang } = useAdminI18n();
  if (steps.length === 0) return <div className="adm-empty">{t("noActivity")}</div>;
  const max = steps[0]?.users || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
      {steps.map((s, i) => (
        <Meter key={s.name} label={stepLabel(s.name)} value={s.users} max={max} color="#F0A83A"
          right={<>{n(s.users)}<span className="muted"> · {pct(s.pctOfFirst, lang, n)}</span>{i > 0 && <span className="muted"> · {t("ofPrevious", { pct: n(s.pctOfPrevious) })}</span>}</>} />
      ))}
    </div>
  );
}

/** Weekday × hour grid (Saturday first, Tehran hours), darker = busier. */
export function Heatmap({ cells }: { cells: number[] }) {
  const { t, n, lang } = useAdminI18n();
  const max = Math.max(1, ...cells);
  // 2024-01-06 was a Saturday; format the seven days after it for weekday names.
  const weekday = (i: number) => new Date(Date.UTC(2024, 0, 6 + i)).toLocaleDateString(lang === "fa" ? "fa-IR" : "en-GB", { weekday: "short", timeZone: "UTC" });
  return (
    <div className="adm-table-wrap">
      <div className="adm-heat" role="img" aria-label={t("heatmapTitle")}>
        <span />
        {Array.from({ length: 24 }, (_, h) => <span key={h} className="tiny muted num" style={{ textAlign: "center" }}>{h % 3 === 0 ? n(h) : ""}</span>)}
        {Array.from({ length: 7 }, (_, d) => (
          <div key={d} style={{ display: "contents" }}>
            <span className="tiny muted" style={{ whiteSpace: "nowrap" }}>{weekday(d)}</span>
            {Array.from({ length: 24 }, (_, h) => {
              const v = cells[d * 24 + h] ?? 0;
              return <span key={h} className="adm-heat-cell" title={t("heatCell", { day: weekday(d), hour: n(h), count: n(v) })}
                style={{ background: v === 0 ? "#0B0D1A" : `rgba(240, 168, 58, ${0.15 + 0.85 * (v / max)})` }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** "12 s", "3 min 20 s" or "1 h 5 min". */
export function useDwell() {
  const { t, n } = useAdminI18n();
  return (ms: number | null | undefined) => {
    if (ms == null) return t("none");
    const s = Math.round(ms / 1000);
    if (s < 60) return t("durSeconds", { s: n(s) });
    const m = Math.floor(s / 60);
    if (m < 60) return s % 60 === 0 ? t("durMinutesOnly", { m: n(m) }) : t("durMinutes", { m: n(m), s: n(s % 60) });
    return t("durHours", { h: n(Math.floor(m / 60)), m: n(m % 60) });
  };
}

const SCREEN_KEYS = ["intro", "play", "result", "levels", "setup", "lobby", "online", "solo", "home", "invite", "quiz", "reveal"] as const;
const PAGE_KEYS = ["home", "solo", "league", "profile", "friends", "friendLink", "createTable", "mafiaStats", "recap", "mafia_table", "mafia_lobby_list"] as const;

/** A readable name for a tracked screen key such as "game_zip_play", "couple_quiz" or "profile". */
export function useScreenLabel() {
  const { t, lang } = useAdminI18n();
  return (key: string) => {
    const game = /^game_([a-z]+)_([a-zA-Z]+)$/.exec(key);
    if (game) return `${gameName(game[1], lang)} · ${(SCREEN_KEYS as readonly string[]).includes(game[2]) ? t(`screen_${game[2]}` as AdminKey) : game[2]}`;
    const couple = /^couple_([a-zA-Z]+)$/.exec(key);
    if (couple) return `${gameName("couple", lang)} · ${(SCREEN_KEYS as readonly string[]).includes(couple[1]) ? t(`screen_${couple[1]}` as AdminKey) : couple[1]}`;
    if ((PAGE_KEYS as readonly string[]).includes(key)) return t(`page_${key}` as AdminKey);
    return key;
  };
}

export const pct = (v: number | null | undefined, lang: string, n: (x: number) => string) => (v == null ? "—" : `${n(v)}${lang === "fa" ? "٪" : "%"}`);
