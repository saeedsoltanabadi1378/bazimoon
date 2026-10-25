import { useCallback, useEffect, useState, type ReactNode } from "react";
import { adminApi } from "./adminApi";
import type { LiveGame, ServiceStatus } from "./adminApi";
import { useAdminI18n, type AdminLang } from "./i18n";

export type AdminPage = "overview" | "games" | "players" | "puzzles" | "activity" | "settings" | "system";

export const NAV: { page: AdminPage; label: "navOverview" | "navGames" | "navPlayers" | "navPuzzles" | "navActivity" | "navSettings" | "navSystem"; icon: string }[] = [
  { page: "overview", label: "navOverview", icon: "M3 11.5 12 4l9 7.5M5 10v10h14V10" },
  { page: "games", label: "navGames", icon: "M12 3a9 9 0 1 0 9 9M12 3v9h9" },
  { page: "players", label: "navPlayers", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8" },
  { page: "puzzles", label: "navPuzzles", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { page: "activity", label: "navActivity", icon: "M3 17h4v4H3zM10 10h4v11h-4zM17 4h4v17h-4z" },
  { page: "settings", label: "navSettings", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" },
  { page: "system", label: "navSystem", icon: "M3 12h4l3-8 4 16 3-8h4" },
];

export function Svg({ d, size = 18, stroke = "currentColor", width = 2 }: { d: string; size?: number; stroke?: string; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  ok: "m5 12 5 5 9-10",
  warn: "M12 8v5M12 17h.01",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  night: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  vote: "M9 12l2 2 4-4M5 4h14v16H5z",
  lobby: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

export function Logo() {
  return (
    <span className="adm-logo" aria-hidden="true">
      <span style={{ background: "#F0A83A" }} />
      <span style={{ background: "#5FD0BE" }} />
      <span style={{ background: "#B79CF2" }} />
      <span style={{ background: "#F2A7C3" }} />
    </span>
  );
}

/** Loads one admin endpoint; reload() refetches. */
export function useAdminData<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setError(null);
    adminApi.get<T>(path).then((d) => alive && setData(d)).catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [path, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload, setData };
}

export function PageState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = useAdminI18n();
  if (!error) return <div className="adm-loading" aria-busy="true">{t("loading")}</div>;
  return (
    <div className="adm-error" role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      <span>{t("loadFailed")} {error}</span>
      <button type="button" className="adm-btn" onClick={onRetry}>{t("retry")}</button>
    </div>
  );
}

export function Header({ kicker, title, children }: { kicker: ReactNode; title: string; children?: ReactNode }) {
  return (
    <header className="adm-head">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="adm-kicker">{kicker}</span>
        <h1 className="adm-title">{title}</h1>
      </div>
      {children && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>{children}</div>}
    </header>
  );
}

export function Search({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange(v: string): void }) {
  return (
    <label className="adm-search">
      <Svg d={ICONS.search} size={16} stroke="#9A9CB8" />
      <span className="sr">{label}</span>
      <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

// ------------------------------------------------------------------ labels

export const PHASE_COLORS: Record<string, [string, string, string]> = {
  Lobby: ["#13302C", "#5FD0BE", ICONS.lobby],
  RoleAssignment: ["#13302C", "#5FD0BE", ICONS.lobby],
  NightZero: ["#1E2138", "#9C8CFF", ICONS.night],
  Night: ["#1E2138", "#9C8CFF", ICONS.night],
  Day: ["#2A2113", "#F0A83A", ICONS.sun],
  Voting: ["#2A1418", "#F08A7A", ICONS.vote],
  Results: ["#2A1418", "#F08A7A", ICONS.vote],
  Defence: ["#2A2113", "#F0A83A", ICONS.sun],
  LastWords: ["#2A1418", "#F08A7A", ICONS.vote],
  Ended: ["#1E2138", "#C9C8DC", ICONS.lobby],
};

export function usePhaseLabel() {
  const { t } = useAdminI18n();
  return (phase: string, round: number) => {
    switch (phase) {
      case "Lobby": return t("phaseLobby");
      case "RoleAssignment": return t("phaseRoleAssignment");
      case "NightZero": return t("phaseNightZero");
      case "Night": return t("phaseNight", { round });
      case "Day": return t("phaseDay", { round });
      case "Voting": return t("phaseVoting");
      case "Results": return t("phaseResults");
      case "Defence": return t("phaseDefence");
      case "LastWords": return t("phaseLastWords");
      default: return t("phaseEnded");
    }
  };
}

export function useLiveDetail() {
  const { t } = useAdminI18n();
  return (g: LiveGame) => {
    switch (g.phase) {
      case "Night":
      case "NightZero": return t("detailNight", { round: Math.max(1, g.round), done: g.nightActionsDone, required: g.nightActionsRequired });
      case "Day": return g.speaker ? t("detailDay", { round: g.round, name: g.speaker }) : t("detailDayNoSpeaker", { round: g.round });
      case "Voting": return t("detailVoting", { cast: g.votesCast, voters: g.voters });
      default: return t("detailLobby", { count: g.seated, max: g.maxPlayers });
    }
  };
}

const ROLES: Record<string, [string, string]> = {
  Godfather: ["Godfather", "پدرخوانده"],
  Mafia: ["Mafia", "مافیا"],
  Detective: ["Detective", "کارآگاه"],
  Doctor: ["Doctor", "دکتر"],
  Villager: ["Villager", "شهروند"],
  Sniper: ["Sniper", "تک‌تیرانداز"],
  DieHard: ["Die Hard", "جان‌سخت"],
  Silencer: ["Silencer", "ناتو"],
  Joker: ["Joker", "جوکر"],
  Mayor: ["Mayor", "شهردار"],
};

export function roleName(role: string | null, lang: AdminLang) {
  if (!role) return null;
  const r = ROLES[role];
  return r ? r[lang === "fa" ? 1 : 0] : role;
}

const GAMES: Record<string, [string, string]> = {
  mafia: ["Mafia", "مافیا"],
  couple: ["Couple Quiz", "کوییز زوج‌ها"],
  sudoku: ["Sudoku", "سودوکو"],
  zip: ["Zip", "زیپ"],
  queens: ["Queens", "ملکه‌ها"],
  merge: ["Merge 2048", "۲۰۴۸"],
  mines: ["Minesweeper", "مین‌روب"],
  memory: ["Memory", "حافظه"],
  nard: ["Takhte Nard", "تخته‌نرد"],
  word: ["Daily Word", "کلمه روز"],
  ladder: ["Word Ladder", "نردبان کلمه"],
  stack: ["Stack Tower", "برج‌سازی"],
  blocks: ["Blocks", "بلوک‌ها"],
  snake: ["Snake", "مار"],
  dooz: ["Dooz", "دوز"],
  spy: ["Spy", "جاسوس"],
  esmfamil: ["Esm-Famil", "اسم فامیل"],
};

export function gameName(game: string | null, lang: AdminLang) {
  if (!game) return "";
  const g = GAMES[game];
  return g ? g[lang === "fa" ? 1 : 0] : game;
}

const DIVISIONS: Record<string, string> = { Bronze: "برنز", Silver: "نقره", Gold: "طلا", Platinum: "پلاتین", Diamond: "الماس" };

export function divisionName(name: string, lang: AdminLang) {
  return lang === "fa" ? DIVISIONS[name] ?? name : name;
}

export const STATUS_STYLE: Record<ServiceStatus["status"], [string, string, string]> = {
  healthy: ["#13302C", "#5FD0BE", ICONS.ok],
  degraded: ["#2A2113", "#F0A83A", ICONS.warn],
  down: ["#2A1418", "#F08A7A", ICONS.warn],
};

export function StatusPill({ status }: { status: ServiceStatus["status"] }) {
  const { t } = useAdminI18n();
  const [bg, fg, icon] = STATUS_STYLE[status];
  return (
    <span className="adm-pill" style={{ background: bg, color: fg }}>
      <Svg d={icon} size={12} width={3} />
      {t(status)}
    </span>
  );
}

export function useServiceText() {
  const { t, n, agoSeconds } = useAdminI18n();
  return (s: ServiceStatus) => {
    switch (s.key) {
      case "api": return t("apiUp");
      case "database":
      case "redis": return s.latencyMs != null ? t("latency", { ms: s.latencyMs }) : t("down");
      case "voice": return s.status === "healthy" ? t("voiceOn") : t("voiceOff");
      case "reminders": return s.secondsAgo != null ? t("remindersRun", { ago: agoSeconds(s.secondsAgo), sent: n(s.sent ?? 0), failed: n(s.failed ?? 0) }) : t("remindersNever");
    }
  };
}

export const LEVEL_STYLE: Record<string, [string, string]> = {
  warning: ["#2A2113", "#F0A83A"],
  audit: ["#1E2138", "#9C8CFF"],
  info: ["#13302C", "#5FD0BE"],
};

export const AVATAR_COLORS = ["#F0A83A", "#5FD0BE", "#B79CF2", "#E5604D", "#8FA8FF", "#E9D8A6", "#F2B8D0", "#9ED98C", "#7FC8E8", "#D9A8E8"];

export const initial = (name: string) => Array.from(name)[0]?.toUpperCase() ?? "?";

export function formatDuration(ms: number, n: (v: number) => string) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${n(m)}:${s < 10 ? n(0) : ""}${n(s)}`;
}
