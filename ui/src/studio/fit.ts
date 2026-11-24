// Growing a piece to what its layout needs. Each placed piece registers how to fit itself (only
// the stage knows its pixel size); the inspector calls it right after the player picks a layout
// or a look, so it is part of that choice and never runs on its own while rendering.

const FITTERS = new Map<string, () => void>();

/** Called by the stage for each placed piece; returns the unregister function. */
export function registerFitter(id: string, fit: () => void): () => void {
  FITTERS.set(id, fit);
  return () => {
    if (FITTERS.get(id) === fit) FITTERS.delete(id);
  };
}

/** Grow the piece, if it is smaller than its current layout needs. */
export function fitPieceToLayout(id: string): void {
  FITTERS.get(id)?.();
}
