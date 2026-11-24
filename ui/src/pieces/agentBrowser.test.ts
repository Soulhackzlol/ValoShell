import { describe, expect, it, vi } from "vitest";
import type { AgentCard } from "~/bindings/AgentCard";

// The keybinds come from the player's VALORANT settings; the roster from the catalog.
vi.mock("~/menu/valSettingsData", () => ({ values: () => ({ ability1: "C", ability2: "Q", signature: "E", ultimate: "X" }) }));
vi.mock("~/menu/sound", () => ({ playCue: () => undefined }));
vi.mock("~/state/agents", () => ({ isAgentOwned: () => true, masteryOf: () => ({ lifetime: 0, act: 0 }), refreshAgentProgress: () => undefined }));
vi.mock("~/state/catalog", () => ({ ROLE_ORDER: ["Duelist", "Initiator", "Controller", "Sentinel"], catalog: () => ({ agents: [] }) }));

const { abilitySlots, roleOf } = await import("./agentBrowser");

const ability = (slot: string) => ({ slot, name: slot, description: "", icon: null });

const agent = (overrides: Partial<AgentCard>): AgentCard => ({
  uuid: "a",
  display_name: "Astra",
  upper_name: "ASTRA",
  role: "Controller",
  icon: null,
  portrait: null,
  background: null,
  description: "",
  colors: [],
  role_icon: null,
  abilities: [],
  ...overrides,
});

describe("abilitySlots", () => {
  it("puts abilities in the client's order with the player's keys", () => {
    const slots = abilitySlots(agent({ abilities: [ability("Ultimate"), ability("Grenade"), ability("Ability2"), ability("Ability1")] }));
    expect(slots.map((slot) => [slot.ability.slot, slot.key])).toEqual([
      ["Grenade", "C"],
      ["Ability1", "Q"],
      ["Ability2", "E"],
      ["Ultimate", "X"],
    ]);
  });

  it("marks only the ultimate and skips slots the agent lacks (the passive)", () => {
    const slots = abilitySlots(agent({ abilities: [ability("Passive"), ability("Ultimate")] }));
    expect(slots.map((slot) => [slot.ability.slot, slot.isUltimate])).toEqual([["Ultimate", true]]);
  });
});

describe("roleOf", () => {
  it("knows the four roles and nothing else", () => {
    expect([roleOf(agent({ role: "Sentinel" })), roleOf(agent({ role: "Healer" }))]).toEqual(["Sentinel", null]);
  });
});
