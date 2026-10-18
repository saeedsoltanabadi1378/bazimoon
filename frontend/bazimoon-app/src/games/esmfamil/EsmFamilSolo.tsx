import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage, type Language } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub } from "../../hub/HubData";
import { IconButton, Screen } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { formatClock, puzzleToday } from "../../lib/format";
import { dailyNumber, pick, randomSeed, seeded } from "../../lib/rng";
import { writeLocal } from "../../lib/storage";
import { haptic } from "../../lib/haptics";
import type { ResultParams } from "../shared/play";
import { CLASSIC, LETTERS, SOLO_SECONDS, categoryLabel, soloPoints, startsWithLetter } from "./logic";
import { isKnownWord } from "./words";
import { dailyLetter, soloDailyKey } from "./solo";
import { EsmLetterChip } from "./parts";

const ACCENT = "#F6C377";
const INK = "#2A1A06";

type Check = "ok" | "list" | "wrong" | "empty";

/** Solo against the clock: the classic 8 categories, answers checked against Bazimoon's word lists. */
export function EsmFamilSolo({ mode, letters }: { mode: "daily" | "practice"; letters: Language }) {
  const { t, n, language } = useLanguage();
  const { back, replace } = useNavigation();
  const { submitResult } = useHub();
  const number = dailyNumber("esmfamil", puzzleToday());
  const letter = useMemo(() => (mode === "daily" ? dailyLetter(letters, number) : pick(seeded(`esm-solo-${randomSeed()}`), LETTERS[letters])), [mode, letters, number]);
  const [answers, setAnswers] = useState<string[]>(() => CLASSIC.map(() => ""));
  const [checked, setChecked] = useState<{ checks: Check[]; msLeft: number; params: ResultParams } | null>(null);
  const [leftMs, setLeftMs] = useState(SOLO_SECONDS * 1000);
  const deadline = useRef(Date.now() + SOLO_SECONDS * 1000);
  const fa = letters === "fa";

  useEffect(() => {
    if (checked) return;
    const id = window.setInterval(() => setLeftMs(Math.max(0, deadline.current - Date.now())), 250);
    return () => window.clearInterval(id);
  }, [checked]);

  useEffect(() => {
    if (!checked && leftMs === 0) {
      haptic.warn();
      finish();
    }
    // finish reads the current answers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMs]);

  function finish() {
    if (checked) return;
    const msLeft = Math.max(0, deadline.current - Date.now());
    const checks: Check[] = answers.map((a, i) =>
      a.trim() === "" ? "empty" : !startsWithLetter(a, letter) ? "wrong" : isKnownWord(letters, CLASSIC[i], a) ? "ok" : "list");
    const correct = checks.filter((c) => c === "ok").length;
    const points = soloPoints(correct, msLeft);
    const dailyMode = letters === "fa" ? "daily-fa" : "daily";
    const params: ResultParams = { kind: "solo", mode, letters, letter, number, points, correct, bonus: points - correct * 10 };
    setChecked({ checks, msLeft, params });
    if (correct > 0) haptic.success();
    else haptic.error();
    if (mode === "daily") writeLocal(soloDailyKey(letters, number), params);
    void submitResult({
      game: "esmfamil", mode: mode === "daily" ? dailyMode : "practice", puzzleNumber: mode === "daily" ? number : null,
      solved: correct > 0, score: points, moves: correct, hints: 0,
    }).then((saved) => {
      const withXp = { ...params, xp: saved ? JSON.stringify(saved) : null };
      setChecked((c) => (c ? { ...c, params: withXp } : c));
      if (mode === "daily") writeLocal(soloDailyKey(letters, number), withXp);
    });
  }

  const filled = answers.filter((a) => a.trim() !== "").length;
  const low = leftMs <= 10_000;

  return (
    <Screen theme="night">
      <div className="row row--between" style={{ padding: "14px 16px 8px" }}>
        <IconButton icon="back" label={t("backToGame", { game: t("gameEsmFamil") })} onClick={back} />
        <div style={{ textAlign: "center" }}>
          <div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{t("gameEsmFamil")}</div>
          <div className="tiny muted">{mode === "daily" ? t("esmSoloDailySub", { number }) : t("esmSoloPracticeSub")}</div>
        </div>
        <EsmLetterChip letter={letter} />
      </div>

      {!checked && (
        <>
          <div className="row row--between" style={{ padding: "0 16px 8px" }}>
            <span className="small" style={{ color: "var(--text-2)" }}>{t("esmFilledOf", { n: n(filled), total: n(CLASSIC.length) })}</span>
            <span className="num" aria-live={low ? "polite" : "off"} style={{ padding: "6px 12px", borderRadius: 999, background: low ? "#2A1418" : "var(--surface)", color: low ? "#F08A7A" : "var(--text)", fontWeight: 700 }}>
              {formatClock(leftMs, language)}
            </span>
          </div>
          <div className="progress" style={{ margin: "0 16px 8px" }} aria-hidden="true">
            <span style={{ width: `${(leftMs / (SOLO_SECONDS * 1000)) * 100}%`, background: low ? "#F08A7A" : ACCENT }} />
          </div>
          <form
            className="stack"
            style={{ flex: 1, gap: 8, padding: "4px 16px 16px", overflowY: "auto" }}
            onSubmit={(e) => {
              e.preventDefault();
              finish();
            }}
          >
            {CLASSIC.map((cat, c) => (
              <label key={cat} className="row" style={{ gap: 10, padding: 6, paddingInlineStart: 14, borderRadius: 14, background: "var(--surface)" }}>
                <span style={{ width: 92, flex: "none", fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{categoryLabel(cat, t)}</span>
                <input
                  type="text" value={answers[c]} dir="auto" lang={fa ? "fa" : "en"} autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={40}
                  placeholder={`${letter}…`} className="text-field" style={{ flex: 1 }}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAnswers((prev) => prev.map((a, i) => (i === c ? value : a)));
                  }}
                />
              </label>
            ))}
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
          <div className="screen__bar">
            <button type="button" className="btn" style={{ background: ACCENT, color: INK, fontSize: 17, fontWeight: 700 }} onClick={finish}>{t("esmSoloDone")}</button>
            <div className="tiny muted" style={{ textAlign: "center", paddingTop: 6 }}>{t("esmSoloDoneHint")}</div>
          </div>
        </>
      )}

      {checked && (
        <>
          <div className="stack" style={{ flex: 1, gap: 10, padding: "4px 16px 16px", overflowY: "auto" }}>
            <div className="row" style={{ gap: 14, padding: 14, borderRadius: 18, background: "#241A0E" }}>
              <span className="display num" style={{ fontSize: 44, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>{n(Number(checked.params.points))}</span>
              <span className="stack" style={{ gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t("esmPointsWord")}</span>
                <span className="tiny" style={{ color: "var(--text-2)" }}>{t("esmSoloBreakdown", { correct: n(Number(checked.params.correct)), bonus: n(Number(checked.params.bonus)) })}</span>
              </span>
            </div>
            {CLASSIC.map((cat, c) => {
              const status = checked.checks[c];
              const ok = status === "ok";
              const note = ok ? "" : status === "list" ? t("esmNotOnList") : status === "wrong" ? t("esmWrongLetter") : t("esmEmpty");
              return (
                <div key={cat} className="row" style={{ gap: 10, minHeight: 52, padding: "6px 12px", borderRadius: 14, background: "var(--surface)" }}>
                  <span style={{ width: 28, height: 28, flex: "none", borderRadius: 999, background: ok ? "#13302C" : "#2A1418", color: ok ? "#5FD0BE" : "#F08A7A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={ok ? "check" : "close"} size={16} />
                  </span>
                  <span style={{ width: 70, flex: "none", fontSize: 13, color: "var(--muted)" }}>{categoryLabel(cat, t)}</span>
                  <span className="grow" dir="auto" style={{ fontSize: 15, fontWeight: 600, color: ok ? "var(--text)" : "var(--muted)", textDecoration: ok || status === "empty" ? "none" : "line-through" }}>
                    {answers[c] || "—"}
                  </span>
                  <span className="tiny" style={{ color: ok ? "#5FD0BE" : "#F08A7A", fontWeight: 600 }}>{ok ? `+${n(10)}` : note}</span>
                </div>
              );
            })}
            <div className="tiny muted">{t("esmListNote")}</div>
          </div>
          <div className="screen__bar">
            <button type="button" className="btn" style={{ background: ACCENT, color: INK }} onClick={() => replace({ name: "game", game: "esmfamil", screen: "result", params: checked.params })}>
              {t("seeResults")}
            </button>
          </div>
        </>
      )}
    </Screen>
  );
}
