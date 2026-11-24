// Loadout presets: named snapshots of the whole loadout, saved in ValoShell's `loadouts`
// folder and equipped in one go. Riot's answer replaces the collection; the identity re-reads.
import { createSignal } from "solid-js";
import { call, errorText } from "~/ipc/commands";
import { playCue } from "~/menu/sound";
import { pushToast } from "./toasts";
import { collectionView, identityView } from "./views";

const [presetNames, setPresetNames] = createSignal<string[]>([]);
const [isBusy, setBusy] = createSignal(false);

export { isBusy as isPresetBusy, presetNames };

/** Read the saved names again (sorted, as the folder lists them). */
export async function refreshPresets(): Promise<void> {
  try {
    setPresetNames(await call("list_ui_documents", { kind: "loadouts" }));
  } catch (failure) {
    pushToast("negative", "Loadouts not read", errorText(failure));
  }
}

/** Run one preset action with the busy flag and a toast on failure; `true` when it worked. */
async function run(action: () => Promise<unknown>, failure: string): Promise<boolean> {
  if (isBusy()) return false;
  setBusy(true);
  try {
    await action();
    return true;
  } catch (error) {
    pushToast("negative", failure, errorText(error));
    return false;
  } finally {
    setBusy(false);
  }
}

/** Save the loadout as it is now; an existing name is overwritten. */
export async function savePreset(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const isSaved = await run(() => call("save_loadout_preset", { name: trimmed }), "Loadout not saved");
  if (!isSaved) return false;
  playCue("confirm");
  pushToast("positive", "Loadout saved", trimmed);
  await refreshPresets();
  return true;
}

export async function applyPreset(name: string): Promise<boolean> {
  return run(async () => {
    const applied = await call("apply_loadout_preset", { name });
    collectionView.set(applied.collection);
    if (identityView.value()) void identityView.load(true);
    playCue("confirm");
    const skipped = applied.skipped > 0 ? `${applied.skipped} item${applied.skipped === 1 ? "" : "s"} you no longer own stayed as they were.` : name;
    pushToast("positive", "Loadout equipped", skipped);
  }, "Loadout not equipped");
}

export async function deletePreset(name: string): Promise<boolean> {
  const isDeleted = await run(() => call("delete_ui_document", { kind: "loadouts", name }), "Loadout not deleted");
  if (isDeleted) await refreshPresets();
  return isDeleted;
}
