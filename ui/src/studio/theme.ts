// Applies the Studio theme to the document: semantic colour tokens, fonts, cut size and scale.
// Components only read tokens, so a theme change restyles everything in one style recalc.
import { createEffect, createRoot } from "solid-js";
import { cursorsFor } from "~/menu/cursors";
import { setSoundOptions } from "~/menu/sound";
import { paletteVars } from "~/theme/palettes";
import { ACCENT_HOVER_MIX, ACCENT_PRESSED_MIX, PLAY_TOKENS, hexToRgbTriplet, onColor, playVars } from "./colors";
import type { DisplayFont, Theme } from "./types";

export { hexToRgbTriplet, onColor };
import { doc } from "./store";

const DISPLAY_FONTS: Record<DisplayFont, string> = {
  saira: '"Saira Variable", "Bahnschrift", sans-serif',
  tall: '"Oswald Variable", "Bahnschrift Condensed", sans-serif',
  inter: '"Inter Variable", "Segoe UI", sans-serif',
  mono: '"JetBrains Mono Variable", Consolas, monospace',
  classic: 'Tahoma, Verdana, "Segoe UI", sans-serif',
  pixel: '"Pixelify Sans Variable", monospace',
  robco: '"Share Tech Mono", "JetBrains Mono Variable", monospace',
  beaufort: '"Beaufort for LOL", "Cinzel Variable", Georgia, serif',
  poster: '"Anton", Impact, "Bahnschrift Condensed", sans-serif',
  tech: '"Rajdhani", "Bahnschrift SemiCondensed", sans-serif',
};

/** Palette variables set by the last apply, so a reset or style switch removes them again. */
const appliedPalette = new Set<string>();

/** Set the active style's recoloured roles and clear the ones no longer recoloured. */
function applyPalette(theme: Theme, style: CSSStyleDeclaration): void {
  const vars = paletteVars(theme.skin, theme.palette);
  for (const name of appliedPalette) if (!(name in vars)) style.removeProperty(name);
  appliedPalette.clear();
  for (const [name, value] of Object.entries(vars)) {
    style.setProperty(name, value);
    appliedPalette.add(name);
  }
}

/**
 * The player's Play colour on the root, or the style's own when none is picked. `--play...`
 * beats the style sheets' `:root[data-skin]` values for buttons that read them; the
 * `--theme-play...` copies exist only while a colour is picked, so styles with a designed PLAY
 * button (gradients, textures) write `var(--theme-play, <their design>)` and keep it untouched.
 * A piece's own accent still wins on that piece.
 */
function applyPlay(theme: Theme, style: CSSStyleDeclaration): void {
  const vars = playVars(theme.play);
  for (const token of PLAY_TOKENS) {
    const picked = `--theme-${token.slice(2)}`;
    if (vars) {
      style.setProperty(token, vars[token]);
      style.setProperty(picked, vars[token]);
    } else {
      style.removeProperty(token);
      style.removeProperty(picked);
    }
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  const style = root.style;
  style.setProperty("--accent", theme.accent);
  style.setProperty("--accent-hover", `color-mix(in oklch, ${theme.accent} ${ACCENT_HOVER_MIX}%, white)`);
  style.setProperty("--accent-pressed", `color-mix(in oklch, ${theme.accent} ${ACCENT_PRESSED_MIX}%, black)`);
  style.setProperty("--accent-gradient-end", theme.accent2);
  style.setProperty("--accent-2", theme.accent2);
  style.setProperty("--on-accent", onColor(theme.accent));
  style.setProperty("--ground", theme.ground);
  style.setProperty("--ground-rgb", hexToRgbTriplet(theme.ground));
  style.setProperty("--paper-100", theme.text);
  style.setProperty("--text-1", theme.text);
  style.setProperty("--text-rgb", hexToRgbTriplet(theme.text));
  style.setProperty("--text-2", `rgb(${hexToRgbTriplet(theme.text)} / 0.66)`);
  style.setProperty("--text-3", `rgb(${hexToRgbTriplet(theme.text)} / 0.46)`);
  style.setProperty("--font-display", DISPLAY_FONTS[theme.displayFont]);
  style.setProperty("--cut", `${theme.cut}px`);
  style.setProperty("--vignette", String(theme.vignette));
  style.setProperty("--grain", theme.isGrainy ? "0.07" : "0");
  root.dataset["skin"] = theme.skin;
  applyPalette(theme, style);
  applyPlay(theme, style);
  const cursors = cursorsFor(theme.skin, theme.accent);
  style.setProperty("--cursor", cursors.base);
  style.setProperty("--cursor-hot", cursors.hot);
  if (theme.fx.isCursorOn) root.dataset["cursor"] = "";
  else delete root.dataset["cursor"];
  setSoundOptions({ ...theme.sound, skin: theme.skin });
}

/** Keep the document styled from the live Studio theme. Call once per window. */
export function bindTheme(): void {
  createRoot(() => createEffect(() => applyTheme(doc.theme)));
}
