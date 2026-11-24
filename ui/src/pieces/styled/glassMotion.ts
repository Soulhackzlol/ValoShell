// Micro-interactions for the Glass style. Each helper is used as a ref callback, so it attaches
// to the element and cleans up with the component. Pointer work is batched into one animation
// frame and written as CSS variables; the stylesheet decides what moves. Everything is a no-op
// when motion is reduced.
import { onCleanup } from "solid-js";
import { isMotionReduced } from "~/studio/spring";

function onFrame(): (work: () => void) => void {
  let frame = 0;
  onCleanup(() => cancelAnimationFrame(frame));
  return (work) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(work);
  };
}

/**
 * Pointer position as `--mx`/`--my` (0-100 %) for a glare, and `data-hover` while over it. Only
 * light follows the pointer: surfaces that leaned or drifted after it felt seasick, not glassy.
 */
export function pointerGlow(element: HTMLElement): void {
  const schedule = onFrame();
  const move = (event: PointerEvent) => {
    if (isMotionReduced()) return;
    schedule(() => {
      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      element.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      element.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      element.dataset["hover"] = "";
    });
  };
  const leave = () =>
    schedule(() => {
      delete element.dataset["hover"];
    });
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerleave", leave);
  onCleanup(() => {
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerleave", leave);
  });
}

/** A soft ring that grows from the press point. The element needs `overflow: hidden`. */
export function ripple(element: HTMLElement, className: string): void {
  const press = (event: PointerEvent) => {
    if (isMotionReduced() || event.button !== 0) return;
    const box = element.getBoundingClientRect();
    // The box is in screen px; inside a piece drawn at its own Size (CSS zoom) the ring's own
    // px are scaled again, so they are written in the element's local px.
    const zoom = element.currentCSSZoom || 1;
    const size = (Math.hypot(box.width, box.height) * 2) / zoom;
    const ring = document.createElement("span");
    ring.className = className;
    ring.style.width = ring.style.height = `${size}px`;
    ring.style.left = `${(event.clientX - box.left) / zoom - size / 2}px`;
    ring.style.top = `${(event.clientY - box.top) / zoom - size / 2}px`;
    element.append(ring);
    ring
      .animate(
        [
          { transform: "scale(0)", opacity: 0.45 },
          { transform: "scale(1)", opacity: 0 },
        ],
        { duration: 650, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
      )
      .finished.then(
        () => ring.remove(),
        () => ring.remove(),
      );
  };
  element.addEventListener("pointerdown", press);
  onCleanup(() => element.removeEventListener("pointerdown", press));
}

/** A quick spring "pop" (scale overshoot), for a value that just changed. */
export function pop(element: HTMLElement | undefined, amount = 1.18): void {
  if (!element || isMotionReduced()) return;
  element.animate([{ scale: "1" }, { scale: String(amount) }, { scale: "0.96" }, { scale: "1" }], {
    duration: 520,
    easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
  });
}

/** Stretches a sliding thumb sideways while it travels, like a drop of liquid. */
export function stretch(element: HTMLElement | undefined, distance: number): void {
  if (!element || isMotionReduced() || distance === 0) return;
  const amount = Math.min(1.45, 1 + Math.abs(distance) * 0.12);
  element.animate([{ scale: "1 1" }, { scale: `${amount} 0.9`, offset: 0.35 }, { scale: "1 1" }], {
    duration: 520,
    easing: "cubic-bezier(0.3, 0.7, 0.3, 1)",
  });
}

/** Rolls new text in from below (old digits leave upward); used for counters and clocks. */
export function roll(element: HTMLElement | undefined, direction: 1 | -1 = 1): void {
  if (!element || isMotionReduced()) return;
  element.animate(
    [
      { translate: `0 ${direction * 60}%`, opacity: 0, filter: "blur(3px)" },
      { translate: "0 0", opacity: 1, filter: "blur(0)" },
    ],
    { duration: 380, easing: "cubic-bezier(0.2, 1, 0.3, 1)" },
  );
}
