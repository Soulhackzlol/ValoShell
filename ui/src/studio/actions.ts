// Editor actions shared by the inspector, the keyboard and paste/drop: create, duplicate,
// nudge and delete pieces on the current stage.
import { createSignal } from "solid-js";
import { unwrap } from "solid-js/store";
import { playCue } from "~/menu/sound";
import { newPieceId } from "./defaults";
import { baseStyleOf } from "./pieceLook";
import { kindForUrl } from "./embeds";
import { fitPieceToLayout } from "./fit";
import { LAYOUT_PROP, carriedProps } from "./pieceLayout";
import { type PieceDef, drawnDef, pieceDef } from "./registry";
import { addPiece, removePiece, selectedId, stagePieces, updatePiece } from "./store";
import type { Piece, PropValue, StageId } from "./types";

/** The stage the editor is working on (follows the route). */
const [currentStage, setCurrentStage] = createSignal<StageId>("home");
export { currentStage, setCurrentStage };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Add a piece of `kind`, centred on `at` (stage fractions; default the centre). */
export function addPieceOfKind(
  stage: StageId,
  kind: string,
  at: { x: number; y: number } = { x: 0.5, y: 0.5 },
  props: Record<string, PropValue> = {},
): void {
  const def = pieceDef(kind);
  if (!def) return;
  const { w, h } = def.size;
  const piece: Piece = {
    id: newPieceId(kind),
    kind,
    rect: { x: clamp(at.x - w / 2, 0, 1 - w), y: clamp(at.y - h / 2, 0, 1 - h), w, h },
    z: 0,
    isHidden: false,
    isLocked: false,
    style: baseStyleOf(def.style),
    props: { ...def.defaults, ...props },
    showWhen: "always",
  };
  playCue("confirm");
  addPiece(stage, piece);
}

/**
 * Swap a piece for another look of the same job (registry/jobs.ts): it keeps its place, size,
 * layer, look, show rule and layout (`carriedProps`).
 */
export function changePieceKind(stage: StageId, id: string, kind: string): void {
  const def = pieceDef(kind);
  if (!def) return;
  playCue("confirm");
  updatePiece(stage, id, (piece) => {
    piece.props = swappedProps(def, piece.props);
    piece.kind = kind;
  }, `layout.${id}`);
  fitPieceToLayout(id);
}

/** The props a piece keeps when it switches to `def`. On a shared layout the job's standard piece
 *  draws it, so that piece's settings (a party's "Show ranks") are kept as well. */
function swappedProps(def: PieceDef, props: Record<string, PropValue>): Record<string, PropValue> {
  const carried = carriedProps(def, props);
  const layout = carried[LAYOUT_PROP];
  const drawn = drawnDef(def, typeof layout === "string" ? layout : null);
  return drawn === def ? carried : { ...carriedProps(drawn, props), ...carried };
}

export function duplicatePiece(stage: StageId, id: string): void {
  const original = stagePieces(stage).find((piece) => piece.id === id);
  if (!original) return;
  const copy: Piece = structuredClone(unwrap(original));
  copy.id = newPieceId(original.kind);
  copy.rect = { ...copy.rect, x: clamp(copy.rect.x + 0.02, 0, 1 - copy.rect.w), y: clamp(copy.rect.y + 0.03, 0, 1 - copy.rect.h) };
  copy.isLocked = false;
  playCue("confirm");
  addPiece(stage, copy);
}

export function deleteSelected(stage: StageId): void {
  const id = selectedId();
  if (!id) return;
  playCue("back");
  removePiece(stage, id);
}

/** Move the selected piece by whole pixels (arrow keys). */
export function nudgeSelected(stage: StageId, dxPx: number, dyPx: number, stageSize: { w: number; h: number }): void {
  const id = selectedId();
  if (!id) return;
  updatePiece(
    stage,
    id,
    (piece) => {
      if (piece.isLocked) return;
      piece.rect.x = clamp(piece.rect.x + dxPx / stageSize.w, 0, 1 - piece.rect.w);
      piece.rect.y = clamp(piece.rect.y + dyPx / stageSize.h, 0, 1 - piece.rect.h);
    },
    "nudge",
  );
}

/** A pasted or dropped link becomes the right widget (TikTok -> web, .gif -> image...). */
export function addFromUrl(stage: StageId, url: string, at?: { x: number; y: number }): boolean {
  const kind = kindForUrl(url);
  if (!kind) return false;
  addPieceOfKind(stage, kind, at, { url: url.trim() });
  return true;
}

/** Largest image file accepted inline in the layout (it is saved inside the JSON). */
export const MAX_INLINE_IMAGE_BYTES = 1_500_000;

/** A pasted or dropped image file becomes an image widget holding a data url. */
export function addFromImageFile(stage: StageId, file: File, at?: { x: number; y: number }): Promise<boolean> {
  if (!file.type.startsWith("image/") || file.size > MAX_INLINE_IMAGE_BYTES) return Promise.resolve(false);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        addPieceOfKind(stage, "image", at, { url: reader.result });
        resolve(true);
      } else {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsDataURL(file);
  });
}
