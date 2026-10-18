import { useCallback, useEffect, useState } from "react";
import { adminApi } from "./adminApi";
import { AdminI18nProvider, useAdminI18n } from "./i18n";
import { Logo, NAV, Svg, type AdminPage } from "./ui";
import { OverviewPage } from "./pages/Overview";
import { GamesPage } from "./pages/Games";
import { PlayersPage } from "./pages/Players";
import { PuzzlesPage } from "./pages/Puzzles";
import { SettingsPage } from "./pages/Settings";
import { SystemPage } from "./pages/System";
import "./admin.css";

const PAGES = NAV.map((n) => n.page);

function pageFromPath(): AdminPage {
  const segment = window.location.pathname.split("/")[2] as AdminPage | undefined;
  return segment && PAGES.includes(segment) ? segment : "overview";
}

export default function AdminApp() {
  return (
    <AdminI18nProvider>
      <AdminRoot />
    </AdminI18nProvider>
  );
}

function AdminRoot() {
  const { lang, t } = useAdminI18n();
  const [auth, setAuth] = useState<{ username: string } | null | undefined>(undefined);
  const [page, setPage] = useState<AdminPage>(pageFromPath);

  const check = useCallback(() => {
    adminApi.session()
      .then(async (s) => {
        await adminApi.csrf();
        setAuth({ username: s.username });
      })
      .catch(() => setAuth(null));
  }, []);
  useEffect(check, [check]);

  // The Mini App turns zoom off in index.html; the admin console is a normal web page, so it keeps it.
  useEffect(() => {
    document.querySelector('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0");
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `Bazimoon · ${t("console")}`;
  }, [lang, t]);

  useEffect(() => {
    const onPop = () => setPage(pageFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((next: AdminPage) => {
    window.history.pushState({}, "", `/admin/${next}`);
    setPage(next);
    window.scrollTo(0, 0);
  }, []);

  const dir = lang === "fa" ? "rtl" : "ltr";
  if (auth === undefined) return <div className="adm" dir={dir}><div className="adm-login"><span className="muted">{t("loading")}</span></div></div>;
  if (auth === null) return <div className="adm" dir={dir}><Login onSignedIn={(username) => setAuth({ username })} /></div>;

  return (
    <div className="adm" dir={dir}>
      <SideMenu page={page} go={go} username={auth.username} onSignOut={async () => { await adminApi.logout().catch(() => undefined); setAuth(null); }} />
      {page === "overview" && <OverviewPage go={go} />}
      {page === "games" && <GamesPage />}
      {page === "players" && <PlayersPage />}
      {page === "puzzles" && <PuzzlesPage />}
      {page === "settings" && <SettingsPage />}
      {page === "system" && <SystemPage />}
    </div>
  );
}

function LanguageSwitch() {
  const { lang, setLang, t } = useAdminI18n();
  return (
    <div role="radiogroup" aria-label={t("language")} className="adm-seg">
      <button type="button" role="radio" aria-checked={lang === "en"} onClick={() => setLang("en")} style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>English</button>
      <button type="button" role="radio" aria-checked={lang === "fa"} onClick={() => setLang("fa")} style={{ fontFamily: "'Vazirmatn', sans-serif" }}>فارسی</button>
    </div>
  );
}

function SideMenu({ page, go, username, onSignOut }: { page: AdminPage; go(p: AdminPage): void; username: string; onSignOut(): void }) {
  const { t } = useAdminI18n();
  return (
    <nav aria-label={t("menu")} className="adm-side">
      <div className="adm-brand">
        <Logo />
        <div>
          <b>Bazimoon</b>
          <span className="tiny muted">{t("console")}</span>
        </div>
      </div>
      <div className="adm-navrow">
      {NAV.map((n) => (
        <a
          key={n.page}
          href={`/admin/${n.page}`}
          className="adm-nav"
          aria-current={n.page === page ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); go(n.page); }}
        >
          <Svg d={n.icon} />
          <span>{t(n.label)}</span>
        </a>
      ))}
      </div>
      <div className="adm-grow" />
      <LanguageSwitch />
      <div className="adm-me">
        <span className="adm-avatar">{Array.from(username)[0]?.toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{username}</span>
          <span className="tiny muted">{t("adminRole")}</span>
        </div>
        <button type="button" className="adm-link" onClick={onSignOut}>{t("signOut")}</button>
      </div>
    </nav>
  );
}

function Login({ onSignedIn }: { onSignedIn(username: string): void }) {
  const { t } = useAdminI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="adm-login">
      <main>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo />
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 800 }}>Bazimoon</div>
            <div className="small muted">{t("console")}</div>
          </div>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(false);
            try {
              const r = await adminApi.login(username, password);
              await adminApi.csrf();
              onSignedIn(r.username);
            } catch (err) {
              void err;
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h1 className="display" style={{ fontSize: 28, fontWeight: 800 }}>{t("signInTitle")}</h1>
          <p className="text-2" style={{ fontSize: 14, lineHeight: 1.5 }}>{t("signInBody")}</p>
          {error && (
            <div role="alert" className="adm-error" style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Svg d="M12 8v5M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
              <span>{t("signInError")}</span>
            </div>
          )}
          <label className="adm-label" style={{ fontSize: 14 }}>
            {t("username")}
            <input className="adm-input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} dir="ltr" />
          </label>
          <label className="adm-label" style={{ fontSize: 14 }}>
            {t("password")}
            <input className="adm-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" style={{ borderColor: error ? "#F08A7A" : undefined }} />
          </label>
          <button type="submit" className="adm-btn primary" disabled={busy || !username || !password} style={{ minHeight: 52, fontSize: 16 }}>
            {busy ? t("signingIn") : t("signIn")}
          </button>
          <span className="tiny muted" style={{ lineHeight: 1.45 }}>{t("sessionNote")}</span>
        </form>
        <div style={{ alignSelf: "center" }}><LanguageSwitch /></div>
      </main>
    </div>
  );
}
