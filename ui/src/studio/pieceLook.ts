// A piece's own size, density and accent, on top of the menu style. Applied by the stage frame
// (Stage.tsx + stage.module.css), so every piece in every style gets them without its own code:
// size zooms the content (text, art and spacing grow while the piece keeps its box; pieces that
// size themselves from their box change less), density retunes the spacing tokens, and accent
// replaces the style's accent.
import { onColor } from "./colors";
import { DEFAULT_STYLE } from "./defaults";
import type { Density, PieceStyle } from "./types";

export const PIECE_SCALE = { min: 0.75, max: 1.5, step: 0.05 } as const;
const AS_DESIGNED = 1;

/** Spacing multiplier per density; comfortable is the style's own spacing. */
export const DENSITY_FACTORS: Record<Density, number> = { compact: 0.7, comfortable: 1, spacious: 1.3 };

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return AS_DESIGNED;
  return Math.min(PIECE_SCALE.max, Math.max(PIECE_SCALE.min, scale));
}

/** A `#rrggbb` accent, or null for "the style's accent" (empty or anything unreadable). */
export function accentOf(style: PieceStyle): string | null {
  return HEX_COLOR.test(style.accent) ? style.accent.toLowerCase() : null;
}

/** The CSS variables the frame sets; only what differs from the style is set. */
export function pieceLookVars(style: PieceStyle): Record<string, string> {
  const vars: Record<string, string> = {};
  const scale = clampScale(style.scale);
  if (scale !== AS_DESIGNED) vars["--piece-scale"] = String(scale);
  const density = DENSITY_FACTORS[style.density] ?? DENSITY_FACTORS.comfortable;
  if (density !== DENSITY_FACTORS.comfortable) vars["--piece-density"] = String(density);
  const accent = accentOf(style);
  if (accent) {
    vars["--piece-accent"] = accent;
    vars["--piece-on-accent"] = onColor(accent);
  }
  return vars;
}

/** How a piece of this kind is drawn untouched: the shared defaults plus its definition's own
 * (a match score starts as a rounded panel). "Reset look" goes back to this. */
export function baseStyleOf(defStyle: Partial<PieceStyle> | undefined): PieceStyle {
  return { ...DEFAULT_STYLE, ...(defStyle ?? {}) };
}
