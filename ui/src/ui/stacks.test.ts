import { describe, expect, it } from "vitest";
import { partyLabel, stackColor } from "./stacks";

describe("partyLabel", () => {
  it("names duos, trios and bigger stacks, and nothing for a solo player", () => {
    expect([1, 2, 3, 5].map(partyLabel)).toEqual(["", "Duo", "Trio", "5-stack"]);
  });
});

describe("stackColor", () => {
  it("gives each stack its colour and solo players none", () => {
    expect([stackColor(0), stackColor(5), stackColor(null)]).toEqual(["var(--party-1)", "var(--party-1)", "transparent"]);
  });
});
