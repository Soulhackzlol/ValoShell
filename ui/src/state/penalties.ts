// Account restrictions (queue bans, delays, ranked or chat limits): read at start, on connect,
// after every match and whenever starting the queue fails, so the menu can say why it failed.
import { createSignal } from "solid-js";
import type { PenaltyView } from "~/bindings/PenaltyView";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";

const [penalties, setPenalties] = createSignal<PenaltyView[]>([]);
/** The answer the player dismissed; the notice returns with the next answer. */
const [dismissedPenalties, setDismissedPenalties] = createSignal<readonly PenaltyView[] | null>(null);

export { penalties };

export function isPenaltyNoticeDismissed(): boolean {
  return dismissedPenalties() === penalties();
}

export function dismissPenaltyNotice(): void {
  setDismissedPenalties(penalties());
}

/** Read the restrictions again; a failed read keeps the last answer. */
export async function refreshPenalties(): Promise<void> {
  try {
    setPenalties(await call("get_penalties", {}));
  } catch (error) {
    // Only a hint: queueing still reports its own failure, so this never blocks anything.
    console.warn("penalties_read_failed", error);
  }
}

// Events are not replayed, so a webview that starts after the connection reads once itself.
void refreshPenalties();

let lastPhase = "";
onAppEvent("game_state", (snapshot) => {
  if (snapshot.phase === "menus" && lastPhase === "ingame") void refreshPenalties();
  lastPhase = snapshot.phase;
});
onAppEvent("connection", (status) => {
  if (status.state === "connected") void refreshPenalties();
  else setPenalties([]);
});
