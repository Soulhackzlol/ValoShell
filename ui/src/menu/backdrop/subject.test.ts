import { describe, expect, it } from "vitest";
import type { AgentCard } from "~/bindings/AgentCard";
import type { MapCard } from "~/bindings/MapCard";
import type { MatchRow } from "~/bindings/MatchRow";
import { backdropAgent, backdropMap, lastMatch } from "./subject";

const map = (internal_id: string, display_name: string, is_team_deathmatch = false): MapCard => ({
  internal_id,
  display_name,
  upper_name: display_name.toUpperCase(),
  splash: null,
  list_icon: null,
  is_team_deathmatch,
});
const MAPS = [map("Ascent", "Ascent"), map("Duality", "Bind"), map("HURM_Alley", "District", true), map("Jam", "Lotus")];
const agent = (uuid: string, display_name: string) => ({ uuid, display_name }) as AgentCard;
const AGENTS = [agent("a1", "Jett"), agent("b2", "Sova"), agent("c3", "Viper")];
const row = (map_name: string, agent_name: string | null, started_at_ms: number) =>
  ({ map_name, agent_name, started_at_ms }) as MatchRow;

describe("lastMatch", () => {
  it("finds the newest match in any order", () => {
    expect(lastMatch([row("Bind", "Jett", 1), row("Lotus", "Sova", 3), row("Ascent", null, 2)])?.map_name).toBe("Lotus");
  });

  it("is undefined with no matches", () => {
    expect(lastMatch([])).toBeUndefined();
  });
});

describe("backdropMap", () => {
  it("shows the picked map", () => {
    expect(backdropMap({ pick: "fixed", id: "Duality", last: undefined }, MAPS)?.display_name).toBe("Bind");
  });

  it("follows the last match by its map name", () => {
    expect(backdropMap({ pick: "recent", id: "Ascent", last: row("Lotus", "Jett", 1) }, MAPS)?.internal_id).toBe("Jam");
  });

  it("keeps the picked map until there is a match, or when the last map is not in the pool", () => {
    expect(backdropMap({ pick: "recent", id: "Ascent", last: undefined }, MAPS)?.internal_id).toBe("Ascent");
    expect(backdropMap({ pick: "recent", id: "Ascent", last: row("District", null, 1) }, MAPS)?.internal_id).toBe("Ascent");
  });

  it("shuffles only through the standard maps, steady for a seed", () => {
    const seen = [0, 1, 2, 3, 4, 5].map((seed) => backdropMap({ pick: "shuffle", id: "", last: undefined, seed }, MAPS)?.internal_id);
    expect(new Set(seen)).toEqual(new Set(["Ascent", "Duality", "Jam"]));
    expect(backdropMap({ pick: "shuffle", id: "", last: undefined, seed: 4 }, MAPS)).toBe(backdropMap({ pick: "shuffle", id: "", last: undefined, seed: 4 }, MAPS));
  });
});

describe("backdropAgent", () => {
  it("matches the picked uuid in any case", () => {
    expect(backdropAgent({ pick: "fixed", id: "B2", last: undefined }, AGENTS)?.display_name).toBe("Sova");
  });

  it("follows the agent of the last match", () => {
    expect(backdropAgent({ pick: "recent", id: "a1", last: row("Bind", "Viper", 1) }, AGENTS)?.uuid).toBe("c3");
  });

  it("is undefined when nothing is picked and nothing was played", () => {
    expect(backdropAgent({ pick: "recent", id: "", last: undefined }, AGENTS)).toBeUndefined();
  });
});
