// Interface size: the main window's zoom, like Ctrl + / - in a browser. Text, controls and art
// grow while every piece keeps its place on screen. The backend sets the saved size before the
// window first shows (no jump at start); this applies later changes. The in-game overlay keeps
// its size: it sits over the game, and its pieces are placed for the game's own HUD. In the
// browser preview the browser's zoom does the same, so nothing is applied there.
import { isTauri } from "~/ipc/runtime";

/** The Interface size range; mirrors MIN_UI_SCALE / MAX_UI_SCALE in crates/store/src/settings.rs. */
export const UI_SCALE = { min: 0.8, max: 1.25, step: 0.05 } as const;

const MAIN_WINDOW = "main";
const AS_DESIGNED = 1;

/** What the window is zoomed to; set only once a zoom succeeded, so a failure is retried. */
let appliedScale: number = AS_DESIGNED;

/** The zoom the window shows now (1 in the browser preview, where the browser zooms itself). */
export function appliedUiScale(): number {
  return appliedScale;
}

/** Zoom the main window to `scale` (1 = as designed); repeated values cost nothing. */
export function applyUiScale(scale: number): void {
  if (!isTauri || scale === appliedScale) return;
  void import("@tauri-apps/api/webview")
    .then(async ({ getCurrentWebview }) => {
      const webview = getCurrentWebview();
      if (webview.label !== MAIN_WINDOW) return;
      await webview.setZoom(scale);
      appliedScale = scale;
    })
    .catch((error: unknown) => console.warn("ui_scale_failed", error));
}
