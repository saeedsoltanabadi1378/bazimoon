import { useState } from "react";
import { useLanguage, type TranslationKey } from "../../i18n/LanguageContext";
import { useNavigation } from "../../app/router";
import { useHub } from "../../hub/HubData";
import { Screen } from "../../ui/components";
import type { PowerKey } from "./engine";
import { BALLS, POWER_PRICE, THEMES, TRAILS, ballOf, themeOf, trailOf, priceOf, TIER_COLORS, TIER_COLORS_SAFE } from "./cosmetics";
import {
  ACHIEVEMENTS, achievementProgress, buyCosmetic, buyPower, equip, levelsDone, resetProgress, resetTips, setSettings, starTotal, useBricksProfile,
  type AchievementGroup, type Settings,
} from "./progress";
import { LEVEL_COUNT } from "./levels";
import { CHALLENGE_COUNT } from "./challenges";
import { play, setVolumes } from "./audio";
import { ACCENT, BricksHeader, CoinPill, GOLD, INK, POWER_ICON, Svg, Tabs } from "./ui";
import { useBricksNav, useMenuMusic } from "./BricksMenus";

type ShopTab = "ball" | "trail" | "theme" | "power";
const POWER_ORDER: PowerKey[] = ["hlaser", "vlaser", "bomb", "double", "shield"];

// ------------------------------------------------------------------ customize and power-ups

