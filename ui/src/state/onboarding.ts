// The welcome tour: opens by itself on a first run (once the settings are read), and again from
// Settings or the command palette. Finishing or skipping records the tour's version.
import { createEffect, createRoot, createSignal } from "solid-js";
import { TOUR_VERSION, shouldOpenTour } from "./onboardingRules";
import { settings, updateSettings } from "./settings";

const [isTourOpen, setTourOpen] = createSignal(false);

export { isTourOpen };

/** Set once the tour was opened or closed by hand, so the first-run check never overrides it. */
let isDecided = false;

// Checked once, when the settings first arrive: closing the tour must not reopen it, even when
// it was closed before the settings had arrived.
createRoot(() => {
  createEffect(() => {
    const now = settings();
    if (isDecided || !now) return;
    isDecided = true;
    if (shouldOpenTour(now)) setTourOpen(true);
  });
});

/** Open the tour again (Settings, command palette). */
export function openTour(): void {
  isDecided = true;
  setTourOpen(true);
}

/** Close the tour, finished or skipped; either way it does not open by itself again. */
export function closeTour(): void {
  isDecided = true;
  setTourOpen(false);
  if ((settings()?.onboarding.completed_version ?? 0) >= TOUR_VERSION) return;
  updateSettings((draft) => void (draft.onboarding.completed_version = TOUR_VERSION));
}
