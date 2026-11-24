// How a piece moves: how it enters, what it does while idle, how it answers the pointer. An
// "auto" entrance takes the style's own motion language (Glass blurs in, Night City boots in with
// a glitch, Fortnite pops), and a slide comes in from the screen edge the piece sits against, so
// the same widget moves differently by theme and by place. Hover is opt-in and never leans or
// follows the pointer: the pointer always rests on some piece, and a whole panel shifting under
// it reads as unsteady, not alive. The frame (Stage.tsx) sets the
// result as data attributes; stage.module.css draws them.
import type { Anchor } from "./pieceContext";
import type { Skin } from "./types";

export const ENTER_IDS = ["auto", "none", "fade", "rise", "slide", "pop", "blur", "glitch", "type", "flicker"] as const;
export type EnterMotion = (typeof ENTER_IDS)[number];
export const IDLE_IDS = ["none", "float", "breathe", "shimmer"] as const;
export type IdleMotion = (typeof IDLE_IDS)[number];
export const HOVER_IDS = ["none", "lift", "glow"] as const;
export type HoverMotion = (typeof HOVER_IDS)[number];

export type SlideFrom = "left" | "right" | "top" | "bottom";

/** Longest extra wait before a piece enters, so a staged entrance stays snappy. */
export const MAX_DELAY_MS = 1200;

export const ENTER_OPTIONS: readonly { value: EnterMotion; label: string }[] = [
  { value: "auto", label: "Style's own" },
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "rise", label: "Rise" },
  { value: "slide", label: "Slide from its edge" },
  { value: "pop", label: "Pop" },
  { value: "blur", label: "Blur in" },
  { value: "glitch", label: "Glitch" },
  { value: "type", label: "Type out" },
  { value: "flicker", label: "CRT flicker" },
];

export const IDLE_OPTIONS: readonly { value: IdleMotion; label: string }[] = [
  { value: "none", label: "Still" },
  { value: "float", label: "Float" },
  { value: "breathe", label: "Breathe" },
  { value: "shimmer", label: "Shimmer" },
];

export const HOVER_OPTIONS: readonly { value: HoverMotion; label: string }[] = [
  { value: "none", label: "None" },
  { value: "lift", label: "Lift" },
  { value: "glow", label: "Glow" },
];

type StyleEnter = Exclude<EnterMotion, "auto">;

/** Each style's entrance, after the game it copies. Menus of older games (CS 1.6's
 *  VGUI, Minecraft's title screen) never animated, so they stay still. */
const STYLE_ENTER: Record<Skin, StyleEnter> = {
  modern: "rise",
  glass: "blur",
  current: "fade",
  beta: "fade",
  csgo: "slide",
  cs2: "rise",
  cs16: "none",
  valnow: "rise",
  terminal: "type",
  fortnite: "pop",
  minecraft: "none",
  halo: "blur",
  pipboy: "flicker",
  league: "fade",
  phantom: "slide",
  nightcity: "glitch",
};

export interface ResolvedMotion {
  enter: StyleEnter;
  hover: HoverMotion;
  /** Only for a slide: the edge it comes in from. */
  from: SlideFrom | undefined;
}

/** A centred piece has no edge to come from, so it rises instead. */
function slideFrom(anchor: Anchor): SlideFrom | undefined {
  if (anchor.endsWith("left")) return "left";
  if (anchor.endsWith("right")) return "right";
  if (anchor === "top") return "top";
  if (anchor === "bottom") return "bottom";
  return undefined;
}

/** The motion a piece actually plays: its own picks, an "auto" entrance filled from the style. */
export function resolveMotion(picked: { enter: EnterMotion; hover: HoverMotion }, skin: Skin, anchor: Anchor): ResolvedMotion {
  const enter = picked.enter === "auto" ? STYLE_ENTER[skin] : picked.enter;
  const hover = picked.hover;
  if (enter !== "slide") return { enter, hover, from: undefined };
  const from = slideFrom(anchor);
  return from ? { enter, hover, from } : { enter: "rise", hover, from: undefined };
}

export function clampDelay(ms: number): number {
  return Math.min(MAX_DELAY_MS, Math.max(0, Math.round(ms)));
}
