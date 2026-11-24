import { describe, expect, it } from "vitest";
import { SKIN_IDS } from "./types";
import { clampDelay, resolveMotion } from "./motion";

describe("resolveMotion", () => {
  it("fills an auto entrance from the style's own motion and keeps hover still", () => {
    expect(resolveMotion({ enter: "auto", hover: "none" }, "glass", "center")).toEqual({ enter: "blur", hover: "none", from: undefined });
  });

  it("keeps the player's own picks over the style's", () => {
    expect(resolveMotion({ enter: "pop", hover: "none" }, "glass", "center")).toMatchObject({ enter: "pop", hover: "none" });
  });

  it("slides in from the edge the piece sits against", () => {
    const from = (anchor: "top-left" | "right" | "bottom") => resolveMotion({ enter: "slide", hover: "none" }, "modern", anchor).from;
    expect([from("top-left"), from("right"), from("bottom")]).toEqual(["left", "right", "bottom"]);
  });

  it("rises when a centred piece has no edge to slide from", () => {
    expect(resolveMotion({ enter: "slide", hover: "none" }, "modern", "center")).toEqual({ enter: "rise", hover: "none", from: undefined });
  });

  it("has a motion for every style", () => {
    for (const skin of SKIN_IDS) expect(resolveMotion({ enter: "auto", hover: "none" }, skin, "left").enter, skin).toBeTruthy();
  });
});

describe("clampDelay", () => {
  it("keeps a delay between none and the longest allowed", () => {
    expect([clampDelay(-50), clampDelay(300.4), clampDelay(99_999)]).toEqual([0, 300, 1200]);
  });
});
