import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { LoadingScreen } from "../app/StateScreen";
import { Body, Screen, Toast, TopBar } from "../ui/components";
import { Icon, type IconName } from "../ui/Icon";
import { useHub, useLoad } from "../hub/HubData";
import { useNameGate } from "../app/NameGate";
import { haptic } from "../lib/haptics";
import { CLAN_COLORS, CLAN_EMBLEMS, type ClanDetail, type ClanEmblem } from "../api/clans";
import { ClanEmblemTile } from "./shared";
import { clanError, useToast } from "./clanText";

const field = { width: "100%", minHeight: 48, padding: "0 14px", borderRadius: 14, border: "1px solid #3A3F5E", background: "#0B0D1A", color: "var(--text)", font: "inherit", fontSize: 15 } as const;

/** Start a clan, or (with a clan id) its settings: name, about, emblem, colour, who can join, and
 * for owners and admins a fresh invite link; the owner can also delete it. */
export function ClanFormScreen({ clanId }: { clanId?: string }) {
  const { clans } = useHub();
  const existing = useLoad(() => (clanId ? clans.get(clanId) : Promise.resolve(null)), [clans, clanId]);
  if (clanId && existing.loading && !existing.data) return <LoadingScreen />;
  return <ClanForm clan={existing.data ?? null} />;
}

