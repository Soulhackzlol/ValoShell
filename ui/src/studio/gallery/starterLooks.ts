// Starter looks for the gallery: a style plus a few colour picks, built into a full Studio
// document on demand. Kept as data (not saved documents) so they follow the styles' own
// layouts as those change, and cost nothing to ship. Each has a screenshot in thumbs/, made by
// `node ui/scripts/look-thumbs.mjs starters`; rerun it after changing a look or its style.
import { defaultDoc } from "../defaults";
import { SKINS } from "../skins";
import { switchStyle } from "../styleSwitch";
import type { Skin, StudioDoc, Theme } from "../types";

type ThemeColours = Partial<Pick<Theme, "accent" | "accent2" | "ground" | "text" | "play">>;

export interface StarterLook {
  id: string;
  name: string;
  /** One line under the name: what makes it different. */
  caption: string;
  skin: Skin;
  colours?: ThemeColours;
  /** Style colour roles (theme/palettes.ts), token -> `#rrggbb`. */
  palette?: Record<string, string>;
}

export const STARTER_LOOKS: readonly StarterLook[] = [
  {
    id: "radiant-glass",
    name: "Radiant Glass",
    caption: "Frosted panels with gold rings and a gold Play",
    skin: "glass",
    colours: { accent: "#e8b04b", accent2: "#fff1c4", play: "#e8b04b" },
    palette: { "glass-ring": "#e8b04b", "glass-online": "#e8b04b" },
  },
  {
    id: "midnight-client",
    name: "Midnight Client",
    caption: "Today's client in deep navy and violet",
    skin: "current",
    colours: { play: "#7c5cff" },
    palette: { "current-panel": "#0b1020", "current-red": "#7c5cff", "current-teal": "#5ee1ff" },
  },
  {
    id: "neon-counter",
    name: "Neon Counter",
    caption: "CS2 slabs with teal tabs and a teal GO",
    skin: "cs2",
    colours: { play: "#19e3c6" },
    palette: { "cs2-go": "#19e3c6", "cs2-tab": "#19e3c6", "cs2-name": "#e6ff4f" },
  },
  {
    id: "sakura-beta",
    name: "Sakura Beta",
    caption: "Project A in blossom pink",
    skin: "beta",
    colours: { play: "#ff7eb6" },
    palette: { "beta-mint": "#ffd1e8", "beta-red": "#ff7eb6" },
  },
  {
    id: "ember-halo",
    name: "Ember Halo",
    caption: "Halo 3's menus at sunset",
    skin: "halo",
    colours: { play: "#ffb347" },
    palette: { "halo-accent": "#ffb347", "halo-glass": "#5c2a0e", "halo-frost": "#ffe2c2" },
  },
  {
    id: "hextech-frost",
    name: "Hextech Frost",
    caption: "League's client with ice-blue metal",
    skin: "league",
    palette: { "league-gold": "#9fd0ff", "league-gold-dark": "#2f5f8f", "league-teal": "#e6ff4f" },
  },
  {
    id: "calling-card",
    name: "Calling Card",
    caption: "Phantom in its own red, black and white",
    skin: "phantom",
  },
  {
    id: "after-dark",
    name: "After Dark",
    caption: "Night City with hot pink highlights",
    skin: "nightcity",
    colours: { accent: "#ff2e88", play: "#ff2e88" },
    palette: { "nightcity-yellow": "#ff2e88" },
  },
];

const THUMBS = import.meta.glob<string>("./thumbs/*.webp", { eager: true, query: "?url", import: "default" });

/** The look's screenshot, or undefined when none was made yet (the card draws a sketch). */
export function starterThumb(look: StarterLook): string | undefined {
  return THUMBS[`./thumbs/${look.id}.webp`];
}

/** The full document a starter look applies: the style's own bundle, then its colour picks. */
export function starterDoc(look: StarterLook): StudioDoc {
  const doc = defaultDoc();
  const skin = SKINS.find((option) => option.id === look.skin);
  if (skin) switchStyle(doc, skin);
  Object.assign(doc.theme, look.colours ?? {});
  doc.theme.palette = { ...(look.palette ?? {}) };
  return doc;
}
