// Quitting ValoShell from any style's Quit button: the last Studio edit is saved first, since
// edits are saved a moment after they happen and the app would exit before that.
import { call, errorText } from "~/ipc/commands";
import { pushToast } from "~/state/toasts";
import { flushSave } from "~/studio/store";

export async function quitApp(): Promise<void> {
  await flushSave();
  try {
    await call("quit_app", {});
  } catch (failure) {
    pushToast("negative", "Could not quit", errorText(failure));
  }
}
