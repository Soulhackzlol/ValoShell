// Where a piece sits and how big it is drawn, so pieces can change form with their box: a
// widget dropped in a corner at 160 px is not the same widget as one filling half the screen.
// Kept free of DOM code so it can be tested on its own; the frame (Stage.tsx) sets the result
// on the piece as data-size, data-shape and data-anchor, and hands it to components through
// usePieceContext().
import type { Rect } from "./types";

export type SizeTier = "tiny" | "small" | "medium" | "large";
export type Shape = "wide" | "tall" | "square";
export type Anchor =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

/** Below these a piece has room for one fact: an icon, a number, a word. */
const TINY_WIDTH_PX = 200;
const TINY_HEIGHT_PX = 110;
/** Below these it fits a compact card: a title and a line or two. */
const SMALL_WIDTH_PX = 360;
const SMALL_HEIGHT_PX = 220;
/** At or above both of these it can show everything, art included. */
const LARGE_WIDTH_PX = 720;
const LARGE_HEIGHT_PX = 420;
/** Width over height past which a box reads as a strip, and under which as a column. */
const WIDE_RATIO = 1.8;
const TALL_RATIO = 0.7;
/** The middle third of the screen on each axis counts as its centre. */
const EDGE_THIRD = 1 / 3;

export interface PieceContext {
  size: SizeTier;
  shape: Shape;
  anchor: Anchor;
}

/** How much room a piece of `width` x `height` px has to draw in. */
export function sizeTierOf(width: number, height: number): SizeTier {
  if (width < TINY_WIDTH_PX || height < TINY_HEIGHT_PX) return "tiny";
  if (width < SMALL_WIDTH_PX || height < SMALL_HEIGHT_PX) return "small";
  if (width >= LARGE_WIDTH_PX && height >= LARGE_HEIGHT_PX) return "large";
  return "medium";
}

/** Whether a box reads as a strip, a column or a block. */
export function shapeOf(width: number, height: number): Shape {
  const ratio = width / Math.max(1, height);
  if (ratio >= WIDE_RATIO) return "wide";
  if (ratio <= TALL_RATIO) return "tall";
  return "square";
}

function third(center: number): "start" | "middle" | "end" {
  if (center < EDGE_THIRD) return "start";
  if (center > 1 - EDGE_THIRD) return "end";
  return "middle";
}

/** The screen region a piece's centre falls in, from its rect in stage fractions. */
export function anchorOf(rect: Rect): Anchor {
  const column = third(rect.x + rect.w / 2);
  const row = third(rect.y + rect.h / 2);
  const vertical = row === "start" ? "top" : row === "end" ? "bottom" : "";
  const horizontal = column === "start" ? "left" : column === "end" ? "right" : "";
  if (vertical && horizontal) return `${vertical}-${horizontal}` as Anchor;
  return (vertical || horizontal || "center") as Anchor;
}

/** Everything a piece knows about its place: size from its drawn px, anchor from its rect. */
export function pieceContextOf(rect: Rect, widthPx: number, heightPx: number): PieceContext {
  return { size: sizeTierOf(widthPx, heightPx), shape: shapeOf(widthPx, heightPx), anchor: anchorOf(rect) };
}
