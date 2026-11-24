import { describe, expect, it } from "vitest";
import { MIN_PANEL_SIZE, clampPanelSize } from "./panelSize";

const WINDOW = { width: 1600, height: 900 };

describe("clampPanelSize", () => {
  it("keeps a size that fits", () => {
    expect(clampPanelSize({ width: 600, height: 420 }, WINDOW)).toEqual({ width: 600, height: 420 });
  });

  it("never goes below the minimum", () => {
    expect(clampPanelSize({ width: 10, height: 10 }, WINDOW)).toEqual(MIN_PANEL_SIZE);
  });

  it("stays inside the window", () => {
    const size = clampPanelSize({ width: 5000, height: 5000 }, WINDOW);
    expect(size.width).toBeLessThan(WINDOW.width);
    expect(size.height).toBeLessThan(WINDOW.height);
  });

  it("keeps the minimum even in a tiny window", () => {
    expect(clampPanelSize({ width: 400, height: 400 }, { width: 200, height: 200 })).toEqual(MIN_PANEL_SIZE);
  });
});
