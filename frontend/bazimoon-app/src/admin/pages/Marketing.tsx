import { useMemo, useState } from "react";
import { useAdminI18n } from "../i18n";
import { Header, Svg } from "../ui";

type Destination = "home" | "table" | "custom";
type SavedLink = {
  id: string;
  label: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  url: string;
  createdAt: string;
};

const STORAGE_KEY = "bazimoon-admin-marketing-links";
const sources = ["instagram", "telegram", "whatsapp", "aparat", "discord", "cafe_bazaar", "myket", "ambassador", "event", "player_share"];
const media = ["organic_social", "paid_social", "organic_video", "paid_video", "influencer", "community", "referral", "qr", "app_store", "direct_outreach"];

function readSaved(): SavedLink[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as SavedLink[] : [];
  } catch {
    return [];
  }
}

function token(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^\p{L}\p{N}_]/gu, "");
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for browsers that expose Clipboard API but deny it here.
    }
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export function MarketingPage() {
  const { t, date } = useAdminI18n();
  const [label, setLabel] = useState("");
  const [destination, setDestination] = useState<Destination>("home");
  const [roomCode, setRoomCode] = useState("");
  const [customPath, setCustomPath] = useState("/");
  const [landingLanguage, setLandingLanguage] = useState<"fa" | "en">("fa");
  const [source, setSource] = useState("instagram");
  const [customSource, setCustomSource] = useState("");
  const [medium, setMedium] = useState("organic_social");
  const [customMedium, setCustomMedium] = useState("");
  const [campaign, setCampaign] = useState("mafia_launch_2026q4");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedLink[]>(readSaved);

  const actualSource = token(source === "custom" ? customSource : source);
  const actualMedium = token(medium === "custom" ? customMedium : medium);
  const actualCampaign = token(campaign);
  const destinationValid = destination === "home" || (destination === "table" ? Boolean(roomCode.trim()) : Boolean(customPath.trim()));
  const valid = Boolean(actualSource && actualMedium && actualCampaign && destinationValid);
  const url = useMemo(() => {
    const path = destination === "table"
      ? `/t/${encodeURIComponent(roomCode.trim() || "ROOMCODE")}`
      : destination === "custom"
        ? `/${customPath.trim().replace(/^\/+/, "")}`
        : "/";
    const result = new URL(path, "https://bazimoon.com");
    result.searchParams.set("lang", landingLanguage);
    if (actualSource) result.searchParams.set("utm_source", actualSource);
    if (actualMedium) result.searchParams.set("utm_medium", actualMedium);
    if (actualCampaign) result.searchParams.set("utm_campaign", actualCampaign);
    if (token(content)) result.searchParams.set("utm_content", token(content));
    if (token(term)) result.searchParams.set("utm_term", token(term));
    return result.toString();
  }, [destination, roomCode, customPath, landingLanguage, actualSource, actualMedium, actualCampaign, content, term]);

  function persist(next: SavedLink[]) {
    setSaved(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  }

  function save() {
    if (!valid) return;
    const item: SavedLink = {
      id: crypto.randomUUID(), label: label.trim() || token(content) || actualSource,
      source: actualSource, medium: actualMedium, campaign: actualCampaign,
      content: token(content), term: token(term), url, createdAt: new Date().toISOString(),
    };
    persist([item, ...saved]);
    setLabel("");
  }

  function exportCsv() {
    const header = ["label", "source", "medium", "campaign", "content", "term", "url", "created_at"];
    const rows = saved.map((item) => [item.label, item.source, item.medium, item.campaign, item.content, item.term, item.url, item.createdAt]);
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `bazimoon-utm-links-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function copy(value: string, id: string) {
    await copyText(value);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => current === id ? null : current), 1800);
  }

  return (
    <main className="adm-main">
      <Header kicker={t("marketingKicker")} title={t("marketingTitle")} />
      <p className="small text-2" style={{ maxWidth: 800, lineHeight: 1.6, margin: 0 }}>{t("marketingIntro")}</p>

      <div className="adm-grid">
        <section className="adm-panel" aria-labelledby="utm-details" style={{ gap: 14 }}>
          <h2 id="utm-details" style={{ fontSize: 16 }}>{t("linkDetails")}</h2>
          <label className="adm-label">{t("linkLabel")}<input className="adm-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("linkLabelPlaceholder")} /></label>
          <label className="adm-label">{t("destination")}
            <select className="adm-input" value={destination} onChange={(e) => setDestination(e.target.value as Destination)}>
              <option value="home">{t("destinationHome")}</option>
              <option value="table">{t("destinationTable")}</option>
              <option value="custom">{t("destinationCustom")}</option>
            </select>
          </label>
          {destination === "table" && <label className="adm-label">{t("roomCode")}<input className="adm-input" dir="ltr" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="FA1234" /></label>}
          {destination === "custom" && <label className="adm-label">{t("customPath")}<input className="adm-input" dir="ltr" value={customPath} onChange={(e) => setCustomPath(e.target.value)} placeholder="/play/mafia" /></label>}
          <label className="adm-label">{t("landingLanguage")}
            <select className="adm-input" value={landingLanguage} onChange={(e) => setLandingLanguage(e.target.value as "fa" | "en")}>
              <option value="fa">فارسی</option><option value="en">English</option>
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: 10 }}>
            <SelectWithCustom label={t("source")} value={source} custom={customSource} options={sources} onValue={setSource} onCustom={setCustomSource} customLabel={t("customValue")} />
            <SelectWithCustom label={t("medium")} value={medium} custom={customMedium} options={media} onValue={setMedium} onCustom={setCustomMedium} customLabel={t("customValue")} />
          </div>
          <label className="adm-label">{t("campaign")}<input className="adm-input" dir="ltr" value={campaign} onChange={(e) => setCampaign(e.target.value)} /></label>
          <label className="adm-label">{t("contentVariation")}<input className="adm-input" dir="ltr" value={content} onChange={(e) => setContent(e.target.value)} placeholder={t("contentPlaceholder")} /></label>
          <label className="adm-label">{t("termOptional")}<input className="adm-input" dir="ltr" value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t("termPlaceholder")} /></label>
          <div className="adm-note"><Svg d="M12 8v5M12 17h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" size={17} />{t("namingHint")}</div>
        </section>

        <section className="adm-panel" aria-labelledby="utm-result" style={{ gap: 14, position: "sticky", top: 20 }}>
          <h2 id="utm-result" style={{ fontSize: 16 }}>{t("generatedLink")}</h2>
          {(!actualSource || !actualMedium || !actualCampaign) && <div className="adm-error" role="alert">{t("requiredUtm")}</div>}
          {!destinationValid && <div className="adm-error" role="alert">{t("requiredDestination")}</div>}
          <textarea className="adm-textarea" rows={7} readOnly dir="ltr" value={url} onFocus={(e) => e.currentTarget.select()} style={{ overflowWrap: "anywhere", fontFamily: "monospace", fontSize: 13 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="button" className="adm-btn primary" disabled={!valid} onClick={() => void copy(url, "preview")}><Svg d="M8 8h11v12H8zM5 16H4V4h11v1" /> {copied === "preview" ? t("copied") : t("copyLink")}</button>
            <button type="button" className="adm-btn" disabled={!valid} onClick={save}>{t("saveLink")}</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span className="adm-pill" style={{ background: "#13302C", color: "#5FD0BE" }}>{actualSource || "utm_source"}</span>
            <span className="adm-pill" style={{ background: "#1E2138", color: "#9C8CFF" }}>{actualMedium || "utm_medium"}</span>
            <span className="adm-pill" style={{ background: "#2A2113", color: "#F0A83A" }}>{actualCampaign || "utm_campaign"}</span>
          </div>
        </section>
      </div>

      <section className="adm-panel flush" aria-labelledby="saved-links">
        <div className="adm-panel-head" style={{ padding: 18 }}>
          <div><h2 id="saved-links">{t("savedLinks")}</h2><span className="tiny muted">{t("savedLinksHint")}</span></div>
          <button type="button" className="adm-btn" disabled={!saved.length} onClick={exportCsv}>{t("exportCsv")}</button>
        </div>
        {!saved.length ? <div className="adm-empty">{t("noSavedLinks")}</div> : (
          <div className="adm-table-wrap"><table className="adm-table"><thead><tr><th>{t("linkLabel")}</th><th>{t("source")}</th><th>{t("campaign")}</th><th>{t("created")}</th><th>{t("link")}</th></tr></thead>
            <tbody>{saved.map((item) => <tr key={item.id}>
              <td><strong>{item.label}</strong><span className="tiny muted" style={{ display: "block" }}>{item.medium}{item.content ? ` · ${item.content}` : ""}</span></td>
              <td dir="ltr">{item.source}</td><td dir="ltr">{item.campaign}</td><td>{date(item.createdAt, true)}</td>
              <td><div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button type="button" className="adm-btn" style={{ minHeight: 36, padding: "0 10px" }} onClick={() => void copy(item.url, item.id)}>{copied === item.id ? t("copied") : t("copyLink")}</button>
                <button type="button" className="adm-btn danger" style={{ minHeight: 36, padding: "0 10px" }} aria-label={t("deleteLink")} onClick={() => persist(saved.filter((savedItem) => savedItem.id !== item.id))}>×</button>
              </div></td>
            </tr>)}</tbody></table></div>
        )}
      </section>
    </main>
  );
}

function SelectWithCustom({ label, value, custom, options, onValue, onCustom, customLabel }: { label: string; value: string; custom: string; options: string[]; onValue(value: string): void; onCustom(value: string): void; customLabel: string }) {
  return <label className="adm-label">{label}
    <select className="adm-input" dir="ltr" value={value} onChange={(e) => onValue(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}<option value="custom">{customLabel}</option></select>
    {value === "custom" && <input className="adm-input" dir="ltr" value={custom} onChange={(e) => onCustom(e.target.value)} autoFocus />}
  </label>;
}
