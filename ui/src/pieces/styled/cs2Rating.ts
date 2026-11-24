// CS2's Premier rating, made from VALORANT's rank and RR so the CS2 style can show a rating
// badge (Rank look) and a rating history (Career look) from the same number.
import type { CareerView } from "~/bindings/CareerView";
import type { RrUpdate } from "~/bindings/RrUpdate";

const RATING_FLOOR = 1000;
const RATING_SPAN = 32000;
/** Tiers 0-2 are Unranked and two unused ones; 3 (Iron 1) to 27 (Radiant) are the ladder. */
const FIRST_RATED_TIER = 3;
const TIER_SPAN = 25;
const RR_PER_TIER = 100;
/** CS2's colour bands by rating, lowest first. */
const BANDS: readonly [number, string][] = [
  [0, "#b0c3d9"],
  [5000, "#8cc6ff"],
  [10000, "#6a7dff"],
  [15000, "#c166ff"],
  [20000, "#f03cff"],
  [25000, "#eb4b4b"],
  [30000, "#fed700"],
];
/** The badge's colour while there is no rating yet. */
export const UNRATED_BAND = "#5b6370";

/** Whether the player has a rating: ranked and done with placements. */
export function isRated(view: CareerView): boolean {
  return view.rank.tier >= FIRST_RATED_TIER && view.placements_left === 0;
}

/** 0..1 position on the ladder from tier and RR. */
function ladderPosition(tier: number, rr: number): number {
  if (tier < FIRST_RATED_TIER) return 0;
  const steps = (tier - FIRST_RATED_TIER) * RR_PER_TIER + Math.min(RR_PER_TIER, Math.max(0, rr));
  return Math.min(1, steps / (TIER_SPAN * RR_PER_TIER));
}

/** The rank and RR as one number on CS2's scale (1,000 to 33,000). */
export function cs2Rating(tier: number, rr: number): number {
  return Math.round(RATING_FLOOR + ladderPosition(tier, rr) * RATING_SPAN);
}

/** The colour CS2 gives a rating. */
export function bandColor(rating: number): string {
  let color = BANDS[0]?.[1] ?? "#b0c3d9";
  for (const [from, band] of BANDS) if (rating >= from) color = band;
  return color;
}

/** "20" and ",725": CS2 draws the thousands large and the rest small. */
export function ratingParts(rating: number): [string, string] {
  return [String(Math.floor(rating / 1000)), `,${(rating % 1000).toString().padStart(3, "0")}`];
}

/** The rating after each ranked game, oldest first, for the rating graph. */
export function ratingHistory(updates: readonly RrUpdate[]): number[] {
  return [...updates].reverse().map((update) => cs2Rating(update.rank_after.tier, update.rr_after));
}
