import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Body, Screen, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { useHub } from "./HubData";
import type { TableRules } from "../api/hub";
import type { Role, RolePreset } from "../api/types";
import { OPTIONAL_ROLES, dealRoles, minimumPlayers, roleMeta, rolesFor } from "../mafia/roles";
import { useRoleName } from "../mafia/parts";
import { haptic } from "../lib/haptics";
import { RolePortrait } from "../mafia/RolePortrait";

const MIN_SEATS = 3;
const MAX_SEATS = 12;

type TimerKey = "speakerSeconds" | "challengeSeconds" | "defenceSeconds" | "lastWordsSeconds" | "nightSeconds" | "votingSeconds";

/** The choices the server accepts for each timer (0 = off: the creator moves that phase on by hand). */
const TIMERS: { key: TimerKey; label: "timerSpeak" | "timerChallenge" | "timerDefence" | "timerLastWords" | "timerNight" | "timerVoting"; choices: number[]; initial: number }[] = [
  { key: "speakerSeconds", label: "timerSpeak", choices: [30, 45, 60, 90], initial: 60 },
  { key: "challengeSeconds", label: "timerChallenge", choices: [20, 30, 40], initial: 40 },
  { key: "defenceSeconds", label: "timerDefence", choices: [20, 30, 45], initial: 30 },
  { key: "lastWordsSeconds", label: "timerLastWords", choices: [10, 20, 30], initial: 20 },
  { key: "nightSeconds", label: "timerNight", choices: [0, 45, 60, 90], initial: 0 },
  { key: "votingSeconds", label: "timerVoting", choices: [0, 30, 45, 60], initial: 0 },
];

/** Open a Mafia table: public (listed for everyone) or private, a name, seats, timers and rules.
 * No group is needed; the host shares the invite link from the lobby. */
