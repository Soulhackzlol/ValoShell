// The game moment now (momentRules.ts), read from the live connection, party, game and summary.
// The menu shell writes it on the root as data-moment so every style's CSS can react to it.
import { createSignal } from "solid-js";
import { onAppEvent } from "~/ipc/events";
import { type GameMoment, momentOf } from "./momentRules";
import { party } from "./party";
import { postMatch } from "./postMatch";
import { connection, game } from "./session";

/** How long "match found" lasts before agent select takes over, as the client's splash does. */
const MATCH_FOUND_MS = 4000;

const [isMatchJustFound, setMatchJustFound] = createSignal(false);
let lastPhase: string | undefined;
let foundTimer = 0;

onAppEvent("game_state", (snapshot) => {
  const phase = snapshot?.phase;
  if (phase === "pregame" && lastPhase !== "pregame") {
    setMatchJustFound(true);
    window.clearTimeout(foundTimer);
    foundTimer = window.setTimeout(() => setMatchJustFound(false), MATCH_FOUND_MS);
  }
  if (phase !== "pregame") setMatchJustFound(false);
  lastPhase = phase;
});

/** The moment now; reactive where it is read. */
export function moment(): GameMoment {
  const summary = postMatch();
  return momentOf({
    isConnected: connection().state === "connected",
    phase: game()?.phase,
    isQueueing: party()?.is_queueing ?? false,
    partySize: party()?.members.length ?? 0,
    isShowingSummary: summary !== null && !summary.is_seen,
    isMatchJustFound: isMatchJustFound(),
  });
}

/** Players in the party now (1 when solo or offline). */
export function partySize(): number {
  return Math.max(1, party()?.members.length ?? 1);
}
