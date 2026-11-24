// The Studio document: every visual element of the menu is a "piece" placed on a stage
// (one stage per scene, plus the in-game overlay), and one theme styles them all.
// Saved as JSON (`layouts/studio.json`); unknown fields from newer versions are kept.
import type { ShowWhen } from "~/state/momentRules";
import type { EnterMotion, HoverMotion, IdleMotion } from "./motion";

export type StageId =
  | "home"
  | "play"
  | "agents"
  | "collection"
  | "career"
  | "store"
  | "agent-select"
  | "live"
  | "post-match"
  | "ingame";

/** Position and size as fractions of the stage, so layouts survive resolution changes. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Surface = "none" | "glass" | "solid";

/** Spacing inside a piece: the style's own, tighter, or roomier. */
export type Density = "compact" | "comfortable" | "spacious";

export interface PieceStyle {
  opacity: number;
  /** Corner radius in px. */
  radius: number;
  surface: Surface;
  /** Accent glow around the piece. */
  isGlowing: boolean;
  /** Content size (1 = as the style draws it); the piece keeps its box. */
  scale: number;
  density: Density;
  /** `#rrggbb` replacing the style's accent in this piece; empty keeps the style's. */
  accent: string;
  /** How the piece enters, idles and answers the pointer (motion.ts); "auto" is the style's. */
  enter: EnterMotion;
  idle: IdleMotion;
  hover: HoverMotion;
  /** Extra wait before it enters, in ms, for staged entrances. */
  delay: number;
}

export type PropValue = string | number | boolean;

export interface Piece {
  id: string;
  kind: string;
  rect: Rect;
  z: number;
  isHidden: boolean;
  isLocked: boolean;
  style: PieceStyle;
  props: Record<string, PropValue>;
  /** When it is on screen (momentRules.ts): always, or only at some game moments. */
  showWhen: ShowWhen;
}

export const BACKDROP_KIND_IDS = ["game", "aurora", "map", "agent", "shader", "image", "video", "color"] as const;
export type BackdropKind = (typeof BACKDROP_KIND_IDS)[number];

/** Which map or agent a map/agent backdrop shows: the one picked, the one from your last match,
 *  or a different one each launch. */
export const BACKDROP_PICK_IDS = ["fixed", "recent", "shuffle"] as const;
export type BackdropPick = (typeof BACKDROP_PICK_IDS)[number];

/** How the agent figure is drawn: as is, as a dark cut-out rimmed in the accent, filled with
 *  the agent's own colours, or with a glow in them. */
export const FIGURE_LOOK_IDS = ["plain", "silhouette", "colours", "glow"] as const;
export type FigureLook = (typeof FIGURE_LOOK_IDS)[number];

export type ShaderId = "flow" | "grid" | "rift" | "static" | "haze" | "burst" | "diamonds" | "crt";

export interface Backdrop {
  kind: BackdropKind;
  /** Image or video url for `image`/`video`. */
  url: string;
  /** Agent uuid for `agent`. */
  agentUuid: string;
  /** Map internal id for `map` (its loading-screen splash). */
  mapId: string;
  /** For `map` and `agent`: the picked one, your last match's, or a new one each launch. The
   *  picked one stands in until you have played a match. */
  pick: BackdropPick;
  /** Show the map's or agent's name huge behind everything. */
  isNameOn: boolean;
  /** Path of one of the game's own videos for `game`; empty = its newest home-screen loop. */
  gameVideo: string;
  shader: ShaderId;
  /** Redraw the backdrop (whatever its source) as ASCII characters. */
  isAscii: boolean;
  /** Character cell height in px for ASCII (smaller = finer). */
  asciiSize: number;
  /** 0-24 px. */
  blur: number;
  /** 0-1 darkening. */
  dim: number;
  /** Framing: shift in % of the screen (-50..50), scale (1 = fit) and tilt in degrees. */
  offsetX: number;
  offsetY: number;
  zoom: number;
  rotate: number;
  /** Slow camera move on the backdrop. */
  motion: BackdropMotion;
  /** Multiplier on the motion's pace (0.25 slow .. 3 fast). */
  motionSpeed: number;
  /** Colour grade: hue turn in degrees and saturation (1 = as is). */
  hue: number;
  saturation: number;
  /** The agent figure for `agent`: shift in % of the screen and size (1 = default). */
  figureX: number;
  figureY: number;
  figureScale: number;
  figureLook: FigureLook;
  /** Face the agent the other way. */
  isFigureMirrored: boolean;
}

export type BackdropMotion = "none" | "drift" | "zoom" | "pan" | "sway" | "pulse" | "orbit";

/** Which style's sounds the menu plays; "auto" follows the menu style. */
export type SoundPack = "auto" | "off" | Skin;

/** How a screen comes in when the tab changes; "auto" picks the style's own. */
export type SceneTransitionKind = "auto" | "none" | "fade" | "slide" | "zoom" | "blur" | "build" | "shutter" | "pixel" | "wipe" | "glass";

export interface SceneTransition {
  kind: SceneTransitionKind;
  /** Multiplier on the duration (0.5 fast .. 2 slow). */
  speed: number;
}

/** Showpiece extras: the style's intro on launch, its cursor and its click effect. */
export interface FxSettings {
  isIntroOn: boolean;
  isCursorOn: boolean;
  isClickFxOn: boolean;
}

export interface SoundSettings {
  pack: SoundPack;
  /** 0-1 on top of the app's interface volume. */
  volume: number;
  isHoverOn: boolean;
  /** Use real sound files (installed games, the sounds folder) where they exist. */
  useFiles: boolean;
}

/** Every display font id; also checks fonts named by a shared look (normalizeDoc). */
export const DISPLAY_FONT_IDS = ["saira", "tall", "inter", "mono", "classic", "pixel", "robco", "beaufort", "poster", "tech"] as const;
export type DisplayFont = (typeof DISPLAY_FONT_IDS)[number];

/** Menu style: restyles nav, panels, type and PLAY to echo another game's menu. */
export const SKIN_IDS = [
  "modern",
  "glass",
  "current",
  "beta",
  "csgo",
  "cs2",
  "cs16",
  "valnow",
  "terminal",
  "fortnite",
  "minecraft",
  "halo",
  "pipboy",
  "league",
  "phantom",
  "nightcity",
] as const;
export type Skin = (typeof SKIN_IDS)[number];

/** Language of the words a style prints itself (the VALORANT style copies the client's). */
export type MenuLanguage = "auto" | "en" | "es";

export interface Theme {
  skin: Skin;
  preset: string;
  accent: string;
  /** Second accent for gradients and highlights. */
  accent2: string;
  ground: string;
  text: string;
  backdrop: Backdrop;
  isGrainy: boolean;
  /** 0-1 edge darkening. */
  vignette: number;
  /** Pointer parallax travel in px (0 = off). */
  parallax: number;
  /** Size of the cut corners on cards and buttons, px. */
  cut: number;
  displayFont: DisplayFont;
  sound: SoundSettings;
  transition: SceneTransition;
  fx: FxSettings;
  language: MenuLanguage;
  /** The player's colours for styles' named roles (theme/palettes.ts), token -> `#rrggbb`. */
  palette: Record<string, string>;
  /** The PLAY button colour, `#rrggbb`; empty keeps each style's own. */
  play: string;
}

export interface StudioDoc {
  version: 1;
  theme: Theme;
  stages: Partial<Record<StageId, Piece[]>>;
  /** Revision of each style's built-in layouts last applied, so a reworked layout lands once. */
  layouts?: Partial<Record<Skin, number>>;
}