export function BricksShop() {
  const { t, n } = useLanguage();
  const { back } = useBricksNav();
  const profile = useBricksProfile();
  useMenuMusic();
  const [tab, setTab] = useState<ShopTab>("ball");
  const [sel, setSel] = useState<Record<ShopTab, string>>({ ball: profile.equipped.ball, trail: profile.equipped.trail, theme: profile.equipped.theme, power: "hlaser" });
  const current = sel[tab];
  const key = `${tab}:${current}`;
  const owned = tab !== "power" && profile.owned.includes(key);
  const equipped = tab !== "power" && profile.equipped[tab] === current;
  const list = tab === "ball" ? BALLS : tab === "trail" ? TRAILS : tab === "theme" ? THEMES : [];
  const item = list.find((x) => x.id === current);
  const price = tab === "power" ? POWER_PRICE[current as PowerKey] : priceOf(key);
  const world = item && "world" in item ? item.world : undefined;

  // The preview: what is being looked at, over what is equipped in the other slots.
  const ball = ballOf(tab === "ball" ? current : profile.equipped.ball);
  const trail = trailOf(tab === "trail" ? current : profile.equipped.trail);
  const theme = themeOf(tab === "theme" ? current : profile.equipped.theme);
  const nameOf = (kind: "ball" | "trail" | "theme", id: string) => t(`bricksItem_${kind}_${id}` as TranslationKey);

  let action = "", disabled = false, onAct = () => {};
  let note = "";
  if (tab === "power") {
    const p = current as PowerKey;
    note = t("bricksPowerOwned", { count: n(profile.inv[p]) });
    if (profile.coins >= price) { action = t("bricksBuyOne", { coins: n(price) }); onAct = () => { if (buyPower(p)) play("coin"); }; }
    else { action = t("bricksNeedCoins", { coins: n(price - profile.coins) }); disabled = true; }
  } else {
    note = owned ? t("bricksYours") : world ? t("bricksOrWorld", { world: n(world) }) : t("bricksUnlockWithCoins");
    if (equipped) { action = t("bricksEquipped"); disabled = true; }
    else if (owned) { action = t("bricksEquip"); onAct = () => { equip(tab, current); play("button"); }; }
    else if (profile.coins >= price) { action = t("bricksUnlockFor", { coins: n(price) }); onAct = () => { if (buyCosmetic(key)) play("unlock"); }; }
    else { action = t("bricksNeedCoins", { coins: n(price - profile.coins) }); disabled = true; }
  }

  const path = [[88, 30], [112, 46], [136, 62], [160, 78], [184, 94], [208, 108]];
  return (
    <Screen theme="night">
      <BricksHeader title={t("bricksCustomize")} sub={t("bricksCustomizeSub")} onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })} right={<CoinPill coins={profile.coins} />} />
      <div dir="ltr" role="img" aria-label={t("bricksPreviewAria", { ball: nameOf("ball", ball.id), trail: nameOf("trail", trail.id), theme: nameOf("theme", theme.id) })}
        style={{ position: "relative", margin: "4px 16px 10px", height: 168, borderRadius: 20, background: `linear-gradient(180deg, ${theme.top}, ${theme.bottom})`, overflow: "hidden", flex: "none" }}>
        {[[20, 20, 2], [300, 40, 3], [60, 140, 2], [330, 130, 2], [180, 18, 2], [250, 150, 3], [120, 120, 2], [280, 90, 2]].map(([x, y, s], i) => (
          <span key={i} style={{ position: "absolute", left: `${(x / 350) * 100}%`, top: y, width: s, height: s, borderRadius: 999, background: theme.dot, opacity: 0.4 }} />
        ))}
        {[[14, 14, 4, 24], [62, 14, 1, 9], [254, 14, 3, 31], [302, 14, 0, 3], [14, 54, 2, 14], [302, 54, 5, 62]].map(([x, y, c, v], i) => (
          <span key={`b${i}`} style={{ position: "absolute", left: `${(x / 350) * 100}%`, top: y, width: "12.5%", height: 34, borderRadius: 9, background: (profile.settings.colorblind ? TIER_COLORS_SAFE : TIER_COLORS)[c], color: "#0B0D1A", font: "800 15px var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center" }}>{n(v)}</span>
        ))}
        {trail.colors.length > 0 && path.map(([x, y], k) => {
          const c = trail.colors[k % trail.colors.length];
          return <span key={`t${k}`} style={{ position: "absolute", left: `${((x + 24) / 350) * 100}%`, top: y + 10, width: trail.sparkle ? 5 + (k % 2) * 3 : 6 + k, height: trail.sparkle ? 5 + (k % 2) * 3 : 6 + k, borderRadius: trail.sparkle ? 2 : 999, background: c, opacity: 0.2 + k * 0.13, boxShadow: `0 0 8px ${c}`, transform: "rotate(45deg)" }} />;
        })}
        <span style={{ position: "absolute", left: `${(238 / 350) * 100}%`, top: 118, width: 16, height: 16, borderRadius: 999, background: ball.stops.length > 2 || ball.stops[0] !== ball.stops[1] ? `radial-gradient(circle at 35% 35%, ${ball.stops.join(", ")})` : ball.stops[0], boxShadow: `0 0 10px ${ball.glow}${ball.rim ? `, 0 0 0 1.5px ${ball.rim}` : ""}` }} />
      </div>
      <div style={{ margin: "0 16px", flex: "none" }}>
        <Tabs label={t("bricksCustomize")} value={tab} onChange={setTab} options={[
          { value: "ball", label: t("bricksTabBalls") }, { value: "trail", label: t("bricksTabTrails") }, { value: "theme", label: t("bricksTabThemes") }, { value: "power", label: t("bricksTabPowers") },
        ]} />
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {tab === "power" ? POWER_ORDER.map((p) => (
            <ItemButton key={p} on={current === p} edge={current === p ? ACCENT : "#1E2138"} onClick={() => setSel({ ...sel, power: p })}
              name={t(`bricksPower_${p}` as TranslationKey)} state={`${t("bricksOwnN", { count: n(profile.inv[p]) })} · ${n(POWER_PRICE[p])}`} stateColor="var(--text-2)">
              <Svg d={POWER_ICON[p]} color={ACCENT} size={24} width={2.2} />
            </ItemButton>
          )) : list.map((x) => {
            const k = `${tab}:${x.id}`, own = profile.owned.includes(k), eq = profile.equipped[tab] === x.id;
            const state = eq ? t("bricksEquipped") : own ? t("bricksOwned") : t("bricksCoinsN", { coins: n(x.price) });
            return (
              <ItemButton key={x.id} on={current === x.id} edge={current === x.id ? ACCENT : eq ? "#2F4A22" : "#1E2138"} onClick={() => setSel({ ...sel, [tab]: x.id })}
                name={nameOf(tab, x.id)} state={state} stateColor={eq ? "#5BD69A" : own ? "var(--text-2)" : GOLD}
                swatch={tab === "theme" ? `linear-gradient(180deg, ${(x as typeof THEMES[number]).top}, ${(x as typeof THEMES[number]).bottom})` : undefined}>
                {tab === "ball" && (() => { const b = x as typeof BALLS[number]; return <span style={{ width: 18, height: 18, borderRadius: 999, background: b.stops.length > 2 || b.stops[0] !== b.stops[1] ? `radial-gradient(circle at 35% 35%, ${b.stops.join(", ")})` : b.stops[0], boxShadow: `0 0 8px ${b.glow}${b.rim ? `, 0 0 0 1.5px ${b.rim}` : ""}` }} />; })()}
                {tab === "trail" && (() => { const tr = x as typeof TRAILS[number]; return tr.colors.length ? [0, 1, 2, 3].map((j) => <span key={j} style={{ width: 10 - j * 2, height: 10 - j * 2, borderRadius: 999, background: tr.colors[j % tr.colors.length], boxShadow: `0 0 6px ${tr.colors[j % tr.colors.length]}`, opacity: 1 - j * 0.22 }} />) : <span style={{ width: 10, height: 10, borderRadius: 999, boxShadow: "inset 0 0 0 1.5px #3A3E5C" }} />; })()}
                {tab === "theme" && ["#FF9A62", "#4FC3F7", "#5BD69A"].map((c) => <span key={c} style={{ width: 8, height: 8, borderRadius: 3, background: c }} />)}
              </ItemButton>
            );
          })}
        </div>
      </div>
      <div className="screen__bar">
        <div className="row row--between" style={{ gap: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>{tab === "power" ? t(`bricksPower_${current}` as TranslationKey) : nameOf(tab, current)}</span>
          <span className="muted">{note}</span>
        </div>
        {tab === "power" && <div className="tiny muted">{t(`bricksPowerTip_${current}` as TranslationKey)}</div>}
        <button type="button" className={equipped ? "btn btn--outline" : "btn"} disabled={disabled} onClick={onAct}
          style={equipped ? { color: "#5BD69A", borderColor: "#2F4A22" } : disabled ? { background: "#1E2138", color: "var(--muted)" } : { background: ACCENT, color: INK, fontSize: 16 }}>
          {action}
        </button>
      </div>
    </Screen>
  );
}

