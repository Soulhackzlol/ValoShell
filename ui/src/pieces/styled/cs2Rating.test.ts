import { describe, expect, it } from "vitest";
import type { RrUpdate } from "~/bindings/RrUpdate";
import { bandColor, cs2Rating, ratingHistory, ratingParts } from "./cs2Rating";

const update = (tier: number, rr_after: number): RrUpdate => ({
  match_id: `${tier}-${rr_after}`,
  map_name: "Ascent",
  map_image: null,
  started_at_ms: 0,
  rr_earned: 0,
  rr_after,
  rank_after: { tier, name: "", icon: null, color: null },
  is_promotion: false,
  is_demotion: false,
  afk_penalty: 0,
});

describe("cs2Rating", () => {
  it("climbs with rank and with RR inside a rank", () => {
    expect(cs2Rating(18, 50)).toBeGreaterThan(cs2Rating(18, 10));
    expect(cs2Rating(19, 0)).toBeGreaterThan(cs2Rating(18, 99));
  });
});

describe("ratingParts", () => {
  it("splits the thousands from the rest, keeping the rest three digits", () => {
    expect(ratingParts(20725)).toEqual(["20", ",725"]);
    expect(ratingParts(4007)).toEqual(["4", ",007"]);
  });
});

describe("bandColor", () => {
  it("gives the band the rating has reached", () => {
    expect(bandColor(1200)).toBe("#b0c3d9");
    expect(bandColor(31000)).toBe("#fed700");
  });
});

describe("ratingHistory", () => {
  it("runs oldest first, as the history comes newest first", () => {
    const history = ratingHistory([update(19, 20), update(18, 80)]);
    expect(history).toEqual([cs2Rating(18, 80), cs2Rating(19, 20)]);
  });
});
