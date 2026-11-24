// Colour helpers shared by the theme (theme.ts, the whole menu) and a piece's own accent
// (pieceLook.ts), so both pick the same label colour and the same hover/pressed shades.

/** Hover and pressed shades of an accent, as `color-mix` percentages of it (rest white/black).
 * stage.module.css writes the same numbers for a piece's own accent. */
export const ACCENT_HOVER_MIX = 86;
export const ACCENT_PRESSED_MIX = 84;

/** Perceived brightness above which dark text reads better on a colour (tuned on the styles'
 * accents: VALORANT red keeps white labels, Mono's near-white gets black ones). */
const LIGHT_BRIGHTNESS = 0.62;
const DARK_LABEL = "#0b0b0e";
const LIGHT_LABEL = "#ffffff";

/** `#rrggbb` -> `r g b` for `rgb(var(--x) / alpha)` style tokens. */
export function hexToRgbTriplet(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const value = match?.[1] ? Number.parseInt(match[1], 16) : 0;
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

/** A full `#rrggbb` colour, the only form colour inputs write and the theme applies. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The PLAY tokens a theme Play colour sets; the style sheets define them when it is empty. */
export const PLAY_TOKENS = ["--play", "--play-hover", "--play-pressed", "--on-play"] as const;

/** PLAY button tokens for the player's Play colour, or null to keep the style's own. */
export function playVars(play: string): Record<(typeof PLAY_TOKENS)[number], string> | null {
  // Typed as a string, but a pasted look is parsed JSON, so check at runtime too.
  if (typeof play !== "string" || !HEX_COLOR.test(play)) return null;
  return {
    "--play": play,
    "--play-hover": `color-mix(in oklch, ${play} ${ACCENT_HOVER_MIX}%, white)`,
    "--play-pressed": `color-mix(in oklch, ${play} ${ACCENT_PRESSED_MIX}%, black)`,
    "--on-play": onColor(play),
  };
}

/** Readable text colour on top of `hex` (black on light accents such as Mono). */
export function onColor(hex: string): string {
  const [r = 0, g = 0, b = 0] = hexToRgbTriplet(hex).split(" ").map(Number);
  const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return brightness > LIGHT_BRIGHTNESS ? DARK_LABEL : LIGHT_LABEL;
}
