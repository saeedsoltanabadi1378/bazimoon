import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { readLocal, writeLocal } from "../lib/storage";
import { Icon } from "../ui/Icon";
import { useSession } from "./session";
import { useHub } from "../hub/HubData";

/** The longest name a guest can pick; the API allows the same. */
export const MAX_NAME_LENGTH = 20;
const MIN_NAME_LENGTH = 2;
const ASKED_KEY = "bazimoon-join-name-asked";
// The name the API gives a guest who has not picked one.
const DEFAULT_NAME = /^Player \d{4}$/;

type Mode = "join" | "change";

interface NameGate {
  /** Before a guest joins or creates a game with other players: asks once, on this phone, for the
   * name the others will see. Picking one is optional, so this always resolves and the join goes on. */
  ensureName(): Promise<void>;
  /** Opens the same sheet from Profile so a guest can change their name. */
  changeName(): void;
}

const NameGateContext = createContext<NameGate | null>(null);

const nameLength = (value: string) => Array.from(value.trim().replace(/\s+/g, " ")).length;

export function NameGateProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [mode, setMode] = useState<Mode | null>(null);
  // Every caller waiting on the open sheet; they all go on once it closes.
  const waiting = useRef<Array<() => void>>([]);

  const needsName = session.isGuest && DEFAULT_NAME.test(session.displayName)
    && readLocal<string | null>(ASKED_KEY, null) !== session.userId;

  const ensureName = useCallback(() => {
    if (!needsName) return Promise.resolve();
    return new Promise<void>((resolve) => {
      waiting.current.push(resolve);
      setMode("join");
    });
  }, [needsName]);

  const changeName = useCallback(() => {
    if (session.isGuest) setMode("change");
  }, [session.isGuest]);

  const close = useCallback(() => {
    if (session.userId) writeLocal(ASKED_KEY, session.userId);
    setMode(null);
    const done = waiting.current;
    waiting.current = [];
    done.forEach((resolve) => resolve());
  }, [session.userId]);

  const value = useMemo<NameGate>(() => ({ ensureName, changeName }), [ensureName, changeName]);

  return (
    <NameGateContext.Provider value={value}>
      {children}
      {mode && <NameSheet mode={mode} onClose={close} />}
    </NameGateContext.Provider>
  );
}

export function useNameGate() {
  const gate = useContext(NameGateContext);
  if (!gate) throw new Error("useNameGate must be used inside NameGateProvider");
  return gate;
}

/** Bottom sheet, in the style of "Save your progress": a guest types the name other players see,
 * or skips and keeps the one the app gave them. */
function NameSheet({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const { t } = useLanguage();
  const session = useSession();
  const { refreshProfile } = useHub();
  const current = session.displayName;
  const [name, setName] = useState(mode === "change" && !DEFAULT_NAME.test(current) ? current : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"short" | "failed" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trimmed = name.trim().replace(/\s+/g, " ");

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (trimmed.length === 0 && mode === "join") return onClose();
    if (nameLength(trimmed) < MIN_NAME_LENGTH) return setError("short");
    if (trimmed === current) return onClose();
    setBusy(true);
    setError(null);
    try {
      await session.renameGuest(trimmed);
      // Screens that read the cached profile (Couple Quiz) pick up the new name too.
      void refreshProfile();
      onClose();
    } catch {
      setError("failed");
      setBusy(false);
    }
  }

  const primary = mode === "change"
    ? t("saveName")
    : trimmed ? t("joinAsName", { name: trimmed }) : t("joinNameContinue");

  return (
    <div data-theme="night" style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <form role="dialog" aria-modal="true" aria-labelledby="name-sheet-title" aria-describedby="name-sheet-body" onSubmit={(e) => void submit(e)} className="stack" style={{ width: "100%", maxWidth: 560, marginInline: "auto", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(26px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <span aria-hidden="true" style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 999, background: "#2E3252" }} />
        <span style={{ width: 64, height: 64, borderRadius: 20, background: "#2A2113", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="user" size={32} />
        </span>
        <h2 id="name-sheet-title" className="display" style={{ fontSize: 26, lineHeight: 1.2 }}>{mode === "change" ? t("changeNameTitle") : t("joinNameTitle")}</h2>
        <p id="name-sheet-body" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>
          {mode === "change" ? t("changeNameBody") : t("joinNameBody", { name: current })}
        </p>

        <label className="stack" style={{ gap: 6, fontSize: 15, fontWeight: 600 }}>
          {t("yourName")}
          <input
            ref={input}
            type="text"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint="go"
            dir="auto"
            disabled={busy}
            aria-invalid={error === "short"}
            aria-describedby="name-sheet-hint"
            placeholder={t("yourNamePlaceholder")}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            style={{ minHeight: 48, padding: "0 14px", borderRadius: 12, border: `1px solid ${error === "short" ? "#F08A7A" : "#3A3F5E"}`, background: "var(--bg)", color: "var(--text)", font: "400 16px inherit", fontFamily: "inherit" }}
          />
          <span id="name-sheet-hint" role={error ? "alert" : undefined} style={{ fontSize: 13, fontWeight: 400, color: error ? "#F08A7A" : "var(--text-2)" }}>
            {error === "short" ? t("nameTooShort") : error === "failed" ? t("genericError") : t("nameHint")}
          </span>
        </label>

        <div className="stack" style={{ gap: 8, paddingTop: 4 }}>
          <button type="submit" className="btn btn--primary" disabled={busy || (mode === "join" && !trimmed)}>{busy ? t("savingName") : primary}</button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={onClose} style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }}>
            {mode === "change" ? t("cancelChangeName") : t("skipName", { name: current })}
          </button>
        </div>
      </form>
    </div>
  );
}
