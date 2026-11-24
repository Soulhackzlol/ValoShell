// The piece contract: what every registered piece kind declares (renderer, where it may go, size,
// defaults and the props the inspector edits) and what its component receives.
import type { Component } from "solid-js";
import type { SizeTier } from "../pieceContext";
import type { LayoutOption } from "../pieceLayout";
import type { Piece, PieceStyle, PropValue, StageId } from "../types";

export interface PieceProps {
  piece: Piece;
  stage: StageId;
  isEditing: boolean;
}

export type FieldType = "text" | "textarea" | "url" | "range" | "color" | "toggle" | "select";

export interface PropField {
  key: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { value: string; label: string }[];
  placeholder?: string;
}

export interface PieceDef {
  kind: string;
  label: string;
  description: string;
  icon: Component<{ size?: number }>;
  /** `core` pieces are the menu's own functions; `widget` pieces are free decoration. */
  category: "core" | "widget";
  /** Stages it may be placed on; `null` = everywhere. */
  stages: readonly StageId[] | null;
  /** Default size as a fraction of the stage. */
  size: { w: number; h: number };
  /** Smallest size in px while resizing. */
  minPx: { w: number; h: number };
  defaults: Record<string, PropValue>;
  style?: Partial<PieceStyle>;
  fields: readonly PropField[];
  /** Its CSS spaces itself with the --space-* tokens, so the Look's Density reaches it. */
  hasDensity?: boolean;
  /** Arrangements of its content (studio/pieceLayout.ts); the first is how it always looked. */
  layouts?: readonly LayoutOption[];
  /** The layout each size suits, used while the player has picked none ("Auto"): a rank card
   *  shrunk into a corner becomes its badge on its own. Sizes left out draw the first layout. */
  autoLayouts?: Partial<Record<SizeTier, string>>;
  /** Smallest size of a layout that needs other room than `minPx` (a one-row strip fits a short
   *  bar the stepped cards don't), so each layout can only be resized as far as it still fits. */
  layoutMinPx?: Partial<Record<string, { w: number; h: number }>>;
  /** Set by the registry on a job's style looks: the standard piece that draws the job's shared
   *  arrangements (`layouts`) in the look's materials (registry/index.ts `withSharedLayouts`). */
  shared?: { def: PieceDef; layouts: readonly string[] };
  component: Component<PieceProps>;
}
