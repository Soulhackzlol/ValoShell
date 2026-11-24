// Default theme, theme presets and the default layout of every stage. A stage missing from a
// saved document falls back to these, so new scenes appear without resetting anything.
import { isShowWhen } from "~/state/momentRules";
import { isDrawablePiece, isFiniteNumber, isHex, isOneOf, repairTheme, safeLayouts } from "./docSafety";
import { ENTER_IDS, HOVER_IDS, IDLE_IDS, clampDelay } from "./motion";
import type { Piece, PieceStyle, PropValue, Rect, StageId, StudioDoc, Theme } from "./types";

export const DEFAULT_STYLE: PieceStyle = {
  opacity: 1,
  radius: 0,
  surface: "none",
  isGlowing: false,
  scale: 1,
  density: "comfortable",
  accent: "",
  enter: "auto",
  idle: "none",
  hover: "none",
  delay: 0,
};

export interface ThemePreset {
  id: string;
  label: string;
  accent: string;
  accent2: string;
  ground: string;
  text: string;
}

export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: "valorant", label: "Valorant", accent: "#ff4655", accent2: "#ffb4a8", ground: "#0a0a0e", text: "#ededf0" },
  { id: "phantom", label: "Phantom", accent: "#9b6bff", accent2: "#5ee1ff", ground: "#0b0913", text: "#eeeaf8" },
  { id: "neon", label: "Neon", accent: "#19e3c6", accent2: "#e6ff4f", ground: "#061012", text: "#e8fbf8" },
  { id: "gold", label: "Radiant", accent: "#e8b04b", accent2: "#fff1c4", ground: "#0e0b07", text: "#f6efe2" },
  { id: "sakura", label: "Sakura", accent: "#ff7eb6", accent2: "#ffd1e8", ground: "#120a10", text: "#fbeef5" },
  { id: "ice", label: "Glacier", accent: "#6ec8ff", accent2: "#e2f4ff", ground: "#070c12", text: "#eaf4fb" },
  { id: "mono", label: "Mono", accent: "#f2f2f2", accent2: "#8a8a8a", ground: "#0b0b0b", text: "#f2f2f2" },
];

export const DEFAULT_THEME: Theme = {
  skin: "modern",
  preset: "valorant",
  accent: "#ff4655",
  accent2: "#ffb4a8",
  ground: "#0a0a0e",
  text: "#ededf0",
  backdrop: {
    kind: "game",
    url: "",
    agentUuid: "",
    mapId: "Ascent",
    pick: "fixed",
    isNameOn: false,
    gameVideo: "",
    shader: "flow",
    isAscii: false,
    asciiSize: 12,
    blur: 0,
    dim: 0.35,
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    rotate: 0,
    motion: "none",
    motionSpeed: 1,
    hue: 0,
    saturation: 1,
    figureX: 0,
    figureY: 0,
    figureScale: 1,
    figureLook: "plain",
    isFigureMirrored: false,
  },
  isGrainy: true,
  vignette: 0.7,
  // The scene holds still unless asked: a backdrop drifting after the pointer read as unsteady.
  parallax: 0,
  cut: 18,
  displayFont: "saira",
  sound: { pack: "auto", volume: 1, isHoverOn: true, useFiles: true },
  transition: { kind: "auto", speed: 1 },
  fx: { isIntroOn: true, isCursorOn: true, isClickFxOn: true },
  language: "auto",
  palette: {},
  play: "",
};

let sequence = 0;

/** Unique piece id (time + counter: unique within a document, stable across saves). */
export function newPieceId(kind: string): string {
  sequence += 1;
  return `${kind}-${Date.now().toString(36)}${sequence.toString(36)}`;
}

/** A piece of a built-in layout (fixed id per kind, so a stage holds one of each). */
export function piece(kind: string, rect: Rect, z: number, props: Record<string, PropValue> = {}): Piece {
  return {
    id: `${kind}-default`,
    kind,
    rect,
    z,
    isHidden: false,
    isLocked: false,
    style: { ...DEFAULT_STYLE },
    props,
    showWhen: "always",
  };
}

