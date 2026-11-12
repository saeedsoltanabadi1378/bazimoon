import { useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import type { TranslationKey } from "../i18n/LanguageContext";
import { installGuide, isIpad, promptInstall, useInstallMode, type InstallGuide } from "../lib/install";
import { Icon } from "../ui/Icon";
import { LogoTiles } from "../ui/LogoTiles";

/**
 * "Install the app" sheet (Install the app artboard). Where the browser has its own install dialog
 * it is one button; everywhere else it is a numbered guide for that exact browser, each step with a
 * small picture of the button to look for, highlighted, and on iPhone an arrow to Safari's toolbar.
 */
export function InstallSheet({ onClose }: { onClose: () => void }) {
  const { t, n } = useLanguage();
  const mode = useInstallMode();
  // An installed app never opens this sheet; fall back to the browser's guide just in case.
  const guide: InstallGuide = mode === "prompt" || mode === "installed" ? installGuide() : mode;
  const prompt = mode === "prompt";
  const steps = prompt ? [] : guideSteps(guide);
  const [copied, setCopied] = useState(false);
  const pointer = !prompt && !isIpad() ? (guide === "ios" ? "center" : guide === "ios26" ? "end" : null) : null;

  async function install() {
    await promptInstall();
    onClose();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const body = prompt ? t("installBody") : guide === "inApp" ? t("installBodyInApp") : t("installBodyGuide");

  return (
    <div data-theme="night" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(5,6,14,0.72)", display: "flex", alignItems: "flex-end", color: "var(--text)", fontFamily: "var(--font-body)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="install-title" className="stack" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "calc(100dvh - 16px)", overflowY: "auto", boxSizing: "border-box", gap: 14, padding: "22px 20px calc(18px + var(--safe-bottom))", borderRadius: "28px 28px 0 0", background: "var(--surface)" }}>
        <div className="row" style={{ gap: 14, alignItems: "flex-start" }}>
          <LogoTiles size={56} />
          <div className="stack grow" style={{ gap: 2, paddingTop: 4 }}>
            <h2 id="install-title" className="display" style={{ fontSize: 22 }}>{t("installTitle")}</h2>
            <span className="small muted">{t("installSub", { mb: n(2) })}</span>
          </div>
          <button type="button" aria-label={t("notNow")} onClick={onClose} style={{ width: 40, height: 40, flex: "none", marginInlineEnd: -8, marginTop: -6, border: 0, borderRadius: 999, background: "transparent", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <Icon name="close" size={22} />
          </button>
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--text-2)" }}>{body}</p>

        {steps.length > 0 && (
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((s, i) => (
              <li key={s.title} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", columnGap: 12, rowGap: 10, padding: "12px 14px", borderRadius: 16, background: "var(--bg)" }}>
                <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: "#2A2113", color: "#F0A83A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>{n(i + 1)}</span>
                <div className="stack" style={{ gap: 3, paddingTop: 3 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{t(s.title)}</span>
                  <span style={{ fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{t(s.hint)}</span>
                </div>
                <div style={{ gridColumn: "2" }}><Visual kind={s.visual} /></div>
              </li>
            ))}
          </ol>
        )}

        <div className="stack" style={{ gap: 8, paddingTop: 2 }}>
          {prompt && <button type="button" className="btn btn--primary" onClick={() => void install()}>{t("install")}</button>}
          {guide === "inApp" && !prompt && (
            <button type="button" className="btn btn--primary" onClick={() => void copyLink()}>
              <Icon name={copied ? "check" : "link"} size={20} />{copied ? t("linkCopied") : t("installCopyLink")}
            </button>
          )}
          <button type="button" className="btn btn--ghost" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)" }} onClick={onClose}>
            {prompt ? t("notNow") : t("gotIt")}
          </button>
        </div>

        {pointer && (
          // Points at Safari's own toolbar, just below the page. Safari's toolbar mirrors on an RTL iPhone.
          <div aria-hidden="true" dir={isRtlDevice() ? "rtl" : "ltr"} style={{ display: "flex", justifyContent: pointer === "center" ? "center" : "flex-end", paddingInline: 6 }}>
            <div className="install-pointer stack" style={{ alignItems: "center", gap: 2, color: "#F0A83A" }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{t("installStartHere")}</span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v15M6 13l6 6 6-6" /></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isRtlDevice() {
  return /^(fa|ar|he|ur)\b/i.test(navigator.language || "");
}

type VisualKind =
  | "safariBar" | "safari26Bar" | "iosOtherBar" | "shareSheet" | "shareSheet26" | "addHeader" | "add26"
  | "inAppBar" | "openInBrowser" | "afterInApp"
  | "chromeBar" | "androidMenu" | "androidInstall"
  | "samsungBar" | "samsungMenu" | "samsungAdd"
  | "macMenu" | "macDock" | "macAdd"
  | "desktopBar" | "desktopInstall";

type Step = { title: TranslationKey; hint: TranslationKey; visual: VisualKind };

function guideSteps(guide: InstallGuide): Step[] {
  switch (guide) {
    case "ios":
      return [
        { title: "inst_ios1", hint: isIpad() ? "inst_ios1HintIpad" : "inst_ios1Hint", visual: "safariBar" },
        { title: "inst_ios2", hint: "inst_ios2Hint", visual: "shareSheet" },
        { title: "inst_ios3", hint: "inst_ios3Hint", visual: "addHeader" },
      ];
    case "ios26":
      return [
        { title: "inst_ios26_1", hint: "inst_ios26_1Hint", visual: "safari26Bar" },
        { title: "inst_ios2", hint: "inst_ios26_2Hint", visual: "shareSheet26" },
        { title: "inst_ios26_3", hint: "inst_ios26_3Hint", visual: "add26" },
      ];
    case "iosOther":
      return [
        { title: "inst_ios1", hint: "inst_iosOther1Hint", visual: "iosOtherBar" },
        { title: "inst_ios2", hint: "inst_ios2Hint", visual: "shareSheet" },
        { title: "inst_ios3", hint: "inst_ios3Hint", visual: "addHeader" },
      ];
    case "inApp":
      return [
        { title: "inst_inApp1", hint: "inst_inApp1Hint", visual: "inAppBar" },
        { title: "inst_inApp2", hint: "inst_inApp2Hint", visual: "openInBrowser" },
        { title: "inst_inApp3", hint: "inst_inApp3Hint", visual: "afterInApp" },
      ];
    case "android":
      return [
        { title: "inst_android1", hint: "inst_android1Hint", visual: "chromeBar" },
        { title: "inst_android2", hint: "inst_android2Hint", visual: "androidMenu" },
        { title: "inst_android3", hint: "inst_android3Hint", visual: "androidInstall" },
      ];
    case "samsung":
      return [
        { title: "inst_samsung1", hint: "inst_samsung1Hint", visual: "samsungBar" },
        { title: "inst_samsung2", hint: "inst_samsung2Hint", visual: "samsungMenu" },
        { title: "inst_samsung3", hint: "inst_samsung3Hint", visual: "samsungAdd" },
      ];
    case "mac":
      return [
        { title: "inst_mac1", hint: "inst_mac1Hint", visual: "macMenu" },
        { title: "inst_mac2", hint: "inst_mac2Hint", visual: "macDock" },
        { title: "inst_mac3", hint: "inst_mac3Hint", visual: "macAdd" },
      ];
    case "desktop":
      return [
        { title: "inst_desktop1", hint: "inst_desktop1Hint", visual: "desktopBar" },
        { title: "inst_desktop2", hint: "inst_desktop2Hint", visual: "desktopInstall" },
      ];
  }
}

/* ---------- Small pictures of the browser's own buttons. They copy the device UI, so they stay
   left-to-right and use the browser's English labels, which Persian steps also quote. */

const G = {
  chevL: "M15 5l-7 7 7 7",
  chevR: "M9 5l7 7-7 7",
  share: "M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1",
  book: "M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1zM12 6v14",
  tabs: "M8 8h12v12H8zM4 16V4h12",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  kebab: "M12 5h.01M12 12h.01M12 19h.01",
  menu: "M4 7h16M4 12h16M4 17h16",
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  close: "M6 6l12 12M18 6 6 18",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
  addSquare: "M4 4h16v16H4zM12 8v8M8 12h8",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  install: "M4 5h16v11H4zM9 20h6M12 8v5M9.5 10.5 12 13l2.5-2.5",
  bookmark: "M6 4h12v17l-6-4-6 4z",
  dock: "M3 15h18v5H3zM7 17.5h.01M12 17.5h.01M17 17.5h.01M12 4v7M9 8l3 3 3-3",
  newTab: "M12 5v14M5 12h14",
};

function Glyph({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={/h\.01/.test(d) ? 3.4 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div dir="ltr" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, borderRadius: 12, background: "#1C1F33", color: "#9A9CB8", fontSize: 13, fontFamily: "-apple-system, system-ui, sans-serif", overflow: "hidden" }}>
      {children}
    </div>
  );
}

/** A toolbar: each slot is a glyph, or text when it starts with "#". The slot at `hot` is highlighted. */
function Bar({ slots, hot }: { slots: string[]; hot: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
      {slots.map((s, i) => {
        const pill = s.startsWith("#");
        return (
          <span key={i} className={i === hot ? "install-hot" : undefined} style={{ flex: pill ? "1 1 auto" : "none", minWidth: pill ? 0 : 34, height: 32, padding: pill ? "0 10px" : 0, borderRadius: pill ? 9 : 10, background: pill && i !== hot ? "#2A2E47" : undefined, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: i === hot ? undefined : pill ? "#C9C8DC" : "#8FA8FF" }}>
            {pill ? s.slice(1) : <Glyph d={G[s as keyof typeof G]} />}
          </span>
        );
      })}
    </div>
  );
}

/** A menu list; the row at `hot` is highlighted. */
function Rows({ rows, hot }: { rows: [string, keyof typeof G | null][]; hot: number }) {
  return (
    <>
      {rows.map(([label, glyph], i) => (
        <span key={label} className={i === hot ? "install-hot" : undefined} style={{ height: 32, padding: "0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 8, background: i === hot ? undefined : "#2A2E47", color: i === hot ? undefined : "#C9C8DC", opacity: i === hot ? 1 : 0.6 }}>
          <span dir="auto">{label}</span>
          {glyph && <Glyph d={G[glyph]} size={18} />}
        </span>
      ))}
    </>
  );
}

/** A dialog's button row: a quiet button and the one to press. */
function Buttons({ quiet, press, title }: { quiet: string; press: string; title?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, height: 32 }}>
      <span style={{ padding: "0 8px", color: "#8FA8FF", opacity: 0.7 }}>{quiet}</span>
      {title && <span style={{ fontWeight: 600, color: "#EDEBF5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>}
      <span className="install-hot" style={{ height: 30, padding: "0 12px", display: "flex", alignItems: "center", fontWeight: 700 }}>{press}</span>
    </div>
  );
}

function AppTile() {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 6px", color: "#EDEBF5" }}>
      <span style={{ padding: 5, borderRadius: 9, background: "#0B0D1A", display: "flex" }}><LogoTiles size={22} /></span>
      <span style={{ fontWeight: 600 }}>Bazimoon</span>
    </span>
  );
}

function Visual({ kind }: { kind: VisualKind }) {
  const { t } = useLanguage();
  const host = window.location.host || "bazimoon.app";
  switch (kind) {
    case "safariBar": return <Frame><Bar slots={["chevL", "chevR", "share", "book", "tabs"]} hot={2} /></Frame>;
    case "safari26Bar": return <Frame><Bar slots={["chevL", `#${host}`, "dots"]} hot={2} /></Frame>;
    case "iosOtherBar": return <Frame><Bar slots={[`#${host}`, "share", "kebab"]} hot={1} /></Frame>;
    case "shareSheet": return <Frame><Rows rows={[["Add to Favorites", "star"], ["Add to Home Screen", "addSquare"]]} hot={1} /></Frame>;
    case "shareSheet26": return <Frame><Rows rows={[["View More", null], ["Add to Home Screen", "addSquare"]]} hot={1} /></Frame>;
    case "addHeader": return <Frame><Buttons quiet="Cancel" title="Add to Home Screen" press="Add" /><AppTile /></Frame>;
    case "add26": return (
      <Frame>
        <Buttons quiet="Cancel" title="Add to Home Screen" press="Add" />
        <span style={{ height: 30, padding: "0 6px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#C9C8DC" }}>
          Open as Web App
          <span style={{ width: 38, height: 22, borderRadius: 999, background: "#5FD0BE", display: "flex", justifyContent: "flex-end", padding: 2, boxSizing: "border-box" }}><span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff" }} /></span>
        </span>
      </Frame>
    );
    case "inAppBar": return <Frame><Bar slots={["close", `#${host}`, "dots"]} hot={2} /></Frame>;
    case "openInBrowser": return <Frame><Rows rows={[["Copy link", "copy"], ["Open in browser", "compass"]]} hot={1} /></Frame>;
    case "afterInApp": return <Frame><Rows rows={[[t("installApp"), "install"]]} hot={0} /></Frame>;
    case "chromeBar": return <Frame><Bar slots={["home", `#${host}`, "tabs", "kebab"]} hot={3} /></Frame>;
    case "androidMenu": return <Frame><Rows rows={[["New tab", "newTab"], ["Add to Home screen", "addSquare"]]} hot={1} /></Frame>;
    case "androidInstall": return <Frame><AppTile /><Buttons quiet="Cancel" press="Install" /></Frame>;
    case "samsungBar": return <Frame><Bar slots={["chevL", "chevR", "home", "tabs", "menu"]} hot={4} /></Frame>;
    case "samsungMenu": return <Frame><Rows rows={[["Bookmarks", "bookmark"], ["Add page to", "addSquare"]]} hot={1} /></Frame>;
    case "samsungAdd": return <Frame><AppTile /><Buttons quiet="Cancel" press="Add" /></Frame>;
    case "macMenu": return <Frame><Bar slots={["#Safari", "#File", "#Edit", "#View"]} hot={1} /></Frame>;
    case "macDock": return <Frame><Rows rows={[["New Window", null], ["Add to Dock…", "dock"]]} hot={1} /></Frame>;
    case "macAdd": return <Frame><AppTile /><Buttons quiet="Cancel" press="Add" /></Frame>;
    case "desktopBar": return <Frame><Bar slots={[`#${host}`, "install", "kebab"]} hot={1} /></Frame>;
    case "desktopInstall": return <Frame><AppTile /><Buttons quiet="Cancel" press="Install" /></Frame>;
  }
}
