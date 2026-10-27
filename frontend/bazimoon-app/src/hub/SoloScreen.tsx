import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useNavigation, type GameKey } from "../app/router";
import { Body, IconButton, Screen } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub } from "./HubData";
import { catalog, tagColors, type GameCategory } from "../games/catalog";
import { readLocal } from "../lib/storage";
import { haptic } from "../lib/haptics";

const filters: ("All" | GameCategory)[] = ["All", "Puzzles", "Words", "Party", "Couples", "Classics", "Arcade"];

/** A saved endless game the player can jump back into. Merge stores {score} under this key. */
function savedMerge(): number | null {
  const saved = readLocal<{ score: number; over: boolean } | null>("bazimoon-merge-classic", null);
  return saved && !saved.over && saved.score > 0 ? saved.score : null;
}

export function SoloScreen() {
  const { t, n } = useLanguage();
  const { push, back, depth } = useNavigation();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const mergeScore = savedMerge();
  const { isGameOn } = useHub();
  const games = catalog.filter((g) => isGameOn(g.key) && (filter === "All" || g.category === filter));

  function open(key: string) {
    haptic.tap();
    if (key === "couple") push({ name: "couple", screen: "home" });
    else push({ name: "game", game: key as GameKey, screen: "intro" });
  }

  return (
    <Screen theme="night">
      <header className="topbar">
        {depth > 1 && <IconButton icon="back" label={t("backToHome")} onClick={back} />}
        <div className="topbar__text">
          <h1 className="display" style={{ fontSize: 26 }}>{t("soloGames")}</h1>
          <div className="tiny muted">{t("soloSubtitle")}</div>
        </div>
      </header>

      <Body style={{ paddingBottom: 20 }}>
        {mergeScore !== null && isGameOn("merge") && (
          <button
            type="button"
            onClick={() => push({ name: "game", game: "merge", screen: "play", params: { mode: "classic" } })}
            className="row"
            style={{ gap: 12, padding: 14, borderRadius: 20, background: "#1A1740", border: "1px solid #2E2A66", color: "var(--text)", textAlign: "start", cursor: "pointer" }}
          >
            <span style={{ width: 52, height: 52, flex: "none", borderRadius: 14, background: "#2A2650", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 3, padding: 10 }} aria-hidden="true">
              {["#3E3A78", "#9C8CFF", "#F0A83A", "#54449E"].map((c) => <span key={c} style={{ borderRadius: 4, background: c }} />)}
            </span>
            <span className="grow">
              <span className="kicker" style={{ display: "block", letterSpacing: 1 }}>{t("continueLabel")}</span>
              <span style={{ display: "block", fontSize: 16, fontWeight: 600 }}>{t("mergeContinue", { score: n(mergeScore) })}</span>
            </span>
            <span className="flip-rtl" style={{ display: "flex", color: "#9C8CFF" }}><Icon name="forward" size={20} /></span>
          </button>
        )}

        <div className="filter-row" role="tablist" aria-label={t("gameType")}>
          {filters.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {t(`filter${f}`)}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {games.map((g) => {
            const [tagBg, tagFg] = tagColors[g.tag];
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => open(g.key)}
                className="stack"
                style={{
                  gap: 10, padding: 14, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--surface-2)",
                  color: "var(--text)", textAlign: "start", cursor: "pointer",
                }}
              >
                <span className="row row--between" style={{ alignItems: "flex-start", width: "100%" }}>
                  <span style={{ width: 46, height: 46, borderRadius: 14, background: g.bg, color: g.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={g.icon} size={24} />
                  </span>
                  <span className="tag" style={{ background: tagBg, color: tagFg }}>{t(`tag${g.tag}`)}</span>
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{t(g.name)}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{t(g.sub)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Body>
      <TabBar />
    </Screen>
  );
}
