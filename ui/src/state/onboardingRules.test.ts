import { describe, expect, it } from "vitest";
import type { Settings } from "~/bindings/Settings";
import { defaultSettings } from "~/ipc/demoSettings";
import { TOUR_VERSION, shouldOpenTour, stepAfter } from "./onboardingRules";

function withTour(completedVersion: number): Settings {
  return { ...defaultSettings(), onboarding: { completed_version: completedVersion } };
}

describe("shouldOpenTour", () => {
  it("opens on a first run", () => {
    expect(shouldOpenTour(withTour(0))).toBe(true);
  });

  it("stays closed once this tour was finished or skipped", () => {
    expect(shouldOpenTour(withTour(TOUR_VERSION))).toBe(false);
  });

  it("waits for the settings to load", () => {
    expect(shouldOpenTour(null)).toBe(false);
  });
});

describe("stepAfter", () => {
  it("moves to the next step", () => {
    expect(stepAfter(1, 1, 5)).toBe(2);
  });

  it("stops at the last step", () => {
    expect(stepAfter(4, 1, 5)).toBe(4);
  });

  it("stops at the first step", () => {
    expect(stepAfter(0, -1, 5)).toBe(0);
  });
});
