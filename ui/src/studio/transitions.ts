// Animated document changes, like building blocks. A style switch, preset, added or removed
// piece, reset, undo or redo runs inside a view transition: pieces that stay glide to their
// new place and size with a little overshoot, new pieces build in one by one (rise, scale up,
// settle) in reading order, removed ones drop away, also staggered. The nav and backdrop
// cross-fade underneath. Without the API, or with reduced motion, the change is instant.
import { isMotionReduced } from "./spring";

type Flavor = "build" | "morph";

const NAME_PREFIX = "vt-";
const STAGGER_MS = 55;
const ENTER_MS = 500;
const EXIT_MS = 340;
/** New pieces of a style switch wait for the old ones to start falling. */
const BUILD_DELAY_MS = 140;
const OVERSHOOT = "cubic-bezier(0.22, 1.35, 0.36, 1)";

/** View-transition name of a piece (ids are already CSS identifiers). */
export function pieceTransitionName(id: string): string {
  return NAME_PREFIX + id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

interface Placed {
  name: string;
  top: number;
  left: number;
}

function placedPieces(): Placed[] {
  return [...document.querySelectorAll<HTMLElement>("[data-part='scene'] [data-vt]")].map((element) => {
    const bounds = element.getBoundingClientRect();
    return { name: element.dataset["vt"] ?? "", top: bounds.top, left: bounds.left };
  });
}

/** Reading order: rows top to bottom, then left to right. */
function readingOrder(pieces: Placed[]): string[] {
  return [...pieces].sort((a, b) => a.top + a.left * 0.35 - (b.top + b.left * 0.35)).map((piece) => piece.name);
}

function animatePseudo(pseudoElement: string, keyframes: Keyframe[], duration: number, delay: number, easing: string): void {
  document.documentElement.animate(keyframes, { duration, delay, easing, fill: "both", pseudoElement });
}

let running: ViewTransition | null = null;
/** A change handed to a view transition whose update callback has not run yet. */
let pending: (() => void) | null = null;

/** Apply a change still waiting on its transition now, so the document reads current. */
export function settleChange(): void {
  const change = pending;
  pending = null;
  change?.();
}

/** A view transition draws the moving pieces in a layer above the whole page, dialogs
 *  included; with one open (the welcome tour's style step) the change lands at once instead. */
function isDialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"]') !== null;
}

export function animateChange(change: () => void, flavor: Flavor = "morph"): void {
  settleChange();
  if (typeof document.startViewTransition !== "function" || isMotionReduced() || isDialogOpen()) {
    change();
    return;
  }
  running?.skipTransition();
  const before = placedPieces();
  const beforeNames = new Set(before.map((piece) => piece.name));
  const root = document.documentElement;
  root.dataset["transition"] = flavor;

  pending = change;
  // Runs the change unless settleChange already did.
  const transition = document.startViewTransition(() => {
    if (pending === change) settleChange();
  });
  running = transition;

  transition.ready
    .then(() => {
      const after = placedPieces();
      const afterNames = new Set(after.map((piece) => piece.name));
      const removed = readingOrder(before.filter((piece) => !afterNames.has(piece.name)));
      const added = readingOrder(after.filter((piece) => !beforeNames.has(piece.name)));
      const buildDelay = flavor === "build" && removed.length > 0 ? BUILD_DELAY_MS : 0;
      removed.forEach((name, index) => {
        animatePseudo(
          `::view-transition-old(${name})`,
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "translateY(36px) scale(0.86)" },
          ],
          EXIT_MS,
          index * STAGGER_MS * 0.6,
          "cubic-bezier(0.5, 0, 0.9, 0.4)",
        );
      });
      added.forEach((name, index) => {
        animatePseudo(
          `::view-transition-new(${name})`,
          [
            { opacity: 0, transform: "translateY(42px) scale(0.82)" },
            { opacity: 1, offset: 0.45 },
            { opacity: 1, transform: "none" },
          ],
          ENTER_MS,
          buildDelay + index * STAGGER_MS,
          OVERSHOOT,
        );
      });
    })
    .catch(() => undefined);

  transition.finished
    .finally(() => {
      if (running !== transition) return;
      running = null;
      delete root.dataset["transition"];
    })
    .catch(() => undefined);
}
