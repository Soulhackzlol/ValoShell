// Preview switch for the states pieces show before their data: `?state=loading` keeps every
// view read pending, `?state=error` fails it the way Riot does. Lets a style's loading and
// error looks be designed (and screenshotted) without breaking a real connection.
import type { Command } from "./commands";

/** The reads behind the menu's views; actions are never affected. */
const VIEW_READS: ReadonlySet<Command> = new Set<Command>([
  "get_store",
  "get_career",
  "get_progress",
  "get_leaderboard",
  "get_stats",
  "get_match_history",
  "get_collection",
  "get_identity",
]);

const DEMO_ERROR = "Could not read that: Riot answered 503. Try again in a minute.";

/** A forced answer for `command` under the URL's `state`, or null to answer normally. */
export function forcedViewState(command: Command, search: string = location.search): Promise<never> | null {
  if (!VIEW_READS.has(command)) return null;
  const state = new URLSearchParams(search).get("state");
  if (state === "loading") return new Promise<never>(() => undefined);
  if (state === "error") return Promise.reject(DEMO_ERROR);
  return null;
}
