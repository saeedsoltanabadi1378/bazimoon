import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation } from "../app/router";
import { IconDisc, Screen, Switch } from "../ui/components";
import type { IconName } from "../ui/Icon";
import { useHub } from "./HubData";
import { LogoTiles } from "../ui/LogoTiles";
import { writeLocal } from "../lib/storage";
import { haptic } from "../lib/haptics";
import { GoogleButton } from "../ui/GoogleButton";

export const WELCOMED_KEY = "bazimoon-welcomed";

const AMBER = "#F0A83A";

const features: { icon: IconName; bg: string; fg: string; title: `welcomeF${1 | 2 | 3 | 4}`; text: `welcomeF${1 | 2 | 3 | 4}Text` }[] = [
  { icon: "zip", bg: "#173A36", fg: "#5FD0BE", title: "welcomeF1", text: "welcomeF1Text" },
  { icon: "blocks", bg: "#25141E", fg: "#F2B8D0", title: "welcomeF2", text: "welcomeF2Text" },
  { icon: "people", bg: "#2E2340", fg: "#B79CF2", title: "welcomeF3", text: "welcomeF3Text" },
  { icon: "trophy", bg: "#2A2113", fg: AMBER, title: "welcomeF4", text: "welcomeF4Text" },
];

/** First launch: language first (Persian flips the layout), what's inside, then the daily reminder. */
export function WelcomeScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { reset } = useNavigation();
  const { saveSettings } = useHub();
  const [step, setStep] = useState(0);
  const [remind, setRemind] = useState(true);

  function finish() {
    writeLocal(WELCOMED_KEY, true);
    setLanguage(language);
    void saveSettings({ language, reminderEnabled: remind });
    haptic.success();
    reset({ name: "home" });
  }

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px" }}>
        <div className="row" style={{ gap: 6 }} role="img" aria-label={t("stepOf", { step: step + 1, total: 3 })}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 999, background: i <= step ? AMBER : "#2E3252", transition: "width 200ms ease" }} />
          ))}
        </div>
        <button type="button" className="btn btn--ghost btn--auto" style={{ fontSize: 15, fontWeight: 600, color: "var(--text-2)", padding: "0 8px" }} onClick={finish}>
          {t("skip")}
        </button>
      </div>

      <div className="fade-in" key={step} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: step === 0 ? 22 : 18, padding: "0 24px", overflowY: "auto" }}>
        {step === 0 && (
          <>
            <LogoTiles size={96} />
            <h1 className="display" style={{ fontSize: 36 }}>{t("welcomeTitle")}</h1>
            <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--text-2)" }}>{t("welcomeBody")}</p>
            <div className="stack">
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{t("chooseLanguage")}</span>
              <div role="radiogroup" aria-label={t("chooseLanguage")} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {(["en", "fa"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="radio"
                    aria-checked={language === lang}
                    onClick={() => {
                      haptic.select();
                      setLanguage(lang);
                    }}
                    style={{
                      minHeight: 56, borderRadius: 16, border: `2px solid ${language === lang ? AMBER : "#2E3252"}`, background: "var(--surface)",
                      color: "var(--text)", fontFamily: lang === "fa" ? "Vazirmatn, sans-serif" : "'IBM Plex Sans', sans-serif",
                      fontSize: lang === "fa" ? 17 : 16, fontWeight: lang === "fa" ? 700 : 600, cursor: "pointer",
                    }}
                  >
                    {lang === "en" ? "English" : "فارسی"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="display" style={{ fontSize: 30, lineHeight: 1.15 }}>{t("welcomeInside")}</h1>
            {features.map((f) => (
              <div key={f.title} className="row" style={{ gap: 14, alignItems: "flex-start", padding: 14, borderRadius: 18, background: "var(--surface)" }}>
                <IconDisc icon={f.icon} size={48} iconSize={24} bg={f.bg} fg={f.fg} radius={14} strokeWidth={2} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{t(f.title)}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--text-2)" }}>{t(f.text)}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <IconDisc icon="bell" size={96} iconSize={46} bg="#2A2113" fg="#F0A83A" radius={28} strokeWidth={1.6} />
            <h1 className="display" style={{ fontSize: 30, lineHeight: 1.15 }}>{t("welcomeStreakTitle")}</h1>
            <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--text-2)" }}>{t("welcomeStreakBody")}</p>
            <button
              type="button"
              role="switch"
              aria-checked={remind}
              onClick={() => setRemind((r) => !r)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 60, padding: "0 16px", borderRadius: 16, border: 0, background: "var(--surface)", color: "var(--text)", fontSize: 15, fontWeight: 600, textAlign: "start", cursor: "pointer" }}
            >
              <span>{t("dailyReminderAt", { time: "09:00" })}</span>
              <Switch on={remind} />
            </button>
            <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{t("turnOffInProfile")}</p>
          </>
        )}
      </div>

      <div style={{ padding: "12px 16px calc(24px + var(--safe-bottom))" }}>
        {step < 2 ? (
          <button type="button" className="btn" style={{ minHeight: 54, background: AMBER, color: "#1A1206" }} onClick={() => setStep((s) => s + 1)}>{t("continue")}</button>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <button type="button" className="btn" style={{ minHeight: 54, background: AMBER, color: "#1A1206" }} onClick={finish}>{t("startPlaying")}</button>
            <GoogleButton beforeLeave={() => { writeLocal(WELCOMED_KEY, true); setLanguage(language); }} />
            <p style={{ margin: 0, textAlign: "center", fontSize: 13, lineHeight: 1.45, color: "var(--muted)" }}>{t("guestNote")}</p>
          </div>
        )}
      </div>
    </Screen>
  );
}
