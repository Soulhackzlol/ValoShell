// ValoShell updates as the backend publishes them, plus the player's actions: check now,
// install (which restarts the app) and dismissing the notice for one release.
import { createSignal } from "solid-js";
import type { UpdateView } from "~/bindings/UpdateView";
import { call, errorText } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { pushToast } from "./toasts";

const [update, setUpdate] = createSignal<UpdateView | null>(null);
/** The release the player closed the notice for this session. */
const [dismissedVersion, setDismissedVersion] = createSignal<string | null>(null);
/** Between the click and the backend's first progress event, so a second click does nothing. */
const [isInstallPending, setInstallPending] = createSignal(false);

export { dismissedVersion, isInstallPending, update };

onAppEvent("update", setUpdate);
// Before the first event; a failure only means the first event brings the state instead.
void call("get_update", {}).then(setUpdate, (error) => console.warn("get_update_failed", error));

export function dismissUpdateNotice(): void {
  setDismissedVersion(update()?.latest?.version ?? null);
}

/** Check now; the outcome arrives as an event, a failure also as a toast. */
export async function checkForUpdate(): Promise<void> {
  try {
    setUpdate(await call("check_for_update", {}));
  } catch (failure) {
    pushToast("negative", "Update check failed", errorText(failure));
  }
}

/** Download, verify and restart into the new version; the notice shows the progress. */
export async function installUpdate(): Promise<void> {
  if (isInstallPending()) return;
  setInstallPending(true);
  try {
    await call("install_update", {});
  } catch (failure) {
    pushToast("negative", "Update not installed", errorText(failure));
  } finally {
    setInstallPending(false);
  }
}
