// When the welcome tour shows, kept free of IPC so it can be tested on its own.
import type { Settings } from "~/bindings/Settings";

/** Bump when the tour gains steps worth seeing again; players who finished an older one see it once more. */
export const TOUR_VERSION = 1;

/** The tour opens by itself until this version was finished or skipped. */
export function shouldOpenTour(settings: Settings | null): boolean {
  if (!settings) return false;
  return settings.onboarding.completed_version < TOUR_VERSION;
}

/** Step `index` moved by `delta`, kept inside the tour. */
export function stepAfter(index: number, delta: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index + delta));
}
