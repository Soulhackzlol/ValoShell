// A core piece's layout: which arrangement of its content it draws (a rank card as a card, a
// strip or a badge...). The piece definition lists its layouts, first = how it always looked;
// the stage frame puts the choice on `data-layout`, and the piece's own CSS draws each one.
import type { SizeTier } from "./pieceContext";
import type { PieceDef } from "./registry";
import type { Piece, PropValue } from "./types";

/** The prop holding the choice. Weapon wall, service record, store front and the free widgets
 * use the same key for their own Content setting (no `layouts` on their definition), so only
 * pieces with `layouts` are touched by the Look's layout and its reset. The stage frame sets
 * `data-layout` on the piece body and layout CSS uses descendant selectors, so a piece that
 * embeds others (the service record embeds the rank card and history) must not get `layouts`
 * of its own, or its choice would reach the embedded pieces too. */
export const LAYOUT_PROP = "layout";

export interface LayoutOption {
  value: string;
  label: string;
}

/**
 * The layout to draw: the piece's saved choice when its definition still offers it; with none
 * (Auto), the one its definition gives the piece's size, else the definition's first. Null for
 * pieces without layouts (no attribute is set for them).
 */
export function layoutOf(
  def: Pick<PieceDef, "layouts" | "autoLayouts">,
  piece: Pick<Piece, "props">,
  size?: SizeTier,
): string | null {
  const options = def.layouts ?? [];
  const first = options[0];
  if (!first) return null;
  const isOffered = (value: unknown) => options.some((option) => option.value === value);
  const saved = piece.props[LAYOUT_PROP];
  if (isOffered(saved)) return saved as string;
  const fitting = size ? def.autoLayouts?.[size] : undefined;
  return isOffered(fitting) ? (fitting as string) : first.value;
}

type MinPx = PieceDef["minPx"];

/**
 * Smallest size the piece may be resized to: what its picked layout needs, else its kind's.
 * Under Auto it may shrink as far as its smallest size layout goes, since shrinking is what
 * switches it to that layout.
 */
export function minPxOf(
  def: Pick<PieceDef, "layouts" | "autoLayouts" | "layoutMinPx" | "minPx">,
  piece: Pick<Piece, "props">,
): MinPx {
  const of = (layout: string | null | undefined): MinPx => (layout && def.layoutMinPx?.[layout]) || def.minPx;
  if (!isAutoLayout(def, piece)) return of(layoutOf(def, piece));
  const all = [def.minPx, ...Object.values(def.autoLayouts ?? {}).map(of)];
  return { w: Math.min(...all.map((min) => min.w)), h: Math.min(...all.map((min) => min.h)) };
}

/** Whether the piece follows its size (no layout picked) and its kind offers that. */
export function isAutoLayout(def: Pick<PieceDef, "autoLayouts">, piece: Pick<Piece, "props">): boolean {
  return def.autoLayouts !== undefined && piece.props[LAYOUT_PROP] === undefined;
}

/**
 * The props a piece keeps when it changes look. A look is a style, not an arrangement: the
 * layout carries over when the new look offers it (else it goes back to Auto), and so does any
 * setting the new look has too, such as "Show ranks", while it holds the same kind of value.
 */
export function carriedProps(
  def: Pick<PieceDef, "layouts" | "defaults">,
  props: Record<string, PropValue>,
): Record<string, PropValue> {
  const isKept = ([key, value]: [string, PropValue]) => {
    if (key === LAYOUT_PROP && def.layouts) return def.layouts.some((option) => option.value === value);
    return key in def.defaults && typeof def.defaults[key] === typeof value;
  };
  return { ...def.defaults, ...Object.fromEntries(Object.entries(props).filter(isKept)) };
}
