import { useNavigation } from "../app/router";
import { useLanguage } from "../i18n/LanguageContext";
import { useHub, useLoad } from "../hub/HubData";
import { useCoupleApi } from "./CoupleRoute";

const PINK = "#F2A7C3";

/** The Couple Quiz row on Home: today's status for a couple, or an invitation to start one. */
/** Today's Couple Quiz status, shared by the Together row and the Home tile. */
export function useCoupleSummary() {
  const { t, n } = useLanguage();
  const { profile } = useHub();
  const capi = useCoupleApi();
  const { data } = useLoad(() => capi.state(), [capi]);
  const couple = data?.couple;
  const me = profile?.name ? Array.from(profile.name)[0]!.toUpperCase() : "?";
  const partner = couple ? Array.from(couple.partnerName)[0]?.toUpperCase() ?? "?" : data?.status === "pending" ? "?" : "+";

  const title = couple
    ? couple.streak > 0 ? t("coupleCardStreak", { count: n(couple.streak) }) : t("coupleQuiz")
    : t("coupleQuiz");
  const sub = couple
    ? couple.today.youDone && couple.today.partnerDone ? t("coupleCardReveal")
      : couple.today.youDone ? t("coupleCardWaiting", { name: couple.partnerName })
        : couple.today.partnerDone ? t("coupleCardYourTurn", { name: couple.partnerName })
          : t("coupleCardNew")
    : data?.status === "pending" ? t("coupleCardPending") : t("coupleCardInvite");
  return { data, couple, me, partner, title, sub };
}

export function CoupleHomeCard() {
  const { push } = useNavigation();
  const { couple, me, partner, title, sub } = useCoupleSummary();

  return (
    <button
      type="button"
      onClick={() => push({ name: "couple", screen: couple ? "home" : "invite" })}
      className="row"
      style={{ gap: 12, padding: 14, borderRadius: 18, background: "#24121C", border: "1px solid #4A2638", color: "#F2EEE6", textAlign: "start", cursor: "pointer", font: "inherit", width: "100%" }}
    >
      <span className="row" style={{ flex: "none", gap: 0 }} aria-hidden="true">
        <span style={{ width: 36, height: 36, borderRadius: 999, background: "#EDEBF5", color: "#101218", border: "2px solid #24121C", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{me}</span>
        <span style={{ width: 36, height: 36, marginInlineStart: -10, borderRadius: 999, background: couple ? PINK : "transparent", color: couple ? "#101218" : PINK, border: couple ? "2px solid #24121C" : `2px dashed ${PINK}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{partner}</span>
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 16 }}>{title}</span>
        <span style={{ display: "block", fontSize: 13, color: "#D9C9D1" }}>{sub}</span>
      </span>
      <svg className="flip-rtl" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PINK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );
}
