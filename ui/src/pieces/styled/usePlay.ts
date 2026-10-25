// Queue state and actions shared by the styled play panels (CS2, CS:GO, Beta), so each look
// only decides how it draws: same rules as the main PLAY bar (owner picks the mode and starts,
// others toggle ready, dodge penalty blocks the button).
import { createSignal, onCleanup } from "solid-js";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { formatClock, isPartyBusy, party, partyActions, queueElapsedSeconds } from "~/state/party";

export interface PlayState {
  queues: () => QueueOption[];
  current: () => QueueOption | null;
  isOwner: () => boolean;
  isReady: () => boolean;
  /** Search time as `0:42`, or null when not queueing. */
  searchClock: () => string | null;
  /** Dodge penalty as `2:10`, or null when free. */
  penaltyClock: () => string | null;
  canStart: () => boolean;
  partySize: () => number;
  maxSize: () => number;
  pickQueue: (queue: QueueOption) => void;
  /** PLAY for the owner, ready toggle for the others, cancel while searching. */
  press: () => void;
}

export function usePlay(): PlayState {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => window.clearInterval(timer));

  // Only a queueing party reads the clock, so idle panels don't re-render every second.
  const elapsed = () => (party()?.is_queueing ? queueElapsedSeconds(party(), now()) : null);
  const isOwner = () => party()?.is_owner ?? false;
  const self = () => party()?.members.find((member) => member.is_self);
  const restricted = () => party()?.restricted_seconds ?? 0;

  return {
    queues: () => party()?.eligible_queues ?? [],
    current: () => party()?.queue ?? null,
    isOwner,
    isReady: () => self()?.is_ready ?? false,
    searchClock: () => {
      const seconds = elapsed();
      return seconds === null ? null : formatClock(seconds);
    },
    penaltyClock: () => (restricted() > 0 ? formatClock(restricted()) : null),
    canStart: () => party() !== null && !isPartyBusy() && restricted() === 0,
    partySize: () => party()?.members.length ?? 0,
    maxSize: () => party()?.max_size ?? 5,
    pickQueue: (queue) => {
      if (isPartyBusy() || !isOwner() || party()?.is_queueing || queue.id === party()?.queue.id) return;
      playCue("tab");
      void partyActions.changeQueue(queue.id);
    },
    press: () => {
      if (isPartyBusy()) return;
      if (party()?.is_queueing) {
        void partyActions.stopQueue();
      } else if (!isOwner()) {
        playCue("confirm");
        void partyActions.setReady(!(self()?.is_ready ?? false));
      } else if (party()?.is_custom_game) {
        playCue("confirm");
        void partyActions.startCustom();
      } else {
        void partyActions.startQueue();
      }
    },
  };
}

/** VALORANT tiers run 3 (Iron 1) to 27 (Radiant); 0-2 are unranked. */
const FIRST_TIER = 3;
const TIER_SPAN = 25;

/** 0..1 position on the ladder from tier and RR, for styles that show a single number. */
export function ladderPosition(tier: number, rr: number): number {
  if (tier < FIRST_TIER) return 0;
  const steps = (tier - FIRST_TIER) * 100 + Math.min(100, Math.max(0, rr));
  return Math.min(1, steps / (TIER_SPAN * 100));
}
