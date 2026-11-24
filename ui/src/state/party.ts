// The party lobby and its actions. Mutations go to the backend; the new party arrives as an
// event, so the UI never guesses the result.
import { createMemo, createRoot, createSignal } from "solid-js";
import type { PartyView } from "~/bindings/PartyView";
import type { RankBadge } from "~/bindings/RankBadge";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { playCue } from "~/menu/sound";
import { preloadArt } from "~/ui/Art";
import { refreshPenalties } from "./penalties";
import { attempt, pushToast } from "./toasts";
import { careerView } from "./views";

/**
 * Riot's party record carries a member's rank in ranked queues only (tier 0 in Swiftplay,
 * Unrated...), so your own badge comes from your career when the party has none for you.
 */
export function withOwnRank(view: PartyView | null, own: RankBadge | undefined): PartyView | null {
  if (!view || !own || own.tier === 0) return view;
  const members = view.members.map((member) => (member.is_self && member.rank.tier === 0 ? { ...member, rank: own } : member));
  return { ...view, members };
}

const [partyView, setPartyView] = createSignal<PartyView | null>(null);
const party = createRoot(() => createMemo(() => withOwnRank(partyView(), careerView.value()?.rank)));
/** Card art starts downloading as soon as the party arrives, not when a banner mounts. */
const setParty = (next: PartyView | null) => {
  preloadArt(next?.members.flatMap((member) => [member.card_tall, member.card_small, member.card_wide]) ?? []);
  setPartyView(next);
  const self = next?.members.find((member) => member.is_self);
  if (self?.rank.tier === 0 && !careerView.value() && !careerView.isLoading()) void careerView.load();
};
const [pending, setPending] = createSignal(0);
const isBusy = () => pending() > 0;
/** A request that hangs must not lock every party button: busy ends after this long. */
const BUSY_LIMIT_MS = 12_000;
/** Riot's party record trails the return to the menus; read it again after this. */
const SETTLE_AFTER_MATCH_MS = 3_000;

/** Background refreshes fail quietly for the player (the next event retries) but not for the log. */
const logFailure = (what: string) => (error: unknown) => console.warn(`${what}_failed`, error);

onAppEvent("party", (next) => setParty(next));
onAppEvent("connection", (status) => {
  if (status.state === "connected") void call("party_refresh", {}).then(setParty, logFailure("party_refresh"));
  else setParty(null);
});
void call("get_party", {}).then((current) => current && setParty(current), logFailure("get_party"));

// Back from a match: ask for the party now and again once Riot has caught up, so a stale
// "searching" party or an old party id never outlives the game.
let lastPhase: string | undefined;
onAppEvent("game_state", (snapshot) => {
  const phase = snapshot?.phase;
  if (phase === "menus" && lastPhase !== undefined && lastPhase !== "menus") {
    const refresh = () => void call("party_refresh", {}).then(setParty, logFailure("party_refresh"));
    refresh();
    window.setTimeout(refresh, SETTLE_AFTER_MATCH_MS);
  }
  lastPhase = phase;
});

export { party, isBusy as isPartyBusy };

async function run(action: () => Promise<unknown>, failure: string): Promise<boolean> {
  let isCounted = true;
  const release = () => {
    if (!isCounted) return;
    isCounted = false;
    setPending((count) => Math.max(0, count - 1));
  };
  setPending((count) => count + 1);
  const watchdog = window.setTimeout(release, BUSY_LIMIT_MS);
  try {
    return await attempt(action, failure);
  } finally {
    window.clearTimeout(watchdog);
    release();
  }
}

export const partyActions = {
  changeQueue: (queueId: string) => run(() => call("party_change_queue", { queueId }), "Queue not changed"),
  async startQueue() {
    playCue("confirm");
    const isStarted = await run(() => call("party_start_queue", {}), "Could not start the queue");
    // A queue ban is the usual reason; the restriction notice then says until when.
    if (!isStarted) void refreshPenalties();
    return isStarted;
  },
  async stopQueue() {
    playCue("back");
    return run(() => call("party_stop_queue", {}), "Could not cancel the queue");
  },
  setReady: (isReady: boolean) => run(() => call("party_set_ready", { isReady }), "Ready state not changed"),
  setOpen: (isOpen: boolean) => run(() => call("party_set_open", { isOpen }), "Party access not changed"),
  async invite(riotId: string) {
    const isSent = await run(() => call("party_invite", { riotId }), "Invite not sent");
    if (isSent) pushToast("positive", "Invite sent", riotId);
    return isSent;
  },
  kick: (puuid: string) => run(() => call("party_kick", { puuid }), "Player not removed"),
  leave: () => run(() => call("party_leave", {}), "Could not leave the party"),
  generateCode: () => run(() => call("party_generate_code", {}), "No party code"),
  joinCode: (code: string) => run(() => call("party_join_code", { code }), "Could not join"),
  changeTeam: (team: "attackers" | "defenders" | "spectators", puuid: string) =>
    run(() => call("party_change_team", { team, puuid }), "Could not change team"),
  startCustom: () => run(() => call("party_start_custom", {}), "Could not start the game"),
  /**
   * The owner's PLAY: the custom game in a custom lobby, otherwise the search. Riot refuses
   * matchmaking while the party is in custom setup ("cannot enter matchmaking with party's
   * current state", HTTP 400).
   */
  async start() {
    if (!party()?.is_custom_game) return partyActions.startQueue();
    playCue("confirm");
    return partyActions.startCustom();
  },
};

/** Seconds since the search started, or null when not queueing. */
export function queueElapsedSeconds(view: PartyView | null, now: number): number | null {
  if (!view?.is_queueing || !view.queue_entry_time) return null;
  const started = Date.parse(view.queue_entry_time);
  return Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
