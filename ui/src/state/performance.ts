// How much the menu may cost, so it stays smooth and light beside VALORANT. Two rules:
// - Rest: while nobody is looking (the window hidden, or another window focused for a while)
//   endless animations pause and animated backdrops stop drawing. Matches also stop the
//   backdrops (menu/SceneBackdrop.tsx), but not the pages' own animations, so a player who
//   alt-tabs to the Live page mid-match still sees it arrive.
// - Effects quality (Settings): Full, Lite, or Auto, which samples frame times when a page
//   opens and turns Lite on when this PC keeps dropping under ~30 fps. Lite (theme/perf.css)
//   drops the frosted blur and draws backdrops as one still frame.
import { createEffect, createRoot, createSignal } from "solid-js";
import type { EffectsQuality } from "~/bindings/EffectsQuality";
import { settings } from "./settings";
import { pushToast } from "./toasts";

/** A frame slower than this is under ~30 fps. */
const SLOW_FRAME_MS = 34;
const SAMPLE_MS = 2000;
/** Two slow samples in a row, a second apart, so one hitch (art decoding) never decides. */
const SLOW_SAMPLES_TO_LITE = 2;
const RETRY_MS = 1000;
/** The first sample waits for the start-up work (fonts, art, the first party) to settle. */
const FIRST_CHECK_MS = 8000;
/** A quick alt-tab must not freeze the menu; staying in another window this long rests it. */
const AWAY_BEFORE_REST_MS = 10_000;
const PERCENTILE = 0.95;

/** The 95th percentile frame time, in ms (0 for no frames). */
export function frameTimeP95(times: readonly number[]): number {
  if (times.length === 0) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * PERCENTILE))] ?? 0;
}

/** Whether a sample of frame times is too slow to feel smooth. */
export function isSlowSample(times: readonly number[]): boolean {
  return frameTimeP95(times) > SLOW_FRAME_MS;
}

/** Lite when picked, or under Auto once this PC was measured too slow. */
export function isLiteFor(quality: EffectsQuality, isSlowPc: boolean): boolean {
  return quality === "lite" || (quality === "auto" && isSlowPc);
}

const [isHidden, setHidden] = createSignal(typeof document !== "undefined" && document.hidden);
const [isAway, setAway] = createSignal(false);
const [isSlowPc, setSlowPc] = createSignal(false);
let awayTimer = 0;
let slowStreak = 0;
// One sample at a time: overlapping ones would each count toward the streak, so a single janky
// moment could pass for "slow twice".
let isSampling = false;

const quality = (): EffectsQuality => settings()?.interface.effects ?? "auto";

/** Nobody is looking: endless animations and backdrops may stop. */
export const isResting = (): boolean => isHidden() || isAway();
export const isLiteEffects = (): boolean => isLiteFor(quality(), isSlowPc());

function sampleFrames(): Promise<number[]> {
  return new Promise((done) => {
    const times: number[] = [];
    let last = performance.now();
    const end = last + SAMPLE_MS;
    const tick = (now: number) => {
      times.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
      else done(times);
    };
    requestAnimationFrame(tick);
  });
}

/** Under Auto, measure the page now; two slow samples in a row turn Lite on for this run. */
export async function checkSmoothness(): Promise<void> {
  if (quality() !== "auto" || isSlowPc() || isResting() || isSampling) return;
  isSampling = true;
  const times = await sampleFrames().finally(() => (isSampling = false));
  // A window hidden mid-sample throttles its frames: that says nothing about this PC.
  if (isResting()) return;
  slowStreak = isSlowSample(times) ? slowStreak + 1 : 0;
  if (slowStreak === 0) return;
  if (slowStreak < SLOW_SAMPLES_TO_LITE) {
    window.setTimeout(() => void checkSmoothness(), RETRY_MS);
    return;
  }
  setSlowPc(true);
  console.info("effects_lite_on", { p95_ms: Math.round(frameTimeP95(times)) });
  const body = "This PC was dropping frames, so blur and moving backdrops are off. Change it in Settings.";
  pushToast("info", "Lighter effects on", body);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => setHidden(document.hidden));
  window.addEventListener("blur", () => {
    window.clearTimeout(awayTimer);
    awayTimer = window.setTimeout(() => setAway(true), AWAY_BEFORE_REST_MS);
  });
  window.addEventListener("focus", () => {
    window.clearTimeout(awayTimer);
    setAway(false);
  });
  createRoot(() => {
    const root = document.documentElement;
    createEffect(() => root.toggleAttribute("data-resting", isResting()));
    createEffect(() => (root.dataset["effects"] = isLiteEffects() ? "lite" : "full"));
  });
  window.setTimeout(() => void checkSmoothness(), FIRST_CHECK_MS);
}
