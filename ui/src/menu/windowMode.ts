// Styles drawn as a desktop client (League) run in a client-sized window; every other style
// covers the screen. The backend sizes and places the window (on VALORANT's monitor, never
// draggable); this only tells it which, whenever the style changes.
import { createEffect, on } from "solid-js";
import { call } from "~/ipc/commands";
import { isTauri } from "~/ipc/runtime";
import { WINDOWED_SKINS } from "~/studio/skins";
import { doc } from "~/studio/store";

/** Keep the window's mode in step with the menu style (call once from the shell). */
export function useWindowMode(): void {
  if (!isTauri) return;
  createEffect(
    on(
      () => WINDOWED_SKINS.includes(doc.theme.skin),
      (isWindowed) =>
        void call("set_window_mode", { isWindowed }).catch((error: unknown) => console.warn("window_mode_failed", error)),
    ),
  );
}
