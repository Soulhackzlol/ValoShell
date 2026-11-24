// Data shared by every style's own Rank and Profile looks, so each look only decides how it
// draws: the rank reads the same career answer as the standard rank card (unrated and
// placements handled once, here), and the profile is your own party line.
import { onMount } from "solid-js";
import type { CareerView } from "~/bindings/CareerView";
import type { MemberView } from "~/bindings/MemberView";
import { party } from "~/state/party";
import { ownRiotId } from "~/state/session";
import { careerView } from "~/state/views";

/** Iron 1; below it Riot sends placeholders, not a rank. */
const FIRST_RATED_TIER = 3;
/** Immortal 1 and up count RR without a 100 cap. */
const UNCAPPED_TIER = 24;
const RR_PER_TIER = 100;

/** Whether the career shows a real rank: rated tier and placements done. */
export function isRated(view: CareerView): boolean {
  return view.rank.tier >= FIRST_RATED_TIER && view.placements_left === 0;
}

/** RR through the current tier, 0..1; uncapped tiers show a full bar. */
export function rankProgress(view: CareerView): number {
  if (view.rank.tier >= UNCAPPED_TIER) return 1;
  return Math.min(Math.max(view.rr / RR_PER_TIER, 0), 1);
}

/** The rank's name, or "Unrated" until placements are done. */
export function rankLabel(view: CareerView): string {
  return isRated(view) ? view.rank.name : "Unrated";
}

/** "37 / 100 RR", "412 RR" from Immortal up, or the placements still to play. */
export function rrText(view: CareerView): string {
  if (!isRated(view)) return `${view.placements_left} placements left`;
  return view.rank.tier >= UNCAPPED_TIER ? `${view.rr} RR` : `${view.rr} / ${RR_PER_TIER} RR`;
}

/** The career, read once when a rank look first shows. */
export function useRank(): () => CareerView | null {
  onMount(() => {
    if (!careerView.value() && !careerView.isLoading()) void careerView.load();
  });
  return () => careerView.value() ?? null;
}

/** What a rank look says while there is no career yet. */
export function rankPending(): string {
  return careerView.isLoading() ? "Loading rank…" : "Rank shows once VALORANT is open";
}

export interface Profile {
  member: () => MemberView | undefined;
  name: () => string;
  tag: () => string;
  level: () => number;
}

/** You, from your party line, with the Riot ID as a fallback before the party is read. */
export function useProfile(): Profile {
  const member = () => party()?.members.find((entry) => entry.is_self);
  return {
    member,
    name: () => member()?.game_name || ownRiotId()?.name || "Player",
    tag: () => member()?.tag_line || ownRiotId()?.tag || "",
    level: () => member()?.account_level ?? 0,
  };
}
