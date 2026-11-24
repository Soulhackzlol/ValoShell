import { describe, expect, it, vi } from "vitest";

vi.mock("./settings", () => ({ settings: () => null }));
vi.mock("./toasts", () => ({ pushToast: () => undefined }));

const { frameTimeP95, isLiteFor, isSlowSample } = await import("./performance");

/** Frame times of a run at `fps`, with `hitches` frames of `hitchMs` mixed in. */
const run = (fps: number, frames: number, hitches = 0, hitchMs = 0) => [
  ...Array.from({ length: frames - hitches }, () => 1000 / fps),
  ...Array.from({ length: hitches }, () => hitchMs),
];

describe("frameTimeP95", () => {
  it("is the frame time 95% of frames beat", () => {
    expect(frameTimeP95(run(60, 100, 5, 50))).toBeCloseTo(50);
    expect(frameTimeP95(run(60, 100, 4, 50))).toBeCloseTo(1000 / 60);
  });

  it("is 0 without frames", () => {
    expect(frameTimeP95([])).toBe(0);
  });
});

describe("isSlowSample", () => {
  it("lets a smooth page with a few hitches pass", () => {
    expect(isSlowSample(run(60, 120, 3, 80))).toBe(false);
  });

  it("flags a page that keeps running under 30 fps", () => {
    expect(isSlowSample(run(24, 48))).toBe(true);
  });
});

describe("isLiteFor", () => {
  it("follows the setting, and Auto follows the measurement", () => {
    const cases = [isLiteFor("lite", false), isLiteFor("full", true), isLiteFor("auto", false), isLiteFor("auto", true)];
    expect(cases).toEqual([true, false, false, true]);
  });
});
