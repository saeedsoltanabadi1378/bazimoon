import { Fragment, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { Body, ProgressBar, Screen, Segmented, Stat } from "../ui/components";
import { Icon } from "../ui/Icon";
import { TabBar } from "../ui/TabBar";
import { useHub, useLoad } from "./HubData";
import { roman } from "./HomeScreen";
import type { LeagueRow } from "../api/hub";
import { useNavigation } from "../app/router";

const rowColors = ["#5FD0BE", "#B79CF2", "#F0A83A", "#F2EEE6", "#8FA8FF", "#E9D8A6", "#F08A7A", "#9ED98C", "#F2B8D0", "#C9C2B6"];

const zoneStyle = {
  promotion: { bg: "#13302C", fg: "#5FD0BE" },
  safe: { bg: "#151820", fg: "#9CA3B4" },
  relegation: { bg: "#3A1C1A", fg: "#F08A7A" },
};

export function LeagueScreen() {
  const { t, n } = useLanguage();
  const { api } = useHub();
  const { push } = useNavigation();
  const [board, setBoard] = useState<"mafia" | "puzzles">("puzzles");
  const [scope, setScope] = useState<"division" | "friends">("division");
  const { data, loading, error, reload } = useLoad(() => api.league(board, scope), [api, board, scope]);
  const mafia = board === "mafia";
  const friends = scope === "friends";

  const unranked = data && data.you.rank === null && !friends;
  const remaining = data ? Math.max(0, data.qualification.needed - data.qualification.played) : 0;

  return (
    <Screen theme="hub">
      <Body style={{ padding: "16px 16px 20px" }}>
        <header className="stack" style={{ gap: 4 }}>
          <span className="small muted">
            {data ? t("seasonEnds", { season: data.season, days: data.daysLeft }) : " "}
          </span>
          <div className="row row--between">
            <h1 className="h1">{friends ? t("leagueFriendsTitle") : data ? `${t(`division${data.division}` as "divisionGold")} ${roman(data.tier)}` : t("tabLeague")}</h1>
            {data && (
              <span className="pill" style={{ background: "#2A2113", color: "#F0A83A" }}>
                <Icon name="trophy" size={16} />
                {t("playersCount", { count: data.playerCount })}
              </span>
            )}
          </div>
        </header>

        <Segmented
          label={`${t("leagueScopeDivision")} / ${t("leagueScopeFriends")}`}
          value={scope}
          onChange={setScope}
          options={[{ value: "division", label: t("leagueScopeDivision") }, { value: "friends", label: t("leagueScopeFriends") }]}
        />

        <Segmented
          role="tablist"
          soft
          label={t("tabLeague")}
          value={board}
          onChange={setBoard}
          options={[{ value: "puzzles", label: t("sectionPuzzles") }, { value: "mafia", label: t("sectionMafia") }]}
        />

        {error && (
          <div className="card stack center">
            <p className="soft small">{t("genericError")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={reload}>{t("tryAgain")}</button>
          </div>
        )}

        {unranked && (
          <div className="stack" style={{ gap: 8, padding: 14, borderRadius: 16, background: "#1E2138", border: "1px dashed #3A3F52" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t("notRankedYet")}</div>
            <div className="small" style={{ color: "#C9C8DC" }}>
              {mafia
                ? t("qualifyMafia", { left: remaining, played: data!.qualification.played, needed: data!.qualification.needed })
                : t("qualifyPuzzles", { left: remaining })}
            </div>
            <ProgressBar value={(data!.qualification.played / data!.qualification.needed) * 100} track="#2B3042" />
          </div>
        )}

        {data && (
          <div className="stat-grid">
            <Stat large label={t("yourRank")} value={data.you.rank ? `#${n(data.you.rank)}` : "—"} />
            <Stat large label={mafia ? t("rating") : t("points")} value={n(data.you.score, { useGrouping: !mafia })} />
            <Stat large label={mafia ? t("winRate") : t("streak")} value={mafia ? `${n(data.you.third)}%` : t("daysShort", { count: data.you.third })} />
          </div>
        )}

        {loading && !data && <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />}

        {data && data.rows.length > 0 && (
          <section className="list" aria-label={t("standings")}>
            {data.rows.map((row, i) => {
              const prev = data.rows[i - 1];
              const showZone = !prev || prev.zone !== row.zone || prev.rank + 1 !== row.rank;
              return (
                <Fragment key={`${row.rank}-${row.name}`}>
                  {!friends && showZone && (!prev || prev.zone !== row.zone) && (
                    <div style={{ padding: "8px 14px", background: zoneStyle[row.zone].bg, color: zoneStyle[row.zone].fg, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                      {t(`zoneTitle_${row.zone}`)}
                    </div>
                  )}
                  <Row row={row} color={rowColors[i % rowColors.length]} mafia={mafia} />
                </Fragment>
              );
            })}
          </section>
        )}

        {data && data.rows.length === 0 && !unranked && !friends && <p className="small muted">{t("leagueEmpty")}</p>}

        {friends && data && data.playerCount <= 1 && (
          <div className="card stack center" style={{ gap: 12 }}>
            <p className="small muted" style={{ textAlign: "center" }}>{t("leagueFriendsEmpty")}</p>
            <button type="button" className="btn btn--outline btn--pill" onClick={() => push({ name: "friends" })}>{t("inviteAddFriends")}</button>
          </div>
        )}

        <p className="small muted">{friends ? t("leagueFriendsRules") : t("leagueRules", { needed: data?.qualification.needed ?? 15 })}</p>
      </Body>
      <TabBar />
    </Screen>
  );
}

function Row({ row, color, mafia }: { row: LeagueRow; color: string; mafia: boolean }) {
  const { t, n } = useLanguage();
  const down = row.delta < 0;
  const sub = mafia
    ? t("gamesWinRate", { games: row.games, rate: row.winRateOrStreak })
    : t("streakDays", { count: row.winRateOrStreak });
  const delta = `${row.delta > 0 ? "+" : ""}${n(row.delta)}`;
  return (
    <div className="list__row" style={{ gap: 10, background: row.isYou ? "#2A2113" : "transparent", borderTopColor: "#232734" }}>
      <span className="num" style={{ width: 22, fontSize: 14, fontWeight: 600, color: row.isYou ? "#F0A83A" : "var(--muted)" }}>{n(row.rank)}</span>
      <span className="avatar" aria-hidden="true" style={{ width: 32, height: 32, fontSize: 13, background: color, color: "#101218" }}>{Array.from(row.name)[0]?.toUpperCase()}</span>
      <div className="grow">
        <div style={{ fontSize: 15, fontWeight: 600 }}>{row.isYou ? t("you") : row.name}</div>
        <div className="tiny muted">{sub}</div>
      </div>
      <div style={{ textAlign: "end" }}>
        <div className="num" style={{ fontSize: 15, fontWeight: 700 }}>{n(row.score, { useGrouping: !mafia })}</div>
        <div className="tiny" style={{ color: down ? "#F08A7A" : "#5FD0BE" }}>{mafia ? delta : t("thisWeek", { delta })}</div>
      </div>
    </div>
  );
}