export function CreateTableScreen() {
  const { t, n } = useLanguage();
  const { back, replace } = useNavigation();
  const { api } = useHub();
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(10);
  const [timersOpen, setTimersOpen] = useState(true);
  const [timers, setTimers] = useState<Record<TimerKey, number>>(
    () => Object.fromEntries(TIMERS.map((tm) => [tm.key, tm.initial])) as Record<TimerKey, number>,
  );
  const [nightLastWords, setNightLastWords] = useState(false);
  const [preset, setPreset] = useState<RolePreset>("Classic");
  const [mafiaCount, setMafiaCount] = useState(2);
  const [optional, setOptional] = useState<Role[]>(["Detective", "Doctor"]);
  const [innocent, setInnocent] = useState<boolean | null>(null);
  const [jokerEnds, setJokerEnds] = useState(true);
  const [revealRoles, setRevealRoles] = useState(true);
  // Follows public/private until the creator flips it.
  const [spectators, setSpectators] = useState<boolean | null>(null);
  const spectatorsOn = spectators ?? isOpen;
  const roleName = useRoleName();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function create() {
    setBusy(true);
    setFailed(false);
    try {
      const rules: TableRules = {
        ...timers, lastWordsForNightKills: nightLastWords, preset, mafiaCount, optionalRoles: optional,
        godfatherAppearsInnocent: innocent ?? preset === "Iranian", jokerWinEndsGame: jokerEnds, revealRolesOnDeath: revealRoles, allowSpectators: spectatorsOn,
      };
      const { gameId } = await api.createTable({ name: name.trim() || null, isOpen, seats, rules });
      haptic.success();
      replace({ name: "mafia", gameId });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const options = [
    { open: true, title: t("publicTable"), desc: t("publicTableDesc"), icon: "globe" as const, bg: "#13302C", fg: "#5FD0BE" },
    { open: false, title: t("privateTable"), desc: t("privateTableDesc"), icon: "lock" as const, bg: "#1E2138", fg: "#B79CF2" },
  ];
  // The setup shown for a full table; the lobby shows it again for the players who actually join.
  const dealt = dealRoles(preset, mafiaCount, optional, seats);
  const minPlayers = minimumPlayers(preset, mafiaCount, optional);
  const fits = dealt !== null && minPlayers <= seats;
  const chips = rolesFor(seats, dealt);
  const innocentOn = innocent ?? preset === "Iranian";
  const toggle = (on: boolean, label: string, flip: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={flip}
      style={{ width: 52, height: 30, flex: "none", padding: 3, borderRadius: 999, border: 0, background: on ? "#9C8CFF" : "#3A3F5E", display: "flex", justifyContent: on ? "flex-end" : "flex-start", cursor: "pointer" }}
    >
      <span style={{ width: 24, height: 24, borderRadius: 999, background: "#EDEBF5" }} />
    </button>
  );
  const teamShort = (r: Role) => (roleMeta[r].team === "mafia" ? t("teamMafiaShort") : roleMeta[r].team === "independent" ? t("teamOwnShort") : t("teamTownShort"));
  const sec = (v: number) => (v === 0 ? t("timerOff") : t("secondsShort", { count: v }));
  const selected = (on: boolean) => ({ border: `2px solid ${on ? "#9C8CFF" : "#262A44"}`, background: on ? "#1A1836" : "var(--surface)" });

  return (
    <Screen theme="night">
      <TopBar onBack={back} backLabel={t("backToTables")} title={t("createTable")} titleSize={24} />
      <Body style={{ gap: 18 }}>
        <fieldset className="stack" role="radiogroup" style={{ margin: 0, padding: 0, border: 0, gap: 8 }}>
          <legend style={{ padding: "0 0 8px", fontSize: 15, fontWeight: 600 }}>{t("whoCanJoin")}</legend>
          {options.map((o) => {
            const on = o.open === isOpen;
            return (
              <button key={String(o.open)} type="button" role="radio" aria-checked={on} onClick={() => setIsOpen(o.open)} className="row" style={{ ...selected(on), alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
                <span style={{ width: 36, height: 36, flex: "none", borderRadius: 10, background: o.bg, color: o.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={o.icon} size={18} />
                </span>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{o.title}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>{o.desc}</span>
                </span>
              </button>
            );
          })}
        </fieldset>

        <label className="stack" style={{ gap: 6, fontSize: 15, fontWeight: 600 }}>
          {t("tableName")}
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("tableNamePlaceholder")}
            dir="auto"
            style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: "1px solid #3A3F5E", background: "var(--surface)", color: "var(--text)", font: "400 15px inherit", fontFamily: "inherit" }}
          />
        </label>

        <div className="row row--between" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{t("seats")}</span>
            <span className="tiny muted">{t("seatsRange", { min: MIN_SEATS, max: MAX_SEATS })}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn btn--outline" aria-label={t("fewerSeats")} disabled={seats <= MIN_SEATS} onClick={() => setSeats((s) => s - 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>−</button>
            <output aria-live="polite" className="num" style={{ minWidth: 40, textAlign: "center", fontSize: 20, fontWeight: 700 }}>{n(seats)}</output>
            <button type="button" className="btn btn--outline" aria-label={t("moreSeats")} disabled={seats >= MAX_SEATS} onClick={() => setSeats((s) => s + 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>+</button>
          </div>
        </div>
        <section className="stack" aria-labelledby="roles-h" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <h2 id="roles-h" style={{ fontSize: 15, fontWeight: 600 }}>{t("rolesSetupTitle")}</h2>
          <div role="radiogroup" aria-labelledby="roles-h" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
            {(["Classic", "Iranian", "Custom"] as RolePreset[]).map((p) => {
              const on = preset === p;
              return (
                <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setPreset(p)} style={{ minHeight: 44, borderRadius: 12, border: `1.5px solid ${on ? "#9C8CFF" : "#262A44"}`, background: on ? "#1A1836" : "transparent", color: on ? "var(--text)" : "var(--text-2)", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  {t(`preset${p}`)}
                </button>
              );
            })}
          </div>
          <span className="small muted" style={{ lineHeight: 1.45 }}>{t(`preset${preset}Text`)}</span>
          {preset === "Custom" && (
            <div className="stack" style={{ gap: 0 }}>
              <div className="row" style={{ gap: 12, paddingBottom: 8 }}>
                <span className="grow stack" style={{ gap: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t("mafiaPlayers")}</span>
                  <span className="tiny muted">{t("mafiaPlayersHint")}</span>
                </span>
                <button type="button" className="btn btn--outline" aria-label={t("fewerMafia")} disabled={mafiaCount <= 1} onClick={() => setMafiaCount((m) => m - 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>−</button>
                <output aria-live="polite" className="num" style={{ minWidth: 28, textAlign: "center", fontSize: 20, fontWeight: 700 }}>{n(mafiaCount)}</output>
                <button type="button" className="btn btn--outline" aria-label={t("moreMafia")} disabled={mafiaCount >= 5} onClick={() => setMafiaCount((m) => m + 1)} style={{ width: 44, minHeight: 44, padding: 0, fontSize: 18 }}>+</button>
              </div>
              {OPTIONAL_ROLES.map((r) => {
                const on = optional.includes(r);
                return (
                  <div key={r} className="row" style={{ gap: 10, minHeight: 50, borderTop: "1px solid #1E2138" }}>
                    <RolePortrait role={r} size={38} />
                    <span className="grow stack" style={{ gap: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{roleName(r)}</span>
                      <span className="tiny muted">{teamShort(r)}</span>
                    </span>
                    {toggle(on, roleName(r), () => setOptional((cur) => (on ? cur.filter((x) => x !== r) : [...cur, r])))}
                  </div>
                );
              })}
            </div>
          )}
          <div className="row row--wrap" style={{ gap: 6 }}>
            {chips.map(({ role, n: count }) => (
              <span key={role} className="tiny strong" style={{ padding: "5px 10px", borderRadius: 999, background: roleMeta[role].bg, color: roleMeta[role].fg }}>
                {count > 1 ? `${n(count)} × ` : ""}{role === "Villager" && count > 1 ? t("villagersPlural") : roleName(role)}
              </span>
            ))}
          </div>
          {!fits && (
            <p role="alert" className="small" style={{ padding: "10px 12px", borderRadius: 12, background: "#2A1612", border: "1px solid #4A2620", color: "#F4D2CC" }}>
              {t("setupDoesntFit", { seats, min: Number.isFinite(minPlayers) ? minPlayers : seats + 1 })}
            </p>
          )}
        </section>

        <section className="stack" style={{ gap: 4, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("roleRulesTitle")}</h2>
          {[
            { on: innocentOn, title: t("optInnocent"), text: t("optInnocentText"), flip: () => setInnocent(!innocentOn) },
            { on: jokerEnds, title: t("optJokerEnds"), text: t("optJokerEndsText"), flip: () => setJokerEnds((v) => !v) },
            { on: revealRoles, title: t("optRevealRoles"), text: t("optRevealRolesText"), flip: () => setRevealRoles((v) => !v) },
            { on: spectatorsOn, title: t("optSpectators"), text: t("optSpectatorsText"), flip: () => setSpectators(!spectatorsOn) },
          ].map((o, i) => (
            <div key={o.title} className="row" style={{ gap: 12, minHeight: 56, borderTop: i ? "1px solid #1E2138" : 0 }}>
              <span className="grow stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{o.title}</span>
                <span className="tiny muted" style={{ lineHeight: 1.4 }}>{o.text}</span>
              </span>
              {toggle(o.on, o.title, o.flip)}
            </div>
          ))}
        </section>

        <section className="stack" aria-labelledby="timers-h" style={{ gap: 12, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <button
            type="button"
            aria-expanded={timersOpen}
            aria-controls="timers-body"
            onClick={() => setTimersOpen((o) => !o)}
            className="row"
            style={{ gap: 10, minHeight: 44, padding: 0, border: 0, background: "transparent", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}
          >
            <span style={{ width: 32, height: 32, flex: "none", borderRadius: 10, background: "#1E2138", color: "#9C8CFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="clock" size={17} />
            </span>
            <span className="grow stack" style={{ gap: 0 }}>
              <span id="timers-h" style={{ fontSize: 15, fontWeight: 600 }}>{t("timers")}</span>
              <span className="tiny muted">{t("timersSummary", { speak: sec(timers.speakerSeconds), challenge: sec(timers.challengeSeconds), night: sec(timers.nightSeconds) })}</span>
            </span>
            <span aria-hidden="true" style={{ display: "flex", transform: timersOpen ? "rotate(-90deg)" : "rotate(90deg)" }}><Icon name="forward" size={18} /></span>
          </button>
          {timersOpen && (
            <div id="timers-body" className="stack" style={{ gap: 14 }}>
              {TIMERS.map((tm) => (
                <div key={tm.key} role="radiogroup" aria-label={t(tm.label)} className="stack" style={{ gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t(tm.label)}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                    {tm.choices.map((v) => {
                      const on = timers[tm.key] === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => {
                            haptic.select();
                            setTimers((cur) => ({ ...cur, [tm.key]: v }));
                          }}
                          style={{
                            minHeight: 44, borderRadius: 12, border: `1.5px solid ${on ? "#9C8CFF" : "#262A44"}`, background: on ? "#1A1836" : "#0F1224",
                            color: on ? "var(--text)" : "var(--text-2)", font: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                          }}
                        >
                          {sec(v)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <span className="tiny muted" style={{ lineHeight: 1.45 }}>{t("timersOffNote")}</span>
            </div>
          )}
        </section>

        <section className="stack" aria-labelledby="rules-h" style={{ gap: 4, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
          <h2 id="rules-h" style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("tableRulesTitle")}</h2>
          <div className="row" style={{ gap: 12 }}>
            <div className="grow stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t("lastWordsNightTitle")}</span>
              <span className="tiny muted" style={{ lineHeight: 1.4 }}>{t("lastWordsNightDesc")}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={nightLastWords}
              aria-label={t("lastWordsNightTitle")}
              onClick={() => setNightLastWords((v) => !v)}
              style={{ width: 52, height: 30, flex: "none", padding: 3, borderRadius: 999, border: 0, background: nightLastWords ? "#5FD0BE" : "#3A3F5E", display: "flex", justifyContent: nightLastWords ? "flex-end" : "flex-start", cursor: "pointer" }}
            >
              <span style={{ width: 24, height: 24, borderRadius: 999, background: "#EDEBF5" }} />
            </button>
          </div>
          <p className="tiny muted" style={{ margin: "10px 0 0", paddingTop: 10, borderTop: "1px solid #1E2138", lineHeight: 1.45 }}>
            {t("rulesAlwaysNote")} {t("rulesInLobbyNote")}
          </p>
        </section>

        {failed && <p role="alert" className="small" style={{ color: "#F08A7A" }}>{t("genericError")}</p>}
      </Body>

      <div className="stack" style={{ gap: 8, padding: "12px 16px 22px", background: "#10122A", borderTop: "1px solid #1E2138" }}>
        <button type="button" className="btn" disabled={busy || !fits} onClick={() => void create()} style={{ background: "#E5604D", color: "#1C0905" }}>
          {busy ? t("creating") : t("createAndOpen")}
        </button>
        <span className="tiny muted" style={{ textAlign: "center" }}>{t("createFootnote")}</span>
      </div>
    </Screen>
  );
}
