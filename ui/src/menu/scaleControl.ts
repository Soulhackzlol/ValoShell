// The Interface size slider, shared by both settings screens. The shown value follows the drag,
// but the app zooms and the setting is saved once, on release: zooming on every step resizes
// the slider under a pointer that has not moved, and each step's save would replay an older size.
import { createSignal } from "solid-js";
import { settings, updateSettings } from "~/state/settings";

const AS_DESIGNED = 1;
const [draft, setDraft] = createSignal<number | null>(null);

/** The size the slider shows: the one being dragged, else the saved one. */
export function shownScale(): number {
  return draft() ?? settings()?.interface.ui_scale ?? AS_DESIGNED;
}

/** A drag step: shown only. */
export function previewScale(scale: number): void {
  setDraft(scale);
}

/** The released value: saved, which zooms the app. */
export function commitScale(scale: number): void {
  setDraft(null);
  updateSettings((current) => void (current.interface.ui_scale = scale));
}
