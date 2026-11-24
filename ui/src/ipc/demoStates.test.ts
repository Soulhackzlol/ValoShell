import { describe, expect, it } from "vitest";
import { forcedViewState } from "./demoStates";

describe("forcedViewState", () => {
  it("fails view reads under ?state=error", async () => {
    const forced = forcedViewState("get_career", "?state=error");

    await expect(forced).rejects.toMatch(/Riot answered 503/);
  });

  it("keeps view reads pending under ?state=loading", async () => {
    const forced = forcedViewState("get_store", "?state=loading");
    const settled = await Promise.race([forced?.then(() => "settled", () => "settled"), Promise.resolve("pending")]);

    expect(settled).toBe("pending");
  });

  it("never touches actions or a plain URL", () => {
    expect(forcedViewState("equip_skin", "?state=error")).toBeNull();
    expect(forcedViewState("get_career", "")).toBeNull();
  });
});
