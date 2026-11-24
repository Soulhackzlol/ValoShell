// Checks for documents from outside the app (a look someone shared as a file or text, a saved
// file edited by hand). normalizeDoc runs these before anything reaches CSS or the stage:
// colours become CSS variables, so only `#rrggbb` passes (a `url(...)` would make the menu
// contact a stranger's server); unknown ids fall back, and a piece without a usable rect is
// dropped instead of breaking every view that draws it.
import { HEX_COLOR } from "./colors";
import {
  BACKDROP_KIND_IDS,
  BACKDROP_PICK_IDS,
  DISPLAY_FONT_IDS,
  FIGURE_LOOK_IDS,
  SKIN_IDS,
  type Piece,
  type Rect,
  type Skin,
  type Theme,
} from "./types";

const THEME_COLOURS = ["accent", "accent2", "ground", "text"] as const;
const THEME_NUMBERS = ["cut", "vignette", "parallax"] as const;
const BACKDROP_NUMBERS = [
  "asciiSize",
  "blur",
  "dim",
  "offsetX",
  "offsetY",
  "zoom",
  "rotate",
  "motionSpeed",
  "hue",
  "saturation",
  "figureX",
  "figureY",
  "figureScale",
] as const;
const BACKDROP_TEXTS = ["url", "agentUuid", "mapId", "gameVideo"] as const;
const BACKDROP_SWITCHES = ["isAscii", "isNameOn", "isFigureMirrored"] as const;

export const isHex = (value: unknown): value is string => typeof value === "string" && HEX_COLOR.test(value);
export const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

/** Only `#rrggbb` values under string keys survive. */
export function safePalette(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => isHex(value)));
}

/** The backdrop's ids, texts and switches; its numbers are checked with the theme's. */
function repairBackdrop(backdrop: Theme["backdrop"], base: Theme["backdrop"]): void {
  if (!isOneOf(BACKDROP_KIND_IDS, backdrop.kind)) backdrop.kind = base.kind;
  if (!isOneOf(BACKDROP_PICK_IDS, backdrop.pick)) backdrop.pick = base.pick;
  if (!isOneOf(FIGURE_LOOK_IDS, backdrop.figureLook)) backdrop.figureLook = base.figureLook;
  for (const key of BACKDROP_TEXTS) if (typeof backdrop[key] !== "string") backdrop[key] = base[key];
  for (const key of BACKDROP_SWITCHES) if (typeof backdrop[key] !== "boolean") backdrop[key] = base[key];
}

/** Put back the defaults for any colour, id or number the merged theme got wrong. */
export function repairTheme(theme: Theme, base: Theme): void {
  for (const key of THEME_COLOURS) if (!isHex(theme[key])) theme[key] = base[key];
  for (const key of THEME_NUMBERS) if (!isFiniteNumber(theme[key])) theme[key] = base[key];
  for (const key of BACKDROP_NUMBERS) {
    if (!isFiniteNumber(theme.backdrop[key])) theme.backdrop[key] = base.backdrop[key];
  }
  if (!isOneOf(SKIN_IDS, theme.skin)) theme.skin = base.skin;
  if (!isOneOf(DISPLAY_FONT_IDS, theme.displayFont)) theme.displayFont = base.displayFont;
  repairBackdrop(theme.backdrop, base.backdrop);
  if (!isHex(theme.play)) theme.play = "";
  theme.palette = safePalette(theme.palette);
}

/** Each style's layout revision: numbers under known style ids only; nothing left is `undefined`. */
export function safeLayouts(raw: unknown): Partial<Record<Skin, number>> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const kept = Object.entries(raw).filter(([skin, revision]) => isOneOf(SKIN_IDS, skin) && isFiniteNumber(revision));
  return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}

function isRect(value: unknown): value is Rect {
  if (!value || typeof value !== "object") return false;
  const rect = value as Record<string, unknown>;
  return ["x", "y", "w", "h"].every((key) => isFiniteNumber(rect[key]));
}

/** A piece the stage can draw: a string kind and id and a numeric rect (others are dropped). */
export function isDrawablePiece(value: unknown): value is Piece {
  if (!value || typeof value !== "object") return false;
  const piece = value as Record<string, unknown>;
  return typeof piece["kind"] === "string" && typeof piece["id"] === "string" && isRect(piece["rect"]);
}