const DEFAULT_STAGES: Record<StageId, () => Piece[]> = {
  home: () => [
    piece("party-lineup", { x: 0.1, y: 0.05, w: 0.8, h: 0.7 }, 1),
    piece("play-bar", { x: 0.29, y: 0.8, w: 0.42, h: 0.12 }, 2),
  ],
  play: () => [
    piece("queue-picker", { x: 0.05, y: 0.05, w: 0.6, h: 0.7 }, 1),
    piece("party-tools", { x: 0.68, y: 0.05, w: 0.27, h: 0.7 }, 2),
    piece("play-bar", { x: 0.29, y: 0.8, w: 0.42, h: 0.12 }, 3),
  ],
  agents: () => [piece("val-agents", { x: 0, y: 0, w: 1, h: 1 }, 1)],
  collection: () => [
    piece("weapon-wall", { x: 0.03, y: 0.03, w: 0.6, h: 0.94 }, 1),
    piece("skin-picker", { x: 0.66, y: 0.03, w: 0.31, h: 0.5 }, 2),
    piece("identity", { x: 0.66, y: 0.56, w: 0.31, h: 0.41 }, 3),
  ],
  career: () => [
    piece("rank-card", { x: 0.04, y: 0.04, w: 0.5, h: 0.4 }, 1),
    piece("rr-history", { x: 0.58, y: 0.04, w: 0.38, h: 0.47 }, 2),
    piece("stats", { x: 0.58, y: 0.54, w: 0.38, h: 0.4 }, 4),
    piece("leaderboard", { x: 0.04, y: 0.48, w: 0.5, h: 0.46 }, 3),
  ],
  store: () => [
    piece("store-bundle", { x: 0.03, y: 0.03, w: 0.52, h: 0.6 }, 1),
    piece("store-daily", { x: 0.58, y: 0.03, w: 0.39, h: 0.6 }, 2),
    piece("night-market", { x: 0.03, y: 0.67, w: 0.52, h: 0.3 }, 3),
    piece("store-accessories", { x: 0.58, y: 0.67, w: 0.39, h: 0.3 }, 4),
  ],
  "agent-select": () => [
    piece("pregame-header", { x: 0.3, y: 0.02, w: 0.4, h: 0.15 }, 1),
    piece("ally-roster", { x: 0.02, y: 0.04, w: 0.21, h: 0.84 }, 2),
    piece("agent-picker", { x: 0.26, y: 0.2, w: 0.48, h: 0.76 }, 3),
  ],
  live: () => [
    piece("lobby", { x: 0.03, y: 0.03, w: 0.94, h: 0.8 }, 1),
    piece("match-score", { x: 0.42, y: 0.86, w: 0.16, h: 0.1 }, 2, { isCompact: false }),
  ],
  "post-match": () => [piece("post-match", { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }, 1)],
  ingame: () => [],
};

export function defaultStage(stage: StageId): Piece[] {
  return DEFAULT_STAGES[stage]();
}

export function defaultDoc(): StudioDoc {
  return { version: 1, theme: structuredClone(DEFAULT_THEME), stages: {} };
}

/** A piece's style with defaults for anything missing or not of the right type. */
function safeStyle(raw: unknown): PieceStyle {
  const style: PieceStyle = { ...DEFAULT_STYLE, ...(raw && typeof raw === "object" ? raw : {}) };
  for (const key of ["opacity", "radius", "scale"] as const) {
    if (!isFiniteNumber(style[key])) style[key] = DEFAULT_STYLE[key];
  }
  if (!isHex(style.accent)) style.accent = "";
  if (!isOneOf(ENTER_IDS, style.enter)) style.enter = DEFAULT_STYLE.enter;
  if (!isOneOf(IDLE_IDS, style.idle)) style.idle = DEFAULT_STYLE.idle;
  if (!isOneOf(HOVER_IDS, style.hover)) style.hover = DEFAULT_STYLE.hover;
  style.delay = isFiniteNumber(style.delay) ? clampDelay(style.delay) : DEFAULT_STYLE.delay;
  return style;
}

/** A stage's drawable pieces, each with a full style and its own props object. */
function safePieces(raw: unknown): Piece[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isDrawablePiece).map((entry) => ({
    ...entry,
    z: isFiniteNumber(entry.z) ? entry.z : 0,
    style: safeStyle(entry.style),
    props: entry.props && typeof entry.props === "object" ? { ...entry.props } : {},
    showWhen: isShowWhen(entry.showWhen) ? entry.showWhen : "always",
  }));
}

/**
 * Fill gaps in a loaded document (older versions, hand edits) without dropping its data, and
 * make a document from outside safe to apply (docSafety.ts): a look someone shared is input.
 */
export function normalizeDoc(raw: unknown): StudioDoc {
  const base = defaultDoc();
  if (!raw || typeof raw !== "object") return base;
  const doc = raw as Partial<StudioDoc>;
  const theme = { ...base.theme, ...(doc.theme ?? {}) };
  theme.backdrop = { ...base.theme.backdrop, ...(doc.theme?.backdrop ?? {}) };
  theme.sound = { ...base.theme.sound, ...(doc.theme?.sound ?? {}) };
  theme.transition = { ...base.theme.transition, ...(doc.theme?.transition ?? {}) };
  theme.fx = { ...base.theme.fx, ...(doc.theme?.fx ?? {}) };
  repairTheme(theme, base.theme);
  const stages: StudioDoc["stages"] = {};
  for (const [id, pieces] of Object.entries(doc.stages ?? {})) {
    // Only real stages: a shared file's own keys (even `__proto__`) never become one.
    if (Object.hasOwn(DEFAULT_STAGES, id) && Array.isArray(pieces)) stages[id as StageId] = safePieces(pieces);
  }
  const layouts = safeLayouts(doc.layouts);
  return { version: 1, theme, stages, ...(layouts ? { layouts } : {}) };
}
