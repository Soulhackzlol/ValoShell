// Agents and maps with art, refreshed when the asset cache updates.
import { createMemo, createRoot, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { Catalog } from "~/bindings/Catalog";
import type { MapCard } from "~/bindings/MapCard";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { HEX_COLOR } from "~/studio/colors";

const [catalog, setCatalog] = createSignal<Catalog>({ agents: [], maps: [] });

function reload(): void {
  void call("get_catalog", {}).then(setCatalog, () => undefined);
}

reload();
onAppEvent("assets", reload);

export { catalog };

// Module-level derivations live for the app's lifetime, so they get their own root.
const agentsByUuid = createRoot(() =>
  createMemo(() => new Map(catalog().agents.map((agent) => [agent.uuid, agent]))),
);
const agentsByUpperName = createRoot(() =>
  createMemo(() => new Map(catalog().agents.map((agent) => [agent.upper_name, agent]))),
);

export function agentByUuid(uuid: string | null | undefined): AgentCard | undefined {
  return uuid ? agentsByUuid().get(uuid.toLowerCase()) : undefined;
}

export function agentByUpperName(name: string | null | undefined): AgentCard | undefined {
  return name ? agentsByUpperName().get(name.toUpperCase()) : undefined;
}

/** The agent's own colours (light to deep), only the ones that are `#rrggbb` (they reach CSS). */
export function agentColours(agent: AgentCard): string[] {
  return agent.colors.filter((color) => HEX_COLOR.test(color));
}

/** Maps in the known map list, competitive pool first, then Team Deathmatch. */
export const knownMaps = createRoot(() =>
  createMemo<MapCard[]>(() =>
    catalog()
      .maps.filter((map) => map.upper_name !== null)
      .sort(
        (a, b) =>
          Number(a.is_team_deathmatch) - Number(b.is_team_deathmatch) || a.display_name.localeCompare(b.display_name),
      ),
  ),
);

export const ROLE_ORDER = ["Duelist", "Initiator", "Controller", "Sentinel"] as const;