function ClanForm({ clan }: { clan: ClanDetail | null }) {
  const { t } = useLanguage();
  const { back, reset, push } = useNavigation();
  const { clans } = useHub();
  const { ensureName } = useNameGate();
  const [name, setName] = useState(clan?.name ?? "");
  const [bio, setBio] = useState(clan?.bio ?? "");
  const [emblem, setEmblem] = useState<ClanEmblem>(clan?.emblem ?? "moon");
  const [color, setColor] = useState(clan?.color ?? CLAN_COLORS[0]);
  const [isListed, setIsListed] = useState(clan?.isListed ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useToast();

  useEffect(() => setError(null), [name]);

  const valid = name.trim().length >= 3 && name.trim().length <= 24;

  async function save() {
    if (!valid) return;
    await ensureName();
    setBusy(true);
    setError(null);
    const edit = { name: name.trim(), bio: bio.trim() || null, emblem, color, isListed };
    try {
      if (clan) {
        await clans.update(clan.id, edit);
        haptic.success();
        back();
      } else {
        await clans.create(edit);
        haptic.success();
        // Land on the new clan with Together underneath, not the "find a clan" screen.
        reset({ name: "mafia" });
        push({ name: "clan" });
      }
    } catch (err) {
      setError(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function resetLink() {
    if (!clan) return;
    setBusy(true);
    try {
      await clans.resetCode(clan.id);
      haptic.success();
      setToast(t("clanLinkReset"));
    } catch (err) {
      setToast(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!clan) return;
    setBusy(true);
    try {
      await clans.remove(clan.id);
      reset({ name: "mafia" });
    } catch (err) {
      setToast(clanError(err, t));
      setBusy(false);
    }
  }

  const joinOptions = [
    { listed: true, title: t("clanListed"), desc: t("clanListedDesc"), icon: "globe" as const, bg: "#13302C", fg: "#5FD0BE" },
    { listed: false, title: t("clanUnlisted"), desc: t("clanUnlistedDesc"), icon: "lock" as const, bg: "#1E2138", fg: "#B79CF2" },
  ];

  return (
    <Screen theme="night">
      <TopBar onBack={back} title={clan ? t("clanFormEdit") : t("clanFormNew")} titleSize={24} />
      <Body style={{ gap: 20, paddingBottom: 24 }}>
        <div className="row center" style={{ gap: 14, padding: "8px 0" }}>
          <ClanEmblemTile emblem={emblem} color={color} size={64} />
          <div className="display" style={{ fontSize: 22, fontWeight: 800, overflowWrap: "anywhere" }}>{name.trim() || t("clanNamePlaceholder")}</div>
        </div>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("clanName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder={t("clanNamePlaceholder")} autoComplete="off" style={field} aria-describedby="clan-name-hint" />
          <span id="clan-name-hint" className="tiny muted">{t("clanNameHint")}</span>
        </label>

        <label className="stack" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>{t("clanBio")}</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={140} rows={2} placeholder={t("clanBioPlaceholder")} style={{ ...field, minHeight: 72, padding: "12px 14px", resize: "none", lineHeight: 1.45 }} />
        </label>

        <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{t("clanEmblem")}</legend>
          <div role="radiogroup" aria-label={t("clanEmblem")} style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
            {CLAN_EMBLEMS.map((e, i) => {
              const on = e === emblem;
              return (
                <button key={e} type="button" role="radio" aria-checked={on} aria-label={t("clanEmblemPick", { n: i + 1 })} onClick={() => setEmblem(e)}
                  style={{ aspectRatio: "1", borderRadius: 14, border: on ? `2px solid ${color}` : "1px solid #2E3252", background: on ? `${color}26` : "var(--surface)", color: on ? color : "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Icon name={e as IconName} size={22} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{t("clanColor")}</legend>
          <div role="radiogroup" aria-label={t("clanColor")} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            {CLAN_COLORS.map((c, i) => {
              const on = c === color;
              return (
                <button key={c} type="button" role="radio" aria-checked={on} aria-label={t("clanColorPick", { n: i + 1 })} onClick={() => setColor(c)}
                  style={{ width: 38, height: 38, borderRadius: 999, border: on ? "3px solid var(--text)" : "3px solid transparent", background: c, cursor: "pointer", boxShadow: on ? `0 0 0 2px ${c}` : "none" }} />
              );
            })}
          </div>
        </fieldset>

        <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, marginBottom: 8 }}>{t("clanWhoJoins")}</legend>
          <div role="radiogroup" aria-label={t("clanWhoJoins")} className="stack" style={{ gap: 8 }}>
            {joinOptions.map((o) => {
              const on = o.listed === isListed;
              return (
                <button key={String(o.listed)} type="button" role="radio" aria-checked={on} onClick={() => setIsListed(o.listed)} className="row"
                  style={{ gap: 12, padding: 14, borderRadius: 16, border: on ? `1.5px solid ${o.fg}` : "1px solid #2E3252", background: on ? o.bg : "var(--surface)", color: "var(--text)", font: "inherit", textAlign: "start", cursor: "pointer" }}>
                  <span style={{ width: 36, height: 36, flex: "none", borderRadius: 11, background: o.bg, color: o.fg, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={o.icon} size={18} /></span>
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{o.title}</span>
                    <span className="tiny muted" style={{ lineHeight: 1.4 }}>{o.desc}</span>
                  </span>
                  {on && <Icon name="check" size={18} color={o.fg} />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {clan && (
          <section className="stack" style={{ gap: 10, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
            <button type="button" className="btn btn--outline" disabled={busy} onClick={() => void resetLink()} style={{ gap: 8 }}>
              <Icon name="link" size={18} />
              {t("clanResetLink")}
            </button>
            <p className="tiny muted" style={{ textAlign: "center", marginTop: -4 }}>{t("clanResetLinkDesc")}</p>
            {clan.yourRole === "owner" && (confirmDelete ? (
              <div className="stack" style={{ gap: 8 }}>
                <p className="small" role="status" style={{ lineHeight: 1.5 }}>{t("clanDeleteConfirm", { name: clan.name })}</p>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn btn--md" disabled={busy} onClick={() => void remove()} style={{ background: "#3A1C1A", color: "#F08A7A" }}>{t("clanDeleteYes")}</button>
                  <button type="button" className="btn btn--md btn--outline" onClick={() => setConfirmDelete(false)}>{t("clanCancel")}</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--outline" onClick={() => setConfirmDelete(true)} style={{ borderColor: "#5A2A26", color: "#F08A7A" }}>{t("clanDelete")}</button>
            ))}
          </section>
        )}
      </Body>
      <div className="screen__bar">
        {error && <div className="small" role="alert" style={{ color: "#F08A7A", textAlign: "center" }}>{error}</div>}
        <button type="button" className="btn" disabled={busy || !valid} onClick={() => void save()} style={{ background: "#E5604D", color: "#1C0905" }}>
          {clan ? t("clanSave") : t("clanCreateButton")}
        </button>
      </div>
      <Toast message={toast} />
    </Screen>
  );
}
