// Copying the party code. A code lets anyone who sees it join the party, so it never goes in a
// toast while streamer mode is on (toasts are not blurred); every copy button uses this.
import { isStreaming } from "./settings";
import { pushToast } from "./toasts";

const COPIED_NOTE = "Send it to the friends you want in.";

/** Copy `code`; say so without printing it on a stream. `copiedTitle` lets a style word it. */
export async function copyPartyCode(code: string, copiedTitle = "Party code copied"): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    pushToast("positive", copiedTitle, COPIED_NOTE);
  } catch (error) {
    // No clipboard (a denied permission): show the code to copy by hand, unless on a stream.
    console.warn("party_code_copy_failed", error);
    pushToast("info", "Party code not copied", isStreaming() ? "Turn off streamer mode to see it." : code);
  }
}
