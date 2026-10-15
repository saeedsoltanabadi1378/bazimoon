import { useEffect, useRef, useState } from "react";
import { GameProvider, useGame } from "./GameProvider";
import { VoiceProvider } from "./VoiceProvider";
import { LobbyScreen } from "./LobbyScreen";
import { RoleRevealScreen } from "./RoleRevealScreen";
import { FirstNightScreen } from "./FirstNightScreen";
import { NightScreen } from "./NightScreen";
import { DayScreen } from "./DayScreen";
import { VotingScreen } from "./VotingScreen";
import { ResultsScreen } from "./ResultsScreen";
import { GameOverScreen } from "./GameOverScreen";
import { LoadingScreen, StateScreen } from "../app/StateScreen";
import { useNavigation } from "../app/router";
import { useLanguage } from "../i18n/LanguageContext";
import { readLocal, writeLocal } from "../lib/storage";

export function MafiaRoute({ gameId }: { gameId: string }) {
  // Keyed so a rematch (new gameId) starts from a clean provider and voice session.
  return (
    <GameProvider key={gameId} gameId={gameId}>
      <VoiceProvider>
        <PhaseRouter />
      </VoiceProvider>
    </GameProvider>
  );
}

const revealKey = (gameId: string) => `nightfall-revealed-${gameId}`;

function PhaseRouter() {
  const { status, view, gameId, refresh } = useGame();
  const { t } = useLanguage();
  const { reset } = useNavigation();
  const [revealed, setRevealed] = useState(() => readLocal<boolean>(revealKey(gameId), false));
  const [verdictFirst, setVerdictFirst] = useState(false);
  const lastPhase = useRef(view?.phase);

  // When the town's vote ends the game, show the verdict before the final results (design flow).
  useEffect(() => {
    const phase = view?.phase;
    if (lastPhase.current === "Voting" && phase === "Ended") setVerdictFirst(true);
    lastPhase.current = phase;
  }, [view?.phase]);

  if (status === "loading") return <LoadingScreen label={t("loadingGame")} />;
  if (status === "not-found") {
    return <StateScreen state="not-found" primaryLabel={t("backToHome")} onPrimary={() => reset({ name: "home" })} />;
  }
  if (status === "error" || !view) {
    return (
      <StateScreen
        state="error"
        primaryLabel={t("tryAgain")}
        onPrimary={() => void refresh()}
        secondaryLabel={t("backToHome")}
        onSecondary={() => reset({ name: "home" })}
      />
    );
  }

  switch (view.phase) {
    case "Lobby":
    case "RoleAssignment":
      return <LobbyScreen />;
    case "NightZero":
      if (!revealed && view.yourRole) {
        return (
          <RoleRevealScreen
            onReady={() => {
              writeLocal(revealKey(gameId), true);
              setRevealed(true);
            }}
          />
        );
      }
      return <FirstNightScreen />;
    case "Night":
      return <NightScreen />;
    case "Day":
      return <DayScreen />;
    case "Voting":
      return <VotingScreen />;
    case "Results":
      return <ResultsScreen />;
    case "Ended":
      return verdictFirst && view.lastVotingElimination ? <ResultsScreen onSeeFinal={() => setVerdictFirst(false)} /> : <GameOverScreen />;
  }
}
