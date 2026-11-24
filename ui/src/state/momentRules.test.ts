import { describe, expect, it } from "vitest";
import { type MomentInput, isShowWhen, isShownAt, momentOf } from "./momentRules";

const MENUS: MomentInput = {
  isConnected: true,
  phase: "menus",
  isQueueing: false,
  partySize: 1,
  isShowingSummary: false,
  isMatchJustFound: false,
};

describe("momentOf", () => {
  it("is offline without the Riot Client, whatever else is known", () => {
    expect(momentOf({ ...MENUS, isConnected: false, isQueueing: true })).toBe("offline");
  });

  it("tells solo and party apart in the menus", () => {
    expect([momentOf(MENUS), momentOf({ ...MENUS, partySize: 3 })]).toEqual(["idle", "party"]);
  });

  it("puts searching over being in a party", () => {
    expect(momentOf({ ...MENUS, partySize: 3, isQueueing: true })).toBe("queueing");
  });

  it("shows match found first, then agent select", () => {
    const pregame = { ...MENUS, phase: "pregame" as const };
    expect([momentOf({ ...pregame, isMatchJustFound: true }), momentOf(pregame)]).toEqual(["match-found", "agent-select"]);
  });

  it("puts the match over a summary still open", () => {
    expect(momentOf({ ...MENUS, phase: "ingame", isShowingSummary: true })).toBe("in-game");
  });

  it("is post-match while the summary shows in the menus", () => {
    expect(momentOf({ ...MENUS, isShowingSummary: true })).toBe("post-match");
  });
});

describe("isShownAt", () => {
  it("shows a searching-only piece just while searching", () => {
    expect([isShownAt("queueing", "queueing", 1), isShownAt("queueing", "idle", 1)]).toEqual([true, false]);
  });

  it("counts a party that is searching as a party", () => {
    expect([isShownAt("party", "queueing", 3), isShownAt("solo", "queueing", 3)]).toEqual([true, false]);
  });
});

describe("isShowWhen", () => {
  it("accepts only known rules from a shared look", () => {
    expect([isShowWhen("party"), isShowWhen("__proto__"), isShowWhen(3)]).toEqual([true, false, false]);
  });
});
