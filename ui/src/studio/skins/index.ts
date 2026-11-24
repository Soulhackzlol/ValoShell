// Menu styles that echo other games' menus. Picking one applies its whole theme bundle
// (colours, display font, corners, grain, sometimes the backdrop) and lays out Home, Play,
// Career and Store with that style's own pieces; TopNav draws the style's own nav and
// theme/skins.css restyles panels and controls. Everything stays editable afterwards, and one
// undo restores the previous setup. Bundles live in bundles.ts, each style's screens in
// layouts.ts; this file applies them and answers what a style calls things.
import { DEFAULT_THEME } from "../defaults";
import type { Backdrop, Skin, StageId, StudioDoc } from "../types";
import { SKINS, type SkinBundle } from "./bundles";
import { LAYOUTS, LAYOUT_REVISIONS, STYLED_STAGES, type Layout } from "./layouts";

export { SKINS, WINDOWED_SKINS, type SkinBundle } from "./bundles";
export { STYLED_STAGES } from "./layouts";

/** Tab names a style uses instead of the defaults (CS:GO calls the collection Inventory...). */
const TAB_LABELS: Partial<Record<Skin, Partial<Record<StageId, string>>>> = {
  current: { career: "Progress", play: "Modes" },
  beta: { career: "Progression", agents: "Agents", collection: "Collection" },
  csgo: { collection: "Inventory", career: "Stats" },
  cs2: { collection: "Inventory" },
  cs16: { home: "Main menu", play: "Find match", collection: "Inventory", career: "Stats" },
  fortnite: { home: "Lobby", collection: "Locker", store: "Item Shop" },
  minecraft: { home: "Title", collection: "Inventory", career: "Statistics", store: "Trading" },
  halo: { home: "Lobby", play: "Matchmaking", collection: "Armory", career: "Service Record" },
  pipboy: { home: "Stat", play: "Map", agents: "Special", collection: "Inv", career: "Data", store: "Barter" },
  league: { career: "Profile" },
  phantom: { home: "Hideout", play: "Mission", collection: "Items", career: "Stats" },
  nightcity: { home: "Hub", play: "Gigs", collection: "Inventory", career: "Stats", store: "Market" },
};

/** Which style a piece kind belongs to (its prefix), or null for the menu's own pieces. */
const FAMILY_PREFIXES: readonly [string, Skin][] = [
  ["cs2-", "cs2"],
  ["csgo-", "csgo"],
  ["cs16-", "cs16"],
  ["beta-", "beta"],
  ["terminal-", "terminal"],
  ["fn-", "fortnite"],
  ["mc-", "minecraft"],
  ["halo-", "halo"],
  ["pip-", "pipboy"],
  ["lol-", "league"],
  ["val-", "current"],
  ["v22-", "valnow"],
  ["glass-", "glass"],
  ["ph-", "phantom"],
  ["nc-", "nightcity"],
];

export function pieceFamily(kind: string): Skin | null {
  return FAMILY_PREFIXES.find(([prefix]) => kind.startsWith(prefix))?.[1] ?? null;
}

export function skinLabel(id: Skin): string {
  return SKINS.find((skin) => skin.id === id)?.label ?? id;
}

/** The style's name where room is tight. */
export function skinShortLabel(id: Skin): string {
  const skin = SKINS.find((entry) => entry.id === id);
  return skin?.short ?? skin?.label ?? id;
}

export function tabLabel(skin: Skin, stage: StageId, fallback: string): string {
  return TAB_LABELS[skin]?.[stage] ?? fallback;
}

function applyLayouts(doc: StudioDoc, skin: Skin, previousLayout: Layout): void {
  const layout = LAYOUTS[skin];
  for (const stage of STYLED_STAGES) {
    const build = layout[stage];
    if (build) doc.stages[stage] = build();
    // Only clear a screen the previous style laid out; one the player built stays.
    else if (previousLayout[stage]) delete doc.stages[stage];
  }
  const revision = LAYOUT_REVISIONS[skin];
  if (revision !== undefined) doc.layouts = { ...doc.layouts, [skin]: revision };
}

/** Re-lay a loaded document's screens when its style's layouts were reworked since they were
    applied. Returns whether anything changed (the caller saves). */
export function refreshLayouts(doc: StudioDoc): boolean {
  const skin = doc.theme.skin;
  const revision = LAYOUT_REVISIONS[skin];
  if (revision === undefined || (doc.layouts?.[skin] ?? 0) >= revision) return false;
  applyLayouts(doc, skin, LAYOUTS[skin] ?? {});
  return true;
}

/** Apply a style's whole bundle and its layouts to a document draft. */
export function applySkin(doc: StudioDoc, skin: SkinBundle): void {
  const draft = doc.theme;
  // Undo the backdrop the previous style forced (CS:GO's haze, the terminal's ASCII).
  const previous = SKINS.find((option) => option.id === draft.skin)?.backdrop;
  const previousLayout: Layout = LAYOUTS[draft.skin] ?? {};
  if (previous) {
    for (const key of Object.keys(previous) as (keyof Backdrop)[]) {
      Object.assign(draft.backdrop, { [key]: DEFAULT_THEME.backdrop[key] });
    }
  }
  draft.skin = skin.id;
  draft.preset = skin.id === "modern" ? "valorant" : "custom";
  draft.accent = skin.accent;
  draft.accent2 = skin.accent2;
  draft.ground = skin.ground;
  draft.text = skin.text;
  // Like the colours above, PLAY goes back to the new style's own (empty = the sheet's value).
  draft.play = "";
  draft.displayFont = skin.displayFont;
  draft.cut = skin.cut;
  draft.isGrainy = skin.isGrainy;
  draft.vignette = skin.vignette;
  if (skin.backdrop) Object.assign(draft.backdrop, skin.backdrop);
  applyLayouts(doc, skin.id, previousLayout);
}
