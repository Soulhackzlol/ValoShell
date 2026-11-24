import { describe, expect, it } from "vitest";
import { defaultDoc, piece } from "../defaults";
import { summarizeLook } from "./lookSummary";

describe("summarizeLook", () => {
  it("describes the default document by its style and colours", () => {
    const summary = summarizeLook(defaultDoc());

    expect(summary.styleLabel).toBe("Modern");
    expect(summary.accent).toBe("#ff4655");
    expect(summary.boxes.length).toBeGreaterThan(0);
  });

  it("marks the Play bar and skips hidden pieces", () => {
    const doc = defaultDoc();
    const hidden = { ...piece("clock", { x: 0, y: 0, w: 0.1, h: 0.1 }, 1), isHidden: true };
    doc.stages.home = [piece("play-bar", { x: 0.3, y: 0.8, w: 0.4, h: 0.1 }, 2), hidden];

    const summary = summarizeLook(doc);

    expect(summary.boxes).toEqual([{ rect: { x: 0.3, y: 0.8, w: 0.4, h: 0.1 }, playEdge: "bottom" }]);
  });

  it("falls back to the style's colours when a shared look holds junk", () => {
    const doc = defaultDoc();
    doc.theme.play = "url(x)";
    doc.theme.accent = "not a colour";

    const summary = summarizeLook(doc);

    expect(summary.accent).toBe("#ff4655");
    expect(summary.play).toBe("#ff4655");
  });

  it("uses the picked Play colour", () => {
    const doc = defaultDoc();
    doc.theme.play = "#19e3c6";
    expect(summarizeLook(doc).play).toBe("#19e3c6");
  });

  it("fills previews with the style's panel colour, recoloured when the look recolours it", () => {
    const doc = defaultDoc();
    doc.theme.skin = "csgo";
    expect(summarizeLook(doc).surface).toBe("#1e2329");

    doc.theme.palette = { "csgo-panel": "#2b1a3d" };
    expect(summarizeLook(doc).surface).toBe("#2b1a3d");
  });

  it("has no panel colour for styles without colour roles", () => {
    expect(summarizeLook(defaultDoc()).surface).toBeNull();
  });
});
