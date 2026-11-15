import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { LoadingScreen } from "../app/StateScreen";
import { Body, Screen, TopBar } from "../ui/components";
import { useHub, useLoad } from "../hub/HubData";
import { useNameGate } from "../app/NameGate";
import { haptic } from "../lib/haptics";
import { ClanEmblemTile } from "./shared";
import { clanError } from "./clanText";

/** Opened from a /c/CODE clan invite: which clan it is, and one tap to join. */
export function ClanLinkScreen({ code }: { code: string }) {
  const { t, n } = useLanguage();
  const { reset, replace } = useNavigation();
  const { clans } = useHub();
  const { ensureName } = useNameGate();
  const preview = useLoad(() => clans.previewCode(code), [clans, code]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (preview.loading && !preview.data) return <LoadingScreen />;
  const p = preview.data;
  const name = p?.clan.name ?? "";

  async function join() {
    await ensureName();
    setBusy(true);
    setError(null);
    try {
      await clans.joinByCode(code);
      haptic.success();
      replace({ name: "clan" });
    } catch (err) {
      setError(clanError(err, t));
    } finally {
      setBusy(false);
    }
  }

  const canJoin = p && !p.isMember && !p.inAnotherClan && !p.banned && p.clan.members < p.clan.maxMembers;
  const text = !p ? t("clanLinkMissing")
    : p.isMember ? t("clanLinkMember", { name })
    : p.banned ? t("clanLinkBanned", { name })
    : p.inAnotherClan ? t("clanLinkOther", { name })
    : p.clan.members >= p.clan.maxMembers ? t("clanErr_clan_full")
    : t("clanLinkText", { name });

  return (
    <Screen theme="night">
      <TopBar onBack={() => reset({ name: "mafia" })} title={t("clanLinkTitle")} titleSize={24} />
      <Body style={{ gap: 18 }}>
        <section className="stack center" style={{ gap: 12, padding: "28px 16px", borderRadius: 24, background: p ? `linear-gradient(160deg, ${p.clan.color}26, var(--surface) 70%)` : "var(--surface)", textAlign: "center" }}>
          {p && <ClanEmblemTile emblem={p.clan.emblem} color={p.clan.color} size={72} />}
          {p && <div className="display" style={{ fontSize: 26, fontWeight: 800 }}>{name}</div>}
          {p && <div className="small muted">{t("clanMembersOf", { count: n(p.clan.members), max: n(p.clan.maxMembers) })}</div>}
          {p?.clan.bio && <p className="small" style={{ maxWidth: 320, color: "var(--text-2)", lineHeight: 1.5 }}>{p.clan.bio}</p>}
          <p style={{ maxWidth: 320, fontSize: 15, lineHeight: 1.5 }}>{text}</p>
        </section>
        {error && <div className="small" role="alert" style={{ color: "#F08A7A", textAlign: "center" }}>{error}</div>}
      </Body>
      <div className="screen__bar">
        {canJoin ? (
          <button type="button" className="btn" disabled={busy} onClick={() => void join()} style={{ minHeight: 54, background: p.clan.color, color: "#101218", fontSize: 16 }}>
            {t("clanLinkJoin", { name })}
          </button>
        ) : (
          <button type="button" className="btn btn--outline" style={{ minHeight: 54 }} onClick={() => replace({ name: "clan" })}>
            {p?.isMember || p?.inAnotherClan ? t("clanOpen") : t("clanFindTitle")}
          </button>
        )}
      </div>
    </Screen>
  );
}
