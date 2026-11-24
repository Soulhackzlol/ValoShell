import { describe, expect, it } from "vitest";
import { hexToRgbTriplet, onColor, playVars } from "./colors";

describe("onColor", () => {
  it("keeps white labels on VALORANT red, like the menu's PLAY", () => {
    expect(onColor("#ff4655")).toBe("#ffffff");
  });

  it("puts dark labels on near-white accents", () => {
    expect(onColor("#f5f5f5")).toBe("#0b0b0e");
  });
});

describe("hexToRgbTriplet", () => {
  it("splits a colour into its channels", () => {
    expect(hexToRgbTriplet("#ff4655")).toBe("255 70 85");
  });

  it("reads anything else as black", () => {
    expect(hexToRgbTriplet("red")).toBe("0 0 0");
  });
});

describe("playVars", () => {
  it("keeps the style's own PLAY colours when none is picked", () => {
    expect(playVars("")).toBeNull();
  });

  it("ignores anything that is not a full hex colour", () => {
    expect(playVars("red; background: url(x)")).toBeNull();
  });

  it("derives hover, pressed and a readable label from the picked colour", () => {
    const vars = playVars("#f2f2f2");
    expect(vars?.["--play"]).toBe("#f2f2f2");
    expect(vars?.["--play-hover"]).toContain("#f2f2f2");
    expect(vars?.["--on-play"]).toBe(onColor("#f2f2f2"));
  });
});
