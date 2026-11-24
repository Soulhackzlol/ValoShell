import { describe, expect, it } from "vitest";
import type { RrUpdate } from "~/bindings/RrUpdate";
import { calendarDay, chartPath, chartPoints, radarPoints, rankTrend, romanRank } from "./trend";

const update = (tier: number, rr: number): RrUpdate => ({
  match_id: `${tier}-${rr}`,
  map_name: "Ascent",
  map_image: null,
  started_at_ms: 0,
  rr_earned: 0,
  rr_after: rr,
  rank_after: { tier, name: "", icon: null, color: null },
  is_promotion: false,
  is_demotion: false,
  afk_penalty: 0,
});

describe("rankTrend", () => {
  it("runs oldest first and keeps climbing through a promotion", () => {
    expect(rankTrend([update(13, 10), update(12, 90), update(12, 70)])).toEqual([1270, 1290, 1310]);
  });
});

describe("chartPoints", () => {
  it("puts the highest value at the top and the lowest at the bottom", () => {
    const points = chartPoints([5, 10], { width: 100, height: 50, pad: 5 });
    expect(points).toEqual([
      { x: 0, y: 45 },
      { x: 100, y: 5 },
    ]);
  });

  it("centres a single game instead of dividing by zero", () => {
    expect(chartPoints([7], { width: 100, height: 50, pad: 5 })).toEqual([{ x: 50, y: 45 }]);
  });
});

describe("chartPath", () => {
  it("closes an area down to the floor", () => {
    expect(chartPath([{ x: 0, y: 4 }, { x: 10, y: 2 }], 20, true)).toBe("M0.0 4.0 L10.0 2.0 L10.0 20 L0.0 20 Z");
  });

  it("draws nothing without games", () => {
    expect(chartPath([], 20)).toBe("");
  });
});

describe("calendarDay", () => {
  it("reads the local month, day and weekday", () => {
    expect(calendarDay(new Date(2026, 9, 25, 20).getTime())).toEqual({ month: 10, day: 25, weekday: "Sun" });
  });
});

describe("romanRank", () => {
  it("writes the division in roman numerals and leaves Radiant alone", () => {
    expect([romanRank("Diamond 1"), romanRank("Gold 3"), romanRank("Radiant")]).toEqual(["Diamond I", "Gold III", "Radiant"]);
  });
});

describe("radarPoints", () => {
  it("starts straight up and clamps values past the edge", () => {
    expect(radarPoints([1, 2, 0, -1], 10, 50)).toBe("50.0,40.0 60.0,50.0 50.0,50.0 50.0,50.0");
  });
});
