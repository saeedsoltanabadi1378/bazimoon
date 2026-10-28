import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "../ui/Icon";

export type VoiceCheckState = "idle" | "checking" | "passed" | "failed";

const sessionKey = "bazimoon-mafia-voice-check";

function savedPass(): boolean {
  try {
    return sessionStorage.getItem(sessionKey) === "passed";
  } catch {
    return false;
  }
}

/** A lightweight lobby check: verifies microphone permission/capture and records basic network
 * information without joining Agora or retaining audio. It deliberately stops every track as soon
 * as the browser confirms capture. */
export function VoicePreflight({ onChange }: { onChange(state: VoiceCheckState): void }) {
  const { t } = useLanguage();
  const [state, setState] = useState<VoiceCheckState>(() => savedPass() ? "passed" : "idle");
  const [reason, setReason] = useState<"permission" | "missing" | "offline" | null>(null);
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const network = navigator.onLine ? connection?.effectiveType?.toUpperCase() ?? t("voiceNetworkOnline") : t("voiceNetworkOffline");

  useEffect(() => onChange(state), [onChange, state]);

  async function run() {
    if (!navigator.onLine) {
      setReason("offline");
      setState("failed");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setReason("missing");
      setState("failed");
      return;
    }
    setReason(null);
    setState("checking");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const live = stream.getAudioTracks().some((track) => track.readyState === "live");
      if (!live) throw new Error("no-live-audio-track");
      try { sessionStorage.setItem(sessionKey, "passed"); } catch { /* a private browser may block storage */ }
      setState("passed");
    } catch {
      setReason("permission");
      setState("failed");
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  }

  const passed = state === "passed";
  const failedText = reason === "offline" ? t("voiceCheckOffline") : reason === "missing" ? t("voiceCheckUnsupported") : t("voiceCheckPermission");
  return (
    <section className="stack" aria-labelledby="voice-check-title" style={{ gap: 10, padding: 14, borderRadius: 18, background: passed ? "#10251F" : "var(--surface)", border: `1px solid ${passed ? "#1E4A40" : "var(--edge-soft)"}` }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{ width: 40, height: 40, flex: "none", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: passed ? "#13302C" : "#1E2138", color: passed ? "#5FD0BE" : "#B79CF2" }}>
          <Icon name={passed ? "check" : "mic"} size={20} />
        </span>
        <div className="grow stack" style={{ gap: 1 }}>
          <h2 id="voice-check-title" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("voiceCheckTitle")}</h2>
          <span className="small" style={{ color: "var(--text-2)" }}>{passed ? t("voiceCheckPassed") : state === "failed" ? failedText : t("voiceCheckText")}</span>
        </div>
      </div>
      <div className="row row--between tiny" style={{ color: "var(--muted)" }}>
        <span>{t("voiceCheckNetwork")}</span>
        <span dir="ltr">{network}</span>
      </div>
      {!passed && (
        <button type="button" className="btn btn--outline" disabled={state === "checking"} onClick={() => void run()} style={{ minHeight: 44 }}>
          {state === "checking" ? t("voiceChecking") : state === "failed" ? t("voiceCheckRetry") : t("voiceCheckStart")}
        </button>
      )}
    </section>
  );
}
