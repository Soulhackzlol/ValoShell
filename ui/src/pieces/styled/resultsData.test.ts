import { describe, expect, it } from "vitest";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import { mvpOf, signed, teamsOf } from "./resultsData";

const player = (puuid: string, acs: number, is_ally: boolean): PostMatchPlayer => ({
  puuid,
  game_name: puuid,
  tag_line: "",
  is_self: false,
  is_ally,
  is_incognito: false,
  team_id: is_ally ? "Blue" : "Red",
  agent_name: null,
  agent_icon: null,
  kills: 0,
  deaths: 0,
  assists: 0,
  score: 0,
  acs,
  stack_size: 1,
  stack_group: null,
});

describe("teamsOf", () => {
  it("splits the match into your team and theirs, best combat score first", () => {
    const teams = teamsOf([player("a", 120, true), player("b", 300, false), player("c", 250, true)]);
    expect(teams.allies.map((p) => p.puuid)).toEqual(["c", "a"]);
    expect(teams.enemies.map((p) => p.puuid)).toEqual(["b"]);
  });
});

describe("mvpOf", () => {
  it("names the team's best combat score", () => {
    expect(mvpOf([player("a", 120, true), player("c", 250, true)])).toBe("c");
  });

  it("names nobody for an empty team or one that scored nothing", () => {
    expect(mvpOf([])).toBeNull();
    expect(mvpOf([player("a", 0, true)])).toBeNull();
  });
});

describe("signed", () => {
  it("adds a plus to gains only", () => {
    expect(signed(18)).toBe("+18");
    expect(signed(-12)).toBe("-12");
    expect(signed(0)).toBe("0");
  });
});
