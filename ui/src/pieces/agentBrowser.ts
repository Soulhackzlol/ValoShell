// What every style's Agents page shares: the roster sorted by name, the role filter, "owned
// only", the picked agent and which of their abilities is open. Each style draws it its own way
// (styled/currentAgents.tsx, agents/*.tsx); this is only the state and the facts.
import { createMemo, createSignal } from "solid-js";
import type { AbilityCard } from "~/bindings/AbilityCard";
import type { AgentCard } from "~/bindings/AgentCard";
import { values as gameSettings } from "~/menu/valSettingsData";
import { playCue } from "~/menu/sound";
import { isAgentOwned, masteryOf, refreshAgentProgress } from "~/state/agents";
import { ROLE_ORDER, catalog } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";

export type Role = (typeof ROLE_ORDER)[number];
export const INFO_TAB = "info";

/** Each role in one line, as the client explains it under an agent. */
export const ROLE_BLURB: Record<Role, string> = {
  Duelist: "Self-sufficient fraggers expected to take the first fights and get the kills.",
  Initiator: "Set the team up to take contested ground and push defenders away.",
  Controller: "Slice up dangerous territory so the team can take it.",
  Sentinel: "Lock down areas and watch the flanks, on attack and defence.",
};

/** The client's ability order and the keybind setting that captions each slot. */
const SLOTS: readonly [slot: string, bind: string][] = [
  ["Grenade", "ability1"],
  ["Ability1", "ability2"],
  ["Ability2", "signature"],
  ["Ultimate", "ultimate"],
];

export interface AbilitySlot {
  ability: AbilityCard;
  /** The player's key for it (from their VALORANT settings), or "" when unknown. */
  key: string;
  isUltimate: boolean;
}

/** Whether an Agents page shows mastery levels (the piece's "Show mastery", on by default). */
export function isMasteryShown(props: PieceProps): boolean {
  return props.piece.props["showMastery"] !== false;
}

export function roleOf(agent: AgentCard): Role | null {
  return (ROLE_ORDER as readonly string[]).includes(agent.role) ? (agent.role as Role) : null;
}

/** The agent's abilities in the client's order, each with the player's key for it. */
export function abilitySlots(agent: AgentCard): AbilitySlot[] {
  return SLOTS.flatMap(([slot, bind]) => {
    const ability = agent.abilities.find((entry) => entry.slot === slot);
    return ability ? [{ ability, key: String(gameSettings()[bind] ?? ""), isUltimate: slot === "Ultimate" }] : [];
  });
}

export function useAgentBrowser() {
  const [role, setRole] = createSignal<Role | "all">("all");
  const [pickedId, setPickedId] = createSignal("");
  const [tab, setTab] = createSignal(INFO_TAB);
  const [isOwnedOnly, setOwnedOnly] = createSignal(false);
  const agents = createMemo(() => [...catalog().agents].sort((a, b) => a.display_name.localeCompare(b.display_name)));
  const shown = () => agents().filter((agent) => (role() === "all" || agent.role === role()) && (!isOwnedOnly() || isAgentOwned(agent.uuid)));
  const picked = () => agents().find((agent) => agent.uuid === pickedId()) ?? agents()[0];
  refreshAgentProgress();
  return {
    agents,
    shown,
    picked,
    role,
    tab,
    isOwnedOnly,
    /** The open ability, or undefined on the agent's info. */
    ability: () => picked()?.abilities.find((entry) => entry.slot === tab()),
    mastery: () => masteryOf(picked()?.uuid ?? ""),
    isOwned: (agent: AgentCard) => isAgentOwned(agent.uuid),
    pick: (agent: AgentCard) => {
      playCue("tab");
      setPickedId(agent.uuid);
      setTab(INFO_TAB);
    },
    filter: (next: Role | "all") => {
      playCue("tab");
      setRole(next);
    },
    openTab: (next: string) => {
      playCue("tab");
      setTab(next);
    },
    toggleOwned: () => {
      playCue(isOwnedOnly() ? "back" : "confirm");
      setOwnedOnly(!isOwnedOnly());
    },
  };
}

export type AgentBrowser = ReturnType<typeof useAgentBrowser>;