function ItemButton({ on, edge, onClick, name, state, stateColor, swatch, children }: { on: boolean; edge: string; onClick: () => void; name: string; state: string; stateColor: string; swatch?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} aria-label={`${name} · ${state}`} onClick={() => { play("button"); onClick(); }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 4px 10px", borderRadius: 16, border: `2px solid ${edge}`, background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit" }}>
      <span style={{ width: 54, height: 40, borderRadius: 12, background: swatch ?? "#0D1024", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, overflow: "hidden" }}>{children}</span>
      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, textAlign: "center" }}>{name}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: stateColor, textAlign: "center" }}>{state}</span>
    </button>
  );
}

// ------------------------------------------------------------------ achievements and stats

const GROUP_ICON: Record<AchievementGroup, string> = {
  destruction: "M4 6h7v5H4zM13 6h7v5h-7zM8 13h8v5H8z", survival: "M4 12c2.5-4 5.5-4 8 0s5.5 4 8 0", balls: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  combo: "M13 2 4 14h7l-1 8 9-12h-7z", adventure: "M12 3l2.6 5.6 6 .6-4.5 4 1.3 6L12 16.2 6.6 19.2l1.3-6-4.5-4 6-.6z",
};

export function BricksTrophies({ initialTab }: { initialTab: "achievements" | "stats" }) {
  const { t, n, language } = useLanguage();
  const { back } = useBricksNav();
  const profile = useBricksProfile();
  useMenuMusic();
  const [tab, setTab] = useState(initialTab);
  const done = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;
  const groups: AchievementGroup[] = ["destruction", "survival", "balls", "combo", "adventure"];
  const date = (iso: string) => new Date(iso).toLocaleDateString(language === "fa" ? "fa-IR" : "en-GB", { day: "numeric", month: "short" });
  const s = profile.stats;
  const hours = Math.round(s.timeMs / 360_000) / 10;
  return (
    <Screen theme="night">
      <BricksHeader title={tab === "achievements" ? t("bricksAchievements") : t("bricksStats")}
        sub={tab === "achievements" ? t("bricksAchievementsSub", { done: n(done), total: n(ACHIEVEMENTS.length) }) : t("bricksStatsSub")}
        onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })} />
      <div style={{ margin: "4px 16px 10px", flex: "none" }}>
        <Tabs label={t("bricksTrophies")} value={tab} onChange={setTab} options={[{ value: "achievements", label: t("bricksAchievements") }, { value: "stats", label: t("bricksStats") }]} />
      </div>
      <div className="screen__body bricks-body" style={{ paddingTop: 0, gap: 14 }}>
        {tab === "achievements" ? groups.map((g) => (
          <section key={g} className="stack" style={{ gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{t(`bricksAchGroup_${g}` as TranslationKey)}</h2>
            {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
              const at = profile.achievements[a.id];
              const prog = Math.min(a.target, achievementProgress(profile, a));
              return (
                <div key={a.id} className="row" style={{ gap: 12, padding: 12, borderRadius: 16, background: "var(--surface)" }}>
                  <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: at ? "#3A2A16" : "#1E2138", color: at ? "#F0A83A" : "#5A5E7A", display: "flex", alignItems: "center", justifyContent: "center" }}><Svg d={GROUP_ICON[g]} size={20} width={2.2} /></span>
                  <div className="grow stack" style={{ gap: 5, minWidth: 0 }}>
                    <div className="row row--between" style={{ gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{t(`bricksAch_${a.id}` as TranslationKey)}</span>
                      <span className="num" style={{ fontSize: 12, fontWeight: 700, color: at ? "#5BD69A" : GOLD, whiteSpace: "nowrap" }}>{at ? "✓ " : ""}+{n(a.coins)}</span>
                    </div>
                    <div className="tiny muted">{t(`bricksAchDesc_${a.id}` as TranslationKey, { count: n(a.target) })}{at ? ` · ${t("bricksUnlockedOn", { date: date(at) })}` : ""}</div>
                    {!at && (
                      <div className="row" style={{ gap: 8 }}>
                        <div className="grow" style={{ height: 6, borderRadius: 999, background: "#262A44", overflow: "hidden" }}>
                          <div style={{ width: `${Math.round((prog / a.target) * 100)}%`, height: 6, borderRadius: 999, background: "#F0A83A" }} />
                        </div>
                        <span className="num tiny" style={{ color: "var(--text-2)", whiteSpace: "nowrap" }}>{n(prog)} / {n(a.target)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {[[s.bestScore, t("bricksStatBestScore"), GOLD], [s.bestRound, t("bricksStatBestRound"), ACCENT], [s.bestShot, t("bricksStatBestShot"), "#C3B9FF"], [s.bestCombo, t("bricksStatBestCombo"), "#5FD0BE"]].map(([v, l, c]) => (
                <div key={String(l)} style={{ padding: 14, borderRadius: 16, background: "var(--surface)" }}>
                  <div className="num" style={{ fontSize: 22, fontWeight: 800, color: String(c) }}>{n(Number(v))}</div>
                  <div className="tiny muted">{l}</div>
                </div>
              ))}
            </div>
            <div className="stack" style={{ borderRadius: 16, background: "var(--surface)", overflow: "hidden", gap: 0 }}>
              {([
                [t("bricksStatEndless"), n(s.endlessGames)], [t("bricksStatBricks"), n(s.bricks)], [t("bricksStatBalls"), n(s.balls)], [t("bricksStatShots"), n(s.shots)],
                [t("bricksStatLevels"), `${n(levelsDone(profile))} / ${n(LEVEL_COUNT)}`], [t("bricksStatStars"), `${n(starTotal(profile))} / ${n(LEVEL_COUNT * 3)}`],
                [t("bricksStatDailies"), n(s.dailies)], [t("bricksStatDailyStreak"), n(s.bestDailyStreak)],
                [t("bricksStatGolds"), `${n(profile.medals.filter((m) => m === 3).length)} / ${n(CHALLENGE_COUNT)}`], [t("bricksStatPowers"), n(s.powers)],
                [t("bricksStatCoins"), n(s.coinsEarned)], [t("bricksStatTime"), t("bricksHours", { hours: n(hours) })],
              ] as const).map(([l, v]) => (
                <div key={l} className="row row--between" style={{ gap: 8, padding: "12px 14px", borderBottom: "1px solid #1E2138", fontSize: 14 }}>
                  <span style={{ color: "var(--text-2)" }}>{l}</span>
                  <span className="num" style={{ fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

// ------------------------------------------------------------------ settings

export function BricksSettings() {
  const { t, n, language } = useLanguage();
  const { back } = useBricksNav();
  const { push } = useNavigation();
  const { profile: hubProfile } = useHub();
  const profile = useBricksProfile();
  useMenuMusic();
  const s = profile.settings;
  const [tipsReset, setTipsReset] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const word = t("bricksResetWord");
  const ok = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
  const set = (patch: Partial<Settings>) => {
    setSettings(patch);
    const next = { ...s, ...patch };
    setVolumes(next.sound, next.music);
  };

  return (
    <Screen theme="night">
      <BricksHeader title={t("bricksSettings")} sub={t("bricksSettingsSub")} onBack={back} backLabel={t("backToGame", { game: t("gameBricks") })} />
      <div className="screen__body bricks-body" style={{ paddingTop: 8, gap: 16 }}>
        <Group title={t("bricksSetSound")}>
          <SliderRow label={t("bricksMusic")} value={s.music} onChange={(v) => set({ music: v })} display={n(s.music)} />
          <SliderRow label={t("bricksSoundEffects")} value={s.sound} onChange={(v) => set({ sound: v })} display={n(s.sound)} />
          <ToggleRow label={t("bricksVibration")} hint={t("bricksVibrationHint")} on={s.vibration} onChange={(v) => set({ vibration: v })} />
        </Group>
        <Group title={t("bricksSetDisplay")}>
          <Row label={t("bricksLanguage")} hint={t("bricksLanguageHint")}>
            <button type="button" className="btn btn--outline" style={{ width: "auto", minHeight: 40, padding: "0 12px", fontSize: 13 }} onClick={() => push({ name: "profile" })}>{language === "fa" ? "فارسی" : "English"}</button>
          </Row>
          <SegmentRow label={t("bricksTrailIntensity")} value={s.trail} onChange={(v) => set({ trail: v })} />
          <SegmentRow label={t("bricksParticles")} value={s.particles} onChange={(v) => set({ particles: v })} />
          <ToggleRow label={t("bricksColorblind")} hint={t("bricksColorblindHint")} on={s.colorblind} onChange={(v) => set({ colorblind: v })} />
          <div dir="ltr" className="row" style={{ gap: 6, padding: "0 14px 12px" }} aria-hidden="true">
            {[3, 8, 15, 30, 60, 120, 240].map((v, i) => {
              const c = (s.colorblind ? TIER_COLORS_SAFE : TIER_COLORS)[i];
              return <span key={v} className="grow" style={{ height: 34, borderRadius: 8, background: c, color: i === 2 && s.colorblind ? "#FFFFFF" : "#0B0D1A", font: "800 13px var(--font-display)", display: "flex", alignItems: "center", justifyContent: "center" }}>{n(v)}</span>;
            })}
          </div>
          <ToggleRow label={t("bricksReducedMotion")} hint={t("bricksReducedMotionHint")} on={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        </Group>
        <Group title={t("bricksSetGameplay")}>
          <ToggleRow label={t("bricksAimGuide")} hint={t("bricksAimGuideHint")} on={s.guide} onChange={(v) => set({ guide: v })} />
          <ToggleRow label={t("bricksConfirmRestart")} on={s.confirm} onChange={(v) => set({ confirm: v })} />
          <Row label={t("bricksTips")} hint={tipsReset ? t("bricksTipsAgain") : t("bricksTipsHint")}>
            <button type="button" className="btn btn--outline" style={{ width: "auto", minHeight: 40, padding: "0 12px", fontSize: 13, color: tipsReset ? "#5BD69A" : undefined }} onClick={() => { resetTips(); setTipsReset(true); }}>
              {tipsReset ? t("bricksDone") : t("bricksShowAgain")}
            </button>
          </Row>
        </Group>
        <Group title={t("bricksSetRankings")}>
          <ToggleRow label={t("bricksRanked")} hint={t("bricksRankedHint")} on={s.ranked} onChange={(v) => set({ ranked: v })} />
          {s.ranked && (
            <Row label={t("bricksRankName")} hint={hubProfile?.name ?? ""}>
              <button type="button" className="btn btn--outline" style={{ width: "auto", minHeight: 40, padding: "0 12px", fontSize: 13 }} onClick={() => push({ name: "profile" })}>{t("bricksChangeName")}</button>
            </Row>
          )}
        </Group>
        <button type="button" className="btn btn--outline" style={{ color: "#FF5C7A", borderColor: "#5A2030" }} onClick={() => { setTyped(""); setConfirm(true); }}>{t("bricksReset")}</button>
      </div>
      {confirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(6,7,16,0.78)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div role="alertdialog" aria-modal="true" aria-label={t("bricksResetTitle")} className="stack" style={{ gap: 12, padding: "22px 16px calc(26px + env(safe-area-inset-bottom))", borderRadius: "26px 26px 0 0", background: "#151829", maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
            <h2 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{t("bricksResetTitle")}</h2>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-2)" }}>{t("bricksResetBody")}</div>
            <label className="stack" style={{ gap: 6, fontSize: 13, color: "var(--muted)" }}>
              <span>{t("bricksTypeToConfirm", { word })}</span>
              <input className="input" type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" style={{ minHeight: 46 }} />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--outline" style={{ flex: 1 }} onClick={() => setConfirm(false)}>{t("bricksCancel")}</button>
              <button type="button" className="btn" disabled={!ok} style={{ flex: 1, background: ok ? "#FF5C7A" : "#3A1420", color: ok ? "#1A0608" : "#7A4050" }}
                onClick={() => { resetProgress(); setConfirm(false); play("button"); }}>
                {t("bricksResetGo")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{title}</h2>
      <div className="stack" style={{ gap: 0, borderRadius: 18, background: "var(--surface)", overflow: "hidden" }}>{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="row" style={{ gap: 12, padding: "12px 14px", borderBottom: "1px solid #1E2138" }}>
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => { play("button"); onChange(!on); }}
        style={{ position: "relative", width: 52, height: 32, flex: "none", borderRadius: 999, border: 0, background: on ? ACCENT : "#3A3E5C", cursor: "pointer", padding: 0 }}>
        <span style={{ position: "absolute", top: 4, insetInlineStart: on ? 24 : 4, width: 24, height: 24, borderRadius: 999, background: "#FFFFFF", transition: "inset-inline-start 160ms" }} />
      </button>
    </Row>
  );
}

function SliderRow({ label, value, onChange, display }: { label: string; value: number; onChange: (v: number) => void; display: string }) {
  return (
    <div className="stack" style={{ gap: 8, padding: "12px 14px", borderBottom: "1px solid #1E2138" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div className="row" style={{ gap: 12 }}>
        <input type="range" min={0} max={100} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1, accentColor: ACCENT }} />
        <span className="num" style={{ width: 34, textAlign: "end", fontSize: 13, color: "var(--text-2)" }}>{display}</span>
      </div>
    </div>
  );
}

function SegmentRow({ label, value, onChange }: { label: string; value: 0 | 1 | 2; onChange: (v: 0 | 1 | 2) => void }) {
  const { t } = useLanguage();
  return (
    <div className="stack" style={{ gap: 10, padding: "12px 14px", borderBottom: "1px solid #1E2138" }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
      <div role="radiogroup" aria-label={label} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4, padding: 4, borderRadius: 12, background: "#10122A" }}>
        {([0, 1, 2] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => { play("button"); onChange(v); }}
            style={{ minHeight: 40, borderRadius: 9, border: 0, background: value === v ? "#EDEBF5" : "transparent", color: value === v ? "#0B0D1A" : "var(--text-2)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {t(v === 0 ? "bricksOff" : v === 1 ? "bricksLow" : "bricksFull")}
          </button>
        ))}
      </div>
    </div>
  );
}
