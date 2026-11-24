import { describe, expect, it, vi } from "vitest";
import type { CareerView } from "~/bindings/CareerView";

// The helpers are pure; the state modules they sit next to need a browser to load.
vi.mock("~/state/party", () => ({ party: () => null }));
vi.mock("~/state/session", () => ({ ownRiotId: () => null }));
vi.mock("~/state/views", () => ({ careerView: {} }));

const { isRated, rankLabel, rankProgress, rrText } = await import("./homeData");

const career = (tier: number, rr: number, placements_left = 0) =>
  ({ rank: { tier, name: "Ascendant 1", icon: null, color: null }, rr, placements_left }) as unknown as CareerView;

describe("rank helpers", () => {
  it("reads a rated tier with its RR through the tier", () => {
    const view = career(21, 37);
    expect([isRated(view), rankLabel(view), rrText(view), rankProgress(view)]).toEqual([true, "Ascendant 1", "37 / 100 RR", 0.37]);
  });

  it("calls a player still in placements unrated", () => {
    const view = career(21, 0, 3);
    expect([rankLabel(view), rrText(view)]).toEqual(["Unrated", "3 placements left"]);
  });

  it("counts Immortal RR without a cap and fills the bar", () => {
    const view = career(25, 412);
    expect([rrText(view), rankProgress(view)]).toEqual(["412 RR", 1]);
  });
});
