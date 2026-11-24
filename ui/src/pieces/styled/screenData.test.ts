import { describe, expect, it } from "vitest";
import type { BattlePassView } from "~/bindings/BattlePassView";
import { daysLeft, fillOf, isOpenableLink, storyDate, unreadBadge } from "./screenData";

const pass = (ends_at: string | null): BattlePassView => ({
  name: "Season 2026 // Act V",
  tier: 16,
  tier_count: 55,
  xp_left: 7450,
  ends_at,
  is_premium_owned: null,
  next_reward: null,
});

describe("fillOf", () => {
  it("gives the share of the goal done", () => {
    expect(fillOf(25, 100)).toBe(0.25);
  });

  it("stays within 0..1 when progress overshoots or the goal is zero", () => {
    expect(fillOf(150, 100)).toBe(1);
    expect(fillOf(3, 0)).toBe(1);
    expect(fillOf(-2, 10)).toBe(0);
  });
});

describe("daysLeft", () => {
  const now = Date.parse("2026-10-26T12:00:00Z");

  it("rounds a partial day up", () => {
    expect(daysLeft(pass("2026-10-28T00:00:00Z"), now)).toBe(2);
  });

  it("is null when Riot gave no end date, and 0 once it has passed", () => {
    expect(daysLeft(pass(null), now)).toBeNull();
    expect(daysLeft(pass("2026-10-01T00:00:00Z"), now)).toBe(0);
  });
});

describe("isOpenableLink", () => {
  it("opens only https links", () => {
    expect(isOpenableLink("https://playvalorant.com/news")).toBe(true);
    expect(isOpenableLink("http://playvalorant.com")).toBe(false);
    expect(isOpenableLink("javascript:alert(1)")).toBe(false);
    expect(isOpenableLink("")).toBe(false);
  });
});

describe("storyDate", () => {
  it("shows a short month and day, and nothing for a bad date", () => {
    expect(storyDate("2026-10-24T15:00:00Z")).toBe("Oct 24");
    expect(storyDate("soon")).toBe("");
  });
});

describe("unreadBadge", () => {
  it("shows a small count as it is", () => {
    expect(unreadBadge(3)).toBe("3");
  });

  it("caps a long count at 9+", () => {
    expect(unreadBadge(12)).toBe("9+");
  });
});
