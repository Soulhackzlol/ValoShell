// The look the gallery's live preview shows: picked by clicking a card, applied with the
// preview's Apply button (or a double-click on the card). Shared by every card section.
import { createSignal } from "solid-js";
import type { StudioDoc } from "../types";

export interface PickedLook {
  name: string;
  /** The card's line under the name, repeated under the preview. */
  caption: string;
  doc: StudioDoc;
}

const [pickedLook, setPickedLook] = createSignal<PickedLook | null>(null);

export { pickedLook };

export function pickLook(look: PickedLook): void {
  setPickedLook(look);
}

/** Whether `doc` is the one on show (cards light up). Identity, so equal copies stay apart. */
export function isPicked(doc: StudioDoc): boolean {
  return pickedLook()?.doc === doc;
}
