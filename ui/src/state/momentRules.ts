// What is happening in the game right now, as one word every piece and style can react to, and
// the rules a piece can be shown under. Kept free of signals and IPC so it can be tested.
import type { Phase } from "~/bindings/Phase";

export const MOMENT_IDS = ["offline", "idle", "party", "queueing", "match-found", "agent-select", "in-game", "post-match"] as const;
export type GameMoment = (typeof MOMENT_IDS)[number];

/** When a piece is on screen: always, or only at some moments. */
export const SHOW_WHEN_IDS = ["always", "queueing", "not-queueing", "party", "solo"] as const;
export type ShowWhen = (typeof SHOW_WHEN_IDS)[number];

export const SHOW_WHEN_OPTIONS: readonly { value: ShowWhen; label: string }[] = [
  { value: "always", label: "Always" },
  { value: "queueing", label: "While searching" },
  { value: "not-queueing", label: "When not searching" },
  { value: "party", label: "In a party" },
  { value: "solo", label: "Playing solo" },
];

export interface MomentInput {
  isConnected: boolean;
  phase: Phase | undefined;
  isQueueing: boolean;
  partySize: number;
  isShowingSummary: boolean;
  /** The few seconds after a match is found, before agent select takes over the screen. */
  isMatchJustFound: boolean;
}

/** The one moment that describes the game now; later stages of a match win over the menus. */
export function momentOf(input: MomentInput): GameMoment {
  if (!input.isConnected) return "offline";
  if (input.phase === "ingame") return "in-game";
  if (input.phase === "pregame") return input.isMatchJustFound ? "match-found" : "agent-select";
  if (input.isShowingSummary) return "post-match";
  if (input.isQueueing) return "queueing";
  return input.partySize > 1 ? "party" : "idle";
}

/** Whether a piece with `rule` shows at `moment`; party rules read the party, not the moment,
 *  so a party that is searching still counts as a party. */
export function isShownAt(rule: ShowWhen, moment: GameMoment, partySize: number): boolean {
  switch (rule) {
    case "always":
      return true;
    case "queueing":
      return moment === "queueing";
    case "not-queueing":
      return moment !== "queueing";
    case "party":
      return partySize > 1;
    case "solo":
      return partySize <= 1;
  }
}

export function isShowWhen(value: unknown): value is ShowWhen {
  return typeof value === "string" && (SHOW_WHEN_IDS as readonly string[]).includes(value);
}
