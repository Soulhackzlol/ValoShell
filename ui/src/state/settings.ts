// App settings (match flow, lobby, interface, accessibility, streamer). Edits apply instantly
// and are saved by the backend; a failed save reverts to what is on disk. Every window applies
// the backend's "settings" event, so the in-game overlay follows changes made in the menu.
import { createSignal } from "solid-js";
import type { Settings } from "~/bindings/Settings";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { setUiVolume } from "~/menu/sound";
import { applyUiScale } from "./uiScale";
import { pushToast } from "./toasts";

const [settings, setSettingsSignal] = createSignal<Settings | null>(null);

function apply(next: Settings): void {
  setSettingsSignal(next);
  setUiVolume(next.interface.ui_volume);
  const root = document.documentElement;
  root.toggleAttribute("data-streamer", next.streamer.is_enabled);
  root.dataset["motion"] = next.interface.motion;
  // theme/access.css reads these two; every style inherits them.
  root.dataset["contrast"] = next.interface.is_high_contrast ? "high" : "normal";
  root.dataset["vision"] = next.interface.color_vision;
  applyUiScale(next.interface.ui_scale);
}

// A failed read leaves the defaults the backend applies on its next event; say so in the log.
void call("get_settings", {}).then(apply, (failure: unknown) => console.warn("settings_initial_read_failed", failure));

export { settings };

/** Whether streamer mode is on. */
export function isStreaming(): boolean {
  return settings()?.streamer.is_enabled ?? false;
}

/** A tooltip that names a player, or none in streamer mode: the blur (data-sensitive) covers
 *  text on screen, but a browser tooltip is drawn outside the page where nothing can blur it. */
export function sensitiveTitle(text: string): string | undefined {
  return isStreaming() ? undefined : text;
}

let saving: Promise<unknown> = Promise.resolve();
/** The newest edit made in this window; older saves' answers must not undo it. */
let latestEdit = 0;
let pendingSaves = 0;

// Another window saved (or this one, already applied): take it unless an edit here is still
// on its way, which would be newer.
onAppEvent("settings", (saved) => {
  if (pendingSaves === 0) apply(saved);
});

/** Change settings with a mutator; saves in order so fast toggles never race. */
export function updateSettings(change: (draft: Settings) => void): void {
  const current = settings();
  if (!current) return;
  const draft: Settings = structuredClone(current);
  change(draft);
  apply(draft);
  const edit = ++latestEdit;
  pendingSaves += 1;
  saving = saving.then(async () => {
    try {
      const saved = await call("save_settings", { settings: draft });
      if (edit === latestEdit) apply(saved);
    } catch (error) {
      pushToast("negative", "Settings not saved", typeof error === "string" ? error : "");
      apply(await call("get_settings", {}));
    } finally {
      pendingSaves -= 1;
    }
  });
}
