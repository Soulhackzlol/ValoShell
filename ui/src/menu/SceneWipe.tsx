// How a screen comes in on a tab change: fade, slide (toward the tab's side), zoom, blur,
// a piece-by-piece build, shutters, a pixel dissolve, or the accent wipe. "Auto" picks what
// fits the menu style; Studio > Transitions sets kind and speed.
import { createEffect, on } from "solid-js";
import { useLocation } from "@solidjs/router";
import { doc } from "~/studio/store";
import type { SceneTransitionKind, Skin } from "~/studio/types";
import { TABS } from "./scenes";
import styles from "./SceneWipe.module.css";

type Kind = Exclude<SceneTransitionKind, "auto">;

/** Each style's own: VGUI and the terminal cut hard, Minecraft dissolves, the rest move. */
const STYLE_DEFAULTS: Record<Skin, Kind> = {
  modern: "slide",
  beta: "fade",
  current: "fade",
  glass: "glass",
  valnow: "slide",
  csgo: "fade",
  cs2: "zoom",
  cs16: "none",
  terminal: "build",
  fortnite: "shutter",
  minecraft: "pixel",
  halo: "blur",
  pipboy: "fade",
  league: "fade",
  phantom: "wipe",
  nightcity: "shutter",
};

const BASE_MS: Record<Kind, number> = {
  none: 0,
  fade: 260,
  slide: 360,
  zoom: 340,
  blur: 380,
  build: 420,
  shutter: 520,
  pixel: 360,
  wipe: 420,
  glass: 640,
};
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const BUILD_STAGGER_MS = 50;
const PIXEL_STEPS = 6;
const GLASS_STAGGER_MS = 45;
/** Slight overshoot, so the pieces settle rather than stop. */
const GLASS_EASE = "cubic-bezier(0.2, 1.15, 0.35, 1)";

export function resolveTransition(kind: SceneTransitionKind, skin: Skin): Kind {
  return kind === "auto" ? STYLE_DEFAULTS[skin] : kind;
}

function tabIndex(pathname: string): number {
  return TABS.findIndex((tab) => `/${tab.id}` === pathname);
}

export function SceneWipe() {
  const location = useLocation();
  let band: HTMLDivElement | undefined;
  let shutterTop: HTMLDivElement | undefined;
  let shutterBottom: HTMLDivElement | undefined;

  createEffect(
    on(
      () => location.pathname,
      (pathname, previous) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const kind = resolveTransition(doc.theme.transition.kind, doc.theme.skin);
        const duration = BASE_MS[kind] * doc.theme.transition.speed;
        const scene = document.querySelector<HTMLElement>("[data-part='scene']");
        if (!scene || duration === 0) return;
        // Toward the side of the tab: right of the old one slides in from the right.
        const direction = previous && tabIndex(pathname) < tabIndex(previous) ? -1 : 1;
        const timing = { duration, easing: EASE_OUT };
        switch (kind) {
          case "fade":
            scene.animate([{ opacity: 0 }, { opacity: 1 }], timing);
            break;
          case "slide":
            scene.animate(
              [
                { opacity: 0, translate: `${direction * 48}px 0` },
                { opacity: 1, translate: "0 0" },
              ],
              timing,
            );
            break;
          case "zoom":
            scene.animate(
              [
                { opacity: 0, scale: "0.965" },
                { opacity: 1, scale: "1" },
              ],
              timing,
            );
            break;
          case "blur":
            scene.animate(
              [
                { opacity: 0, filter: "blur(14px)" },
                { opacity: 1, filter: "blur(0)" },
              ],
              timing,
            );
            break;
          case "build": {
            const pieces = [...scene.querySelectorAll<HTMLElement>("[data-vt]")];
            pieces
              .map((piece) => ({ piece, box: piece.getBoundingClientRect() }))
              .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
              .forEach(({ piece }, index) =>
                // translate/scale, never transform: a piece's transform is its position.
                piece.animate(
                  [
                    { opacity: 0, translate: "0 18px", scale: "0.97" },
                    { opacity: 1, translate: "0 0", scale: "1" },
                  ],
                  { ...timing, delay: index * BUILD_STAGGER_MS * doc.theme.transition.speed, fill: "backwards" },
                ),
              );
            break;
          }
          case "glass": {
            // Pieces glide in from the side you moved toward, unblurring as they land, nearest
            // the top-left first. The old scene's light lingers for a beat via the backdrop.
            const pieces = [...scene.querySelectorAll<HTMLElement>("[data-vt]")];
            pieces
              .map((piece) => ({ piece, box: piece.getBoundingClientRect() }))
              .sort((a, b) => a.box.left + a.box.top - (b.box.left + b.box.top))
              .forEach(({ piece }, index) =>
                piece.animate(
                  [
                    { opacity: 0, translate: `${direction * 36}px 10px`, scale: "0.965", filter: "blur(14px)" },
                    { opacity: 1, translate: "0 0", scale: "1", filter: "blur(0)" },
                  ],
                  {
                    duration,
                    easing: GLASS_EASE,
                    delay: index * GLASS_STAGGER_MS * doc.theme.transition.speed,
                    fill: "backwards",
                  },
                ),
              );
            break;
          }
          case "pixel":
            scene.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: `steps(${PIXEL_STEPS}, end)` });
            break;
          case "shutter":
            for (const [element, from] of [
              [shutterTop, "translateY(0)"],
              [shutterBottom, "translateY(0)"],
            ] as const) {
              element?.animate(
                [
                  { transform: from, opacity: 1 },
                  { transform: element === shutterTop ? "translateY(-100%)" : "translateY(100%)", opacity: 1 },
                ],
                { duration, easing: "cubic-bezier(0.7, 0, 0.3, 1)" },
              );
            }
            scene.animate([{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }], { duration });
            break;
          case "wipe":
            band?.animate(
              [
                { transform: "translateX(-120%) skewX(-18deg)", opacity: 1 },
                { transform: "translateX(120%) skewX(-18deg)", opacity: 1 },
              ],
              { duration, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
            );
            break;
          case "none":
            break;
        }
      },
      { defer: true },
    ),
  );

  return (
    <>
      <div ref={band} class={styles.band} aria-hidden="true" />
      <div ref={shutterTop} class={`${styles.shutter} ${styles.shutterTop}`} aria-hidden="true" />
      <div ref={shutterBottom} class={`${styles.shutter} ${styles.shutterBottom}`} aria-hidden="true" />
    </>
  );
}
