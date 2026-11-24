// The community gallery: looks players shared through the ValoShell repository (see
// community/README.md). The backend reads the list and files from GitHub with size caps; each
// look is then repaired by normalizeDoc like any shared file. Sharing copies the current look
// as a community file and opens GitHub's "new file" page, which becomes a pull request.
import { unwrap } from "solid-js/store";
import type { CommunityLook } from "~/bindings/CommunityLook";
import { call, errorText } from "~/ipc/commands";
import { openExternal } from "~/pieces/widgets";
import { pushToast } from "~/state/toasts";
import { normalizeDoc } from "../defaults";
import { isLookShape } from "../lookFiles";
import { doc } from "../store";
import type { StudioDoc } from "../types";
import { type ShareMeta, communityFile, shareProblems, uniqueFileId } from "./communityShare";

const NEW_FILE_URL = "https://github.com/Soulhackzlol/ValoShell/new/main/community/looks";
/** Look files downloaded at once; the rest wait, so a long list never floods the connection. */
const PARALLEL_LOADS = 6;

export interface SharedLook {
  entry: CommunityLook;
  doc: StudioDoc;
  /** Its screenshot as a `data:` URL; undefined draws the sketch. */
  thumb: string | undefined;
}

export type CommunityState =
  | { status: "loading" }
  | { status: "error"; message: string }
  /** `skipped`: listed looks that could not be read (removed since, or broken). */
  | { status: "ready"; looks: SharedLook[]; skipped: number };

/** A missing picture only costs the card its screenshot, so it never drops the look. */
async function loadThumb(entry: CommunityLook): Promise<string | undefined> {
  if (!entry.has_thumb) return undefined;
  try {
    return await call("community_thumb", { id: entry.id });
  } catch (error) {
    console.warn("community_thumb_failed", entry.id, errorText(error));
    return undefined;
  }
}

async function loadShared(entry: CommunityLook): Promise<SharedLook | null> {
  try {
    const [raw, thumb] = await Promise.all([call("community_look", { id: entry.id }), loadThumb(entry)]);
    return isLookShape(raw) ? { entry, doc: normalizeDoc(raw), thumb } : null;
  } catch (error) {
    console.warn("community_look_failed", entry.id, errorText(error));
    return null;
  }
}

/** The shared looks with their documents, for the gallery's cards. */
export async function loadCommunity(): Promise<CommunityState> {
  try {
    const entries = await call("community_looks", {});
    const loaded: (SharedLook | null)[] = [];
    for (let start = 0; start < entries.length; start += PARALLEL_LOADS) {
      loaded.push(...(await Promise.all(entries.slice(start, start + PARALLEL_LOADS).map(loadShared))));
    }
    const looks = loaded.filter((look): look is SharedLook => look !== null);
    return { status: "ready", looks, skipped: entries.length - looks.length };
  } catch (error) {
    return { status: "error", message: errorText(error) };
  }
}

/** Copy the current look as a community file and open GitHub to propose it. */
export async function shareToCommunity(meta: ShareMeta): Promise<boolean> {
  const look = structuredClone(unwrap(doc));
  const problems = shareProblems(meta, look);
  if (problems.length > 0) {
    pushToast("negative", "Look not shared", problems.join(" "));
    return false;
  }
  try {
    await navigator.clipboard.writeText(communityFile(meta, look));
  } catch {
    pushToast("negative", "Clipboard unavailable", "ValoShell could not copy the look; try again.");
    return false;
  }
  const page = `${NEW_FILE_URL}?filename=${uniqueFileId(meta.name)}.json`;
  if (!(await openExternal(page))) {
    pushToast("info", "Look copied", `Open ${page} in your browser, paste it there and press Propose changes.`);
    return true;
  }
  pushToast("positive", "Look copied", "Paste it on the GitHub page that opened, then press Propose changes.");
  return true;
}
