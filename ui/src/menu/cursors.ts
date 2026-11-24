// Each style's own mouse pointer, drawn as a small SVG: Minecraft's chunky pixel arrow, CS 1.6's
// plain white one, the terminal's phosphor block, Fortnite's fat yellow arrow... The "hot"
// version shows over anything clickable. Set as --cursor / --cursor-hot (theme/fx.css).
import type { Skin } from "~/studio/types";

/** The classic arrow, 24x24 user units, tip at (3, 2). */
const ARROW = "M3 2 L3 19.5 L7.6 15.2 L10.6 21.8 L13.6 20.5 L10.7 14 L16.8 14 Z";
/** A stepped arrow on a 1.4-unit grid, for the pixel styles. */
const PIXEL_ARROW =
  "M3 2 L4.4 2 L4.4 3.4 L5.8 3.4 L5.8 4.8 L7.2 4.8 L7.2 6.2 L8.6 6.2 L8.6 7.6 L10 7.6 L10 9 L11.4 9 L11.4 10.4 L12.8 10.4 L12.8 11.8 L14.2 11.8 L14.2 13.2 L15.6 13.2 L15.6 14.6 L17 14.6 L17 17.4 L11.4 17.4 L11.4 18.8 L10 18.8 L10 20.2 L8.6 20.2 L8.6 21.6 L7.2 21.6 L7.2 23 L5.8 23 L5.8 24.4 L4.4 24.4 L4.4 25.8 L3 25.8 Z";

interface CursorLook {
  fill: string;
  stroke: string;
  hotFill: string;
  path: string;
  /** Soft glow around the arrow (Halo's shields, the terminal's phosphor). */
  glow?: string;
  strokeWidth?: number;
  isPixel?: boolean;
}

function looks(accent: string): Record<Skin, CursorLook> {
  return {
    modern: { fill: "#ffffff", stroke: "#0a0a0e", hotFill: accent, path: ARROW },
    beta: { fill: "#eef1f0", stroke: "#0c1315", hotFill: "#bfe1dd", path: ARROW },
    glass: { fill: "#ffffff", stroke: "#1c1c1e", hotFill: "#ffffff", path: ARROW, strokeWidth: 1 },
    current: { fill: "#ffffff", stroke: "#0f1923", hotFill: "#ffffff", path: ARROW, strokeWidth: 1.2 },
    valnow: { fill: "#ece8e1", stroke: "#0f1923", hotFill: accent, path: ARROW },
    csgo: { fill: "#ffffff", stroke: "#1b2026", hotFill: "#de9b35", path: ARROW },
    cs2: { fill: "#ffffff", stroke: "#000000", hotFill: "#d7d7d7", path: ARROW, strokeWidth: 1 },
    cs16: { fill: "#ffffff", stroke: "#000000", hotFill: "#ffb000", path: ARROW, strokeWidth: 1 },
    terminal: { fill: accent, stroke: "#000000", hotFill: "#ffffff", path: PIXEL_ARROW, glow: accent, isPixel: true },
    fortnite: { fill: "#fbe925", stroke: "#121212", hotFill: "#ffffff", path: ARROW, strokeWidth: 2.4 },
    minecraft: { fill: "#ffffff", stroke: "#000000", hotFill: "#ffff55", path: PIXEL_ARROW, isPixel: true, strokeWidth: 2 },
    halo: { fill: "#e8f8ff", stroke: "#06223a", hotFill: "#6fd4ff", path: ARROW, glow: "#6fd4ff" },
    pipboy: { fill: accent, stroke: "#021108", hotFill: "#d6ffe6", path: ARROW, glow: accent, strokeWidth: 1.4 },
    league: { fill: "#c8aa6e", stroke: "#1e2328", hotFill: "#f0e6d2", path: ARROW, strokeWidth: 1.4 },
    phantom: { fill: "#ffffff", stroke: "#000000", hotFill: accent, path: ARROW, strokeWidth: 2.2 },
    nightcity: { fill: accent, stroke: "#000000", hotFill: "#ff5e57", path: ARROW, glow: "#5ef6ff", strokeWidth: 1.4 },
  };
}

function svgCursor(look: CursorLook, fill: string): string {
  const glow = look.glow
    ? `<filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2"/></filter><path d="${look.path}" fill="${look.glow}" opacity="0.7" filter="url(#g)"/>`
    : "";
  const crisp = look.isPixel ? ' shape-rendering="crispEdges"' : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"${crisp}>${glow}` +
    `<path d="${look.path}" fill="${fill}" stroke="${look.stroke}" stroke-width="${look.strokeWidth ?? 1.6}" stroke-linejoin="${look.isPixel ? "miter" : "round"}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 2, auto`;
}

/** CSS cursor values for a style: the normal pointer and the one over clickable things. */
export function cursorsFor(skin: Skin, accent: string): { base: string; hot: string } {
  const look = looks(accent)[skin];
  return { base: svgCursor(look, look.fill), hot: svgCursor(look, look.hotFill) };
}
