import { describe, expect, it, vi } from "vitest";
import type { AgentCard } from "~/bindings/AgentCard";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";

// The helpers are pure; the state modules they sit next to need a browser to load.
vi.mock("~/state/agents", () => ({ isAgentOwned: () => true }));
vi.mock("~/state/catalog", () => ({ ROLE_ORDER: ["Duelist", "Controller"], agentByUuid: () => undefined, catalog: () => ({ agents: [] }) }));
vi.mock("~/state/pregame", () => ({ pregame: () => null, pregameActions: {}, timeLeft: () => 0 }));

const { hasLobbyRr, lobbyName, lobbyRank, rosterGroups } = await import("./matchData");

const player = (overrides: Partial<LobbyPlayerView>) =>
  ({
    game_name: "",
    is_incognito: false,
    is_rank_hidden: false,
    is_loaded: true,
    rank: { tier: 21, name: "Ascendant 1" },
    ...overrides,
  }) as LobbyPlayerView;

describe("lobby lines", () => {
  it("keeps incognito players hidden", () => {
    expect(lobbyName(player({ is_incognito: true }))).toBe("Hidden");
  });

  it("hides a hidden rank and its RR", () => {
    const hidden = player({ is_rank_hidden: true });
    expect([lobbyRank(hidden), hasLobbyRr(hidden)]).toEqual(["Hidden", false]);
  });

  it("waits on a rank still loading", () => {
    expect(lobbyRank(player({ is_loaded: false }))).toBe("…");
  });
});

describe("rosterGroups", () => {
  it("groups by role in game order and puts new roles last", () => {
    const agent = (uuid: string, role: string) => ({ uuid, role }) as AgentCard;
    const groups = rosterGroups([agent("a", "Controller"), agent("b", "Duelist"), agent("c", "Strategist")]);
    expect(groups.map((group) => group.role)).toEqual(["Duelist", "Controller", "Other"]);
  });
});
