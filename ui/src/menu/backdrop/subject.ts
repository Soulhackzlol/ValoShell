// Which map or agent a map/agent backdrop shows. "fixed" is the one picked in Studio; "recent"
// follows your last match (the picked one stands in until there is one); "shuffle" is a
// different one each launch, the same all session so the menu does not flicker between pages.
import type { AgentCard } from "~/bindings/AgentCard";
import type { MapCard } from "~/bindings/MapCard";
import type { MatchRow } from "~/bindings/MatchRow";
import type { BackdropPick } from "~/studio/types";

/** Picked once per launch: shuffle shows something new each time the app opens. */
const LAUNCH_SEED = Math.floor(Math.random() * 2 ** 31);

/** The newest match in the history, whatever order the rows come in. */
export function lastMatch(rows: readonly MatchRow[]): MatchRow | undefined {
  const isNewer = (row: MatchRow, newest: MatchRow | undefined) => !newest || row.started_at_ms > newest.started_at_ms;
  return rows.reduce<MatchRow | undefined>((newest, row) => (isNewer(row, newest) ? row : newest), undefined);
}

interface Subject<T> {
  pick: BackdropPick;
  /** Everything it may show (for shuffle) and look up the picked one in. */
  pool: readonly T[];
  isPicked: (item: T) => boolean;
  /** Whether `item` is the one from the last match; undefined when there was none. */
  isRecent: ((item: T) => boolean) | undefined;
  seed?: number | undefined;
}

/** The item the backdrop shows, or undefined when the pool is empty. */
export function resolveSubject<T>(subject: Subject<T>): T | undefined {
  const picked = subject.pool.find(subject.isPicked);
  if (subject.pick === "recent" && subject.isRecent) return subject.pool.find(subject.isRecent) ?? picked;
  if (subject.pick === "shuffle" && subject.pool.length > 0) {
    return subject.pool[(subject.seed ?? LAUNCH_SEED) % subject.pool.length];
  }
  return picked;
}

/** What the theme asked for: how to pick, the picked id, and the last match to follow. */
export interface SubjectChoice {
  pick: BackdropPick;
  /** Map internal id or agent uuid. */
  id: string;
  last: MatchRow | undefined;
  /** Fixed in tests; a launch's own otherwise. */
  seed?: number | undefined;
}

/** The map: picked by internal id, matched to the last match by its name. */
export function backdropMap(choice: SubjectChoice, maps: readonly MapCard[]): MapCard | undefined {
  const { pick, id, last, seed } = choice;
  const pool = maps.filter((map) => !map.is_team_deathmatch);
  const isRecent = last ? (map: MapCard) => map.display_name === last.map_name : undefined;
  return resolveSubject({ pick, pool, isPicked: (map) => map.internal_id === id, isRecent, seed });
}

/** The agent: picked by uuid, matched to the last match by its name. */
export function backdropAgent(choice: SubjectChoice, agents: readonly AgentCard[]): AgentCard | undefined {
  const { pick, id, last, seed } = choice;
  const isRecent = last?.agent_name ? (agent: AgentCard) => agent.display_name === last.agent_name : undefined;
  const isPicked = (agent: AgentCard) => agent.uuid === id.toLowerCase();
  return resolveSubject({ pick, pool: agents, isPicked, isRecent, seed });
}
