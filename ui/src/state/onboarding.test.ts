import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Settings } from "~/bindings/Settings";
import { defaultSettings } from "~/ipc/demoSettings";
import { TOUR_VERSION } from "./onboardingRules";

// The settings module talks to the backend; here it is a plain signal and a recorded save.
const [mockSettings, setMockSettings] = createSignal<Settings | null>(null);
const saves: Settings[] = [];
vi.mock("./settings", () => ({
  settings: () => mockSettings(),
  updateSettings: (change: (draft: Settings) => void) => {
    const draft = structuredClone(mockSettings()!);
    change(draft);
    saves.push(draft);
    setMockSettings(draft);
  },
}));

const firstRun = (): Settings => ({ ...defaultSettings(), onboarding: { completed_version: 0 } });

async function freshModule() {
  vi.resetModules();
  return import("./onboarding");
}

beforeEach(() => {
  saves.length = 0;
  setMockSettings(null);
});

describe("welcome tour opening", () => {
  it("opens once the settings of a first run arrive", async () => {
    const tour = await freshModule();
    setMockSettings(firstRun());
    expect(tour.isTourOpen()).toBe(true);
  });

  it("stays closed for a player who finished it", async () => {
    const tour = await freshModule();
    setMockSettings({ ...firstRun(), onboarding: { completed_version: TOUR_VERSION } });
    expect(tour.isTourOpen()).toBe(false);
  });

  it("does not reopen when later settings events arrive", async () => {
    const tour = await freshModule();
    setMockSettings(firstRun());
    tour.closeTour();
    setMockSettings({ ...firstRun() });
    expect(tour.isTourOpen()).toBe(false);
  });
});

describe("closing the tour", () => {
  it("records this tour's version", async () => {
    const tour = await freshModule();
    setMockSettings(firstRun());
    tour.closeTour();
    expect(saves.map((saved) => saved.onboarding.completed_version)).toEqual([TOUR_VERSION]);
  });

  it("writes nothing when it was already recorded", async () => {
    const tour = await freshModule();
    setMockSettings({ ...firstRun(), onboarding: { completed_version: TOUR_VERSION } });
    tour.openTour();
    tour.closeTour();
    expect(saves).toEqual([]);
  });
});
