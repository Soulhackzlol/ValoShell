// Each style's own colours as data: the named roles its stylesheet paints with (panels, text,
// highlight...). The stylesheet reads `var(--<token>, <default>)`, so it draws as designed until
// the player recolours a role in Studio > Theme > Style colours; overrides live in the Studio
// document (`theme.palette`), so they are saved, undone and shared with the rest of a look.
// A role may drive a family of near shades (VALORANT's panels are six navies): untouched, each
// part keeps its own shade as fallback; recoloured, they deliberately become the one picked colour,
// which keeps the list short. `value` is the family's main shade, shown in the picker.
import { HEX_COLOR } from "~/studio/colors";
import type { Skin } from "~/studio/types";

export interface PaletteEntry {
  /** CSS custom property without the dashes, prefixed with the style id (`csgo-ink`). */
  token: string;
  label: string;
  /** `#rrggbb`, the colour the style was designed with. */
  value: string;
  /** The style's main panel colour (one per style): look previews fill their boxes with it. */
  isSurface?: true;
}

export const PALETTES: Partial<Record<Skin, readonly PaletteEntry[]>> = {
  csgo: [
    { token: "csgo-panel", label: "Panels", value: "#1e2329", isSurface: true },
    { token: "csgo-bar", label: "Title bars", value: "#2a3138" },
    { token: "csgo-ink", label: "Body text", value: "#dfe3e8" },
    { token: "csgo-bright", label: "Bright text", value: "#ffffff" },
    { token: "csgo-muted", label: "Muted text", value: "#9aa4ae" },
    { token: "csgo-highlight", label: "Selected and active", value: "#de9b35" },
    { token: "csgo-link", label: "Links", value: "#8fb3d9" },
    { token: "csgo-line", label: "Lines and sheen", value: "#ffffff" },
  ],
  cs2: [
    { token: "cs2-slab", label: "Panels", value: "#0c0e12", isSurface: true },
    { token: "cs2-ink", label: "Body text", value: "#ffffff" },
    { token: "cs2-muted", label: "Muted text", value: "#8a929c" },
    { token: "cs2-line", label: "Lines and surfaces", value: "#ffffff" },
    { token: "cs2-tab", label: "Selected tab", value: "#f0f2f5" },
    { token: "cs2-tab-ink", label: "Selected tab text", value: "#0d1015" },
    { token: "cs2-go", label: "Filled slots and invites", value: "#4f9d3d" },
    { token: "cs2-name", label: "Online names", value: "#57cbde" },
    { token: "cs2-ingame", label: "In-game names", value: "#90ba3c" },
    { token: "cs2-warm", label: "Queueing and party", value: "#e8b04b" },
  ],
  current: [
    { token: "current-panel", label: "Panels", value: "#0f1923", isSurface: true },
    { token: "current-tile", label: "Tiles and cards", value: "#222d38" },
    { token: "current-ink", label: "Body text", value: "#ece8e1" },
    { token: "current-bright", label: "Bright text", value: "#ffffff" },
    { token: "current-muted", label: "Muted text", value: "#a6a9ad" },
    { token: "current-line", label: "Lines, edges and light fills", value: "#ece8e1" },
    { token: "current-red", label: "Red stripes and Find match", value: "#ff4655" },
    { token: "current-teal", label: "Ready and progress", value: "#2ee6c5" },
    { token: "current-gold", label: "Gold", value: "#f0c86a" },
  ],
  beta: [
    { token: "beta-paper", label: "Paper", value: "#ece8e1" },
    { token: "beta-navy", label: "Navy", value: "#0f1923", isSurface: true },
    { token: "beta-red", label: "Red", value: "#ff4655" },
    { token: "beta-mint", label: "Mint highlights", value: "#bfe1dd" },
    { token: "beta-gold", label: "Gold", value: "#f2b843" },
    { token: "beta-text", label: "Body text", value: "#ffffff" },
    { token: "beta-line", label: "Lines and surfaces", value: "#ffffff" },
  ],
  fortnite: [
    { token: "fortnite-yellow", label: "Yellow", value: "#fbe925" },
    { token: "fortnite-yellow-edge", label: "Yellow edges", value: "#cdbb0b" },
    { token: "fortnite-navy", label: "Panels", value: "#081246", isSurface: true },
    { token: "fortnite-ready", label: "Ready tag", value: "#5ee05a" },
    { token: "fortnite-text", label: "Body text", value: "#ffffff" },
    { token: "fortnite-line", label: "Lines and surfaces", value: "#ffffff" },
  ],
  minecraft: [
    { token: "minecraft-panel", label: "Inventory panels", value: "#c6c6c6", isSurface: true },
    { token: "minecraft-slot", label: "Slots", value: "#8b8b8b" },
    { token: "minecraft-select", label: "Selected trade", value: "#7b86bd" },
    { token: "minecraft-hover", label: "Hovered text and selection", value: "#ffffa0" },
    { token: "minecraft-text", label: "Body text", value: "#ffffff" },
    { token: "minecraft-label", label: "Dark labels", value: "#404040" },
    { token: "minecraft-yellow", label: "Yellow text", value: "#ffff00" },
    { token: "minecraft-muted", label: "Muted text", value: "#a0a0a0" },
  ],
  halo: [
    { token: "halo-accent", label: "Cyan", value: "#6fd4ff" },
    { token: "halo-frost", label: "Ice text", value: "#c7ecff" },
    { token: "halo-glass", label: "Panels", value: "#0e345c", isSurface: true },
    { token: "halo-text", label: "Body text", value: "#ffffff" },
    { token: "halo-line", label: "Lines and edges", value: "#ffffff" },
  ],
  league: [
    { token: "league-navy", label: "Navy", value: "#0a1428", isSurface: true },
    { token: "league-frame", label: "Frames", value: "#1e2328" },
    { token: "league-gold", label: "Gold", value: "#c8aa6e" },
    { token: "league-gold-dark", label: "Dark gold", value: "#785a28" },
    { token: "league-cream", label: "Cream", value: "#f0e6d2" },
    { token: "league-label", label: "Labels", value: "#cdbe91" },
    { token: "league-teal", label: "Hextech teal", value: "#0ac8b9" },
  ],
  glass: [
    { token: "glass-fill", label: "Panels", value: "#181a20", isSurface: true },
    { token: "glass-text", label: "Body text", value: "#f5f5f7" },
    { token: "glass-bright", label: "Bright text", value: "#ffffff" },
    { token: "glass-line", label: "Lines and sheen", value: "#ffffff" },
    { token: "glass-ring", label: "Ready checks", value: "#30d158" },
    { token: "glass-online", label: "Online and invited", value: "#30d158" },
    { token: "glass-busy", label: "Queueing and in a match", value: "#0a84ff" },
    { token: "glass-away", label: "Away and party leader", value: "#ffd60a" },
  ],
  phantom: [
    { token: "phantom-ink", label: "Paper black", value: "#0b0b0b", isSurface: true },
    { token: "phantom-paper", label: "Paper white", value: "#ffffff" },
    { token: "phantom-red", label: "Slashes and stamps", value: "#e5191c" },
  ],
  nightcity: [
    { token: "nightcity-panel", label: "Panels", value: "#0e0b10", isSurface: true },
    { token: "nightcity-red", label: "Frames and labels", value: "#ff5e57" },
    { token: "nightcity-cyan", label: "Selection and values", value: "#5ef6ff" },
    { token: "nightcity-yellow", label: "PLAY and logo", value: "#fcee0a" },
  ],
};

/** The style's colour roles; empty for styles not described yet. */
export function paletteOf(skin: Skin): readonly PaletteEntry[] {
  return PALETTES[skin] ?? [];
}

/** CSS variables for the player's overrides of `skin`'s roles; unknown tokens and bad colours are skipped. */
export function paletteVars(skin: Skin, overrides: Readonly<Record<string, string>>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const entry of paletteOf(skin)) {
    const value = overrides[entry.token];
    if (typeof value === "string" && HEX_COLOR.test(value)) vars[`--${entry.token}`] = value.toLowerCase();
  }
  return vars;
}
