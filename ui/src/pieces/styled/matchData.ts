// Data and rules shared by every style's own Agent select and Lobby looks, so each look only
// decides how it draws. The pick follows the standard picker exactly: selecting and locking
// happen only on the player's click, never on their own; the lobby keeps the standard lobby's
// naming rule (incognito players stay "Hidden") and hidden ranks.
import { createMemo, createSignal, onCleanup } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";
import type { PregameView } from "~/bindings/PregameView";
import { isAgentOwned } from "~/state/agents";
import { ROLE_ORDER, agentByUuid, catalog } from "~/state/catalog";
import { pregame, pregameActions, timeLeft } from "~/state/pregame";

const TICK_MS = 1000;
/** Tiers 0-2 are Unranked and two unused ones, so they carry no RR. */
const FIRST_RATED_TIER = 3;

/** The roster by role in game order; a role the game adds later goes last as "Other". */
export function rosterGroups(agents: readonly AgentCard[]): { role: string; agents: AgentCard[] }[] {
  const known = ROLE_ORDER as readonly string[];
  const inRole = (role: string) => agents.filter((agent) => agent.role === role);
  const groups = ROLE_ORDER.map((role) => ({ role: role as string, agents: inRole(role) }));
  groups.push({ role: "Other", agents: agents.filter((agent) => !known.includes(agent.role)) });
  return groups.filter((group) => group.agents.length > 0);
}

export interface PickState {
  view: () => PregameView | null;
  /** The agent the hero shows: the hovered tile, else your pick. */
  shown: () => AgentCard | undefined;
  own: () => string | null;
  isLocked: () => boolean;
  secondsLeft: () => number;
  /** Why a tile can't be clicked, or null when it can. */
  blockOf: (agent: AgentCard) => "locked" | "taken" | "unowned" | null;
  hover: (uuid: string | null) => void;
  select: (agent: AgentCard) => void;
  lock: () => void;
  dodge: () => void;
}

export function usePick(): PickState {
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
  onCleanup(() => window.clearInterval(timer));
  const taken = createMemo(() => new Set(pregame()?.taken_agents ?? []));
  const own = () => pregame()?.own_agent_uuid ?? null;
  const isLocked = () => pregame()?.is_own_locked ?? false;
  return {
    view: () => pregame() ?? null,
    shown: () => agentByUuid(hovered() ?? own() ?? ""),
    own,
    isLocked,
    secondsLeft: () => {
      const view = pregame();
      return view ? Math.ceil(timeLeft(view, now())) : 0;
    },
    blockOf: (agent) => {
      if (isLocked()) return "locked";
      if (taken().has(agent.uuid)) return "taken";
      return isAgentOwned(agent.uuid) ? null : "unowned";
    },
    hover: setHovered,
    select: (agent) => void pregameActions.select(agent.uuid),
    lock: () => {
      const uuid = own();
      if (uuid && !isLocked()) void pregameActions.lock(uuid);
    },
    dodge: () => void pregameActions.dodge(),
  };
}

/** The whole roster, grouped by role. */
export const pickRoster = () => rosterGroups(catalog().agents);

/** A lobby line's name: incognito players stay "Hidden", unknown ones a dash. */
export function lobbyName(player: LobbyPlayerView): string {
  return player.game_name || (player.is_incognito ? "Hidden" : "—");
}

/** A lobby line's rank: hidden when the player hides it, "…" until it loads. */
export function lobbyRank(player: LobbyPlayerView): string {
  if (player.is_rank_hidden) return "Hidden";
  return player.is_loaded ? player.rank.name : "…";
}

/** Whether a lobby line has RR worth showing. */
export function hasLobbyRr(player: LobbyPlayerView): boolean {
  return player.is_loaded && !player.is_rank_hidden && player.rank.tier >= FIRST_RATED_TIER;
}
