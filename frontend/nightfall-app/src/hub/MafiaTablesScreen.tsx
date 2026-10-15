import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { Body, Screen, TopBar } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import { CoupleHomeCard } from "../couple/CoupleHomeCard";
import type { Table } from "../api/hub";

const faceColors = ["#F0A83A", "#5FD0BE", "#B79CF2", "#8FA8FF", "#E9D8A6", "#F08A7A"];

/** Together tab: Couple Quiz, then Mafia tables (open to everyone, or in your groups), a code box
 * and "Create a table". Opening an invite link (t_CODE) lands here with the code filled in. */
export function MafiaTablesScreen({ code }: { code?: string }) {
  const { t } = useLanguage();
  const { push, replace } = useNavigation();
  const { api, isGameOn } = useHub();
  const mafiaOn = isGameOn("mafia");
  const [tab, setTab] = useState<"open" | "groups">("open");
  const { data, loading, error, reload } = useLoad(() => (mafiaOn ? api.tables(tab) : Promise.resolve([])), [api, tab, mafiaOn]);
  const [input, setInput] = useState(code ?? "");
  const [codeError, setCodeError] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function open(value: string, fromLink = false) {
    if (!value.trim()) return;
    setResolving(true);
    setCodeError(false);
    try {
      const { gameId } = await api.resolveTable(value.trim());
      if (fromLink) replace({ name: "mafia", gameId });
      else push({ name: "mafia", gameId });
    } catch {
      setCodeError(true);
    } finally {
      setResolving(false);
    }
  }

  // An invite link opens the table straight away.
  useEffect(() => {
    if (code) void open(code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void open(input);
  }

  return (
    <Screen theme="night">
      <TopBar title={t("playTogether")} subtitle={t("playTogetherSubtitle")} />
      <Body>
        {isGameOn("couple") && <CoupleHomeCard />}

        {mafiaOn && <>

        <div className="row" style={{ gap: 10, paddingTop: 4 }}>
          <span style={{ width: 32, height: 32, borderRadius: 10, background: "#2E2340", color: "#B79CF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="moon" size={18} />
          </span>
          <h2 className="display" style={{ fontSize: 20, fontWeight: 700 }}>{t("mafiaTables")}</h2>
        </div>

        <div role="tablist" aria-label={t("whichTables")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 14, background: "var(--surface)" }}>
          {(["open", "groups"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              style={{ minHeight: 44, borderRadius: 11, border: 0, background: tab === key ? "#EDEBF5" : "transparent", color: tab === key ? "#0B0D1A" : "var(--text-2)", font: "600 14px inherit", fontFamily: "inherit", cursor: "pointer" }}
            >
              {key === "open" ? t("openTables") : t("yourGroups")}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ lineHeight: 1.45 }}>{tab === "open" ? t("openTablesNote") : t("yourGroupsNote")}</p>

        {loading && !data && <div className="skeleton" style={{ height: 120, borderRadius: 18 }} />}
        {error && (
          <div className="card stack center">
            <p className="soft small">{t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={reload}>{t("tryAgain")}</button>
          </div>
        )}
        {data && data.length === 0 && (
          <div style={{ padding: "18px 16px", borderRadius: 18, background: "var(--surface-3)", fontSize: 14, lineHeight: 1.5, color: "var(--text-2)", textAlign: "center" }}>
            {tab === "open" ? t("noOpenTables") : t("noGroupTables")}
          </div>
        )}
        <div className="stack" style={{ gap: 10 }}>
          {data?.map((table) => <TableCard key={table.gameId} table={table} onOpen={() => push({ name: "mafia", gameId: table.gameId })} />)}
        </div>

        <form onSubmit={submit} className="stack" style={{ gap: 8, padding: 14, borderRadius: 18, border: "1.5px dashed #2E3252" }}>
          <label htmlFor="table-code" style={{ fontSize: 14, fontWeight: 600 }}>{t("gotCode")}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="table-code"
              type="text"
              dir="ltr"
              autoCapitalize="characters"
              autoComplete="off"
              value={input}
              onChange={(e) => { setInput(e.target.value); setCodeError(false); }}
              placeholder={t("codePlaceholder")}
              aria-invalid={codeError}
              aria-describedby={codeError ? "table-code-error" : undefined}
              style={{ flex: 1, minWidth: 0, minHeight: 44, padding: "0 12px", borderRadius: 12, border: `1px solid ${codeError ? "#F08A7A" : "#3A3F5E"}`, background: "#0B0D1A", color: "var(--text)", font: "400 14px inherit", fontFamily: "inherit" }}
            />
            <button type="submit" className="btn btn--outline" disabled={resolving || !input.trim()} style={{ width: "auto", minHeight: 44, padding: "0 16px", fontSize: 14 }}>{t("openCode")}</button>
          </div>
          {codeError && <span id="table-code-error" role="alert" className="small" style={{ color: "#F08A7A" }}>{t("codeNotFound")}</span>}
        </form>
        </>}
      </Body>

      {mafiaOn && <div style={{ padding: "12px 16px 10px", background: "#10122A", borderTop: "1px solid #1E2138" }}>
        <button type="button" className="btn" onClick={() => push({ name: "createTable" })} style={{ gap: 8, background: "#E5604D", color: "#1C0905" }}>
          <Icon name="plus" size={18} />
          {t("createTable")}
        </button>
      </div>}
      <TabBar />
    </Screen>
  );
}

function TableCard({ table, onOpen }: { table: Table; onOpen(): void }) {
  const { t } = useLanguage();
  const live = table.phase !== "Lobby";
  const full = !live && table.seated >= table.maxPlayers;
  const muted = !table.youAreSeated && (live || full);
  const action = table.youAreSeated ? t("returnShort") : live ? t("watch") : full ? t("tableFull") : t("joinTable");
  const seats = live
    ? table.round > 0 ? t("tableNightPlaying", { round: table.round, count: table.seated }) : t("tablePlaying", { count: table.seated })
    : t("seatedOf", { seated: table.seated, max: table.maxPlayers });
  const title = table.name ?? table.chatTitle ?? t("mafiaTables");

  return (
    <article className="stack" style={{ gap: 10, padding: 14, borderRadius: 18, background: "var(--surface)" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
          <span className="small muted">{[table.name ? table.chatTitle : null, table.host ? t("tableBy", { name: table.host }) : null].filter(Boolean).join(" · ")}</span>
        </div>
        <span className="row" style={{ gap: 5, padding: "3px 10px", borderRadius: 999, background: table.isOpen ? "#13302C" : "#1E2138", color: table.isOpen ? "#5FD0BE" : "#B79CF2", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
          <Icon name={table.isOpen ? "globe" : "lock"} size={12} strokeWidth={2.4} />
          {table.isOpen ? t("tableOpen") : t("tableGroupOnly")}
        </span>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <span className="row" style={{ gap: 0, flex: "none" }} aria-hidden="true">
          {table.players.slice(0, 4).map((name, i) => (
            <span key={`${name}-${i}`} style={{ width: 26, height: 26, marginInlineEnd: -6, borderRadius: 999, border: "2px solid var(--surface)", background: faceColors[i % faceColors.length], color: "#0B0D1A", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {Array.from(name)[0]?.toUpperCase()}
            </span>
          ))}
        </span>
        <span className="grow small" style={{ paddingInlineStart: 10, color: "var(--text-2)" }}>{seats}</span>
        <button
          type="button"
          onClick={onOpen}
          disabled={full && !table.youAreSeated}
          aria-label={`${action} · ${title}`}
          style={{ minHeight: 40, padding: "0 16px", borderRadius: 12, border: muted ? "1.5px solid #2E3252" : 0, background: muted ? "transparent" : "#9C8CFF", color: muted ? "var(--text-2)" : "#120D2E", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          {action}
        </button>
      </div>
    </article>
  );
}
