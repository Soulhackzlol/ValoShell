import { describe, expect, it } from "vitest";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import { playerName } from "./playerName";

const player = (overrides: Partial<PostMatchPlayer>): PostMatchPlayer => ({
  puuid: "p",
  game_name: "",
  tag_line: "",
  is_self: false,
  is_ally: true,
  is_incognito: false,
  team_id: "Blue",
  agent_name: "Sova",
  agent_icon: null,
  kills: 0,
  deaths: 0,
  assists: 0,
  score: 0,
  acs: 0,
  stack_size: 1,
  stack_group: null,
  ...overrides,
});

describe("playerName", () => {
  it("never shows an incognito player's name", () => {
    expect(playerName(player({ is_incognito: true }))).toBe("Hidden");
  });

  it("names a player the match left unnamed by their agent", () => {
    expect([playerName(player({})), playerName(player({ game_name: "Ghost" }))]).toEqual(["Sova", "Ghost"]);
  });
});
