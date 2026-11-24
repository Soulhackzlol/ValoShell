// Rules shared by every style's own News, Progress and Chat looks (styledScreens.tsx) and the
// glass ones, so each look only decides how it draws.
import type { BattlePassView } from "~/bindings/BattlePassView";

const DAY_MS = 86_400_000;
/** The account level bar: VALORANT gives 5,000 XP per level. */
export const XP_PER_LEVEL = 5000;

/** 0..1 of a goal, for a bar's fill. */
export function fillOf(done: number, goal: number): number {
  return Math.min(1, Math.max(0, done / Math.max(1, goal)));
}

/** Whole days until the pass ends, or null when Riot did not say. */
export function daysLeft(pass: BattlePassView, now = Date.now()): number | null {
  const endsAt = Date.parse(pass.ends_at ?? "");
  return Number.isNaN(endsAt) ? null : Math.max(0, Math.ceil((endsAt - now) / DAY_MS));
}

/** Only web links open from a news row; anything else (a bad feed entry) stays inert. */
export function isOpenableLink(url: string): boolean {
  return /^https:\/\//.test(url);
}

/** "Oct 24" for a story's date, or "" when the date can't be read. */
export function storyDate(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  return new Date(at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Past this an unread badge reads "9+": a glance, not a number to count. */
const MAX_SHOWN_UNREAD = 9;

/** An unread count as a badge shows it: `3`, or `9+` past nine. */
export function unreadBadge(count: number): string {
  return count > MAX_SHOWN_UNREAD ? `${MAX_SHOWN_UNREAD}+` : String(count);
}
