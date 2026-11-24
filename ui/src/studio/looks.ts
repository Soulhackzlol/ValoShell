// Looks: named snapshots of the whole Studio document (theme and every stage), saved as
// documents in `themes/`. Applying one is a normal edit, so it can be undone. A look can
// also travel as text (copy/paste) or as its file (the gallery shows the folder; a look file
// dropped there, or onto the app, is used like any other).
import { createSignal } from "solid-js";
import { unwrap } from "solid-js/store";
import { call, errorText } from "~/ipc/commands";
import { pushToast } from "~/state/toasts";
import { normalizeDoc } from "./defaults";
import { BYTES_PER_MB, MAX_LOOK_FILE_BYTES, isLookShape, remoteHosts } from "./lookFiles";
import { doc, mutate, setSelectedId } from "./store";
import type { StudioDoc } from "./types";
import { animateChange } from "./transitions";

const KIND = "themes";
/** Marks clipboard text as a ValoShell look so random text is never applied. */
const SHARE_PREFIX = "valoshell-look:";

const [lookNames, setLookNames] = createSignal<string[]>([]);
export { lookNames };

export async function refreshLooks(): Promise<void> {
  try {
    setLookNames(await call("list_ui_documents", { kind: KIND }));
  } catch (error) {
    pushToast("negative", "Looks unavailable", errorText(error));
  }
}

export async function saveLook(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  try {
    await call("save_ui_document", { kind: KIND, name: trimmed, document: structuredClone(unwrap(doc)) });
    await refreshLooks();
    pushToast("positive", "Look saved", trimmed);
    return true;
  } catch (error) {
    pushToast("negative", "Look not saved", errorText(error));
    return false;
  }
}

function applyDoc(next: StudioDoc): void {
  animateChange(
    () =>
      mutate((draft) => {
        draft.theme = next.theme;
        draft.stages = next.stages;
      }),
    "build",
  );
  setSelectedId(null);
}

export async function applyLook(name: string): Promise<void> {
  try {
    const saved = await call("load_ui_document", { kind: KIND, name });
    if (!saved) throw new Error("It no longer exists.");
    applyDoc(normalizeDoc(saved));
  } catch (error) {
    pushToast("negative", "Look not applied", errorText(error));
  }
}

export type LoadedLook = { name: string; doc: StudioDoc } | { name: string; error: string };

/** A saved look's document, to preview it without applying; the caller reports failures. */
export async function loadLook(name: string): Promise<LoadedLook> {
  try {
    const saved = await call("load_ui_document", { kind: KIND, name });
    return saved ? { name, doc: normalizeDoc(saved) } : { name, error: "It no longer exists." };
  } catch (error) {
    return { name, error: errorText(error) };
  }
}

/** Apply a look already in hand (a starter look, a dropped file); Ctrl+Z undoes it. */
export function applyLookDoc(next: StudioDoc, name: string): void {
  applyDoc(next);
  const hosts = remoteHosts(next);
  const loads = hosts.length > 0 ? ` Loads content from ${hosts.join(", ")}.` : "";
  pushToast("positive", "Look applied", `${name} · Ctrl+Z to undo.${loads}`);
}

/** Apply a dropped look file (one someone shared); explains in a toast when it is not one. */
export async function applyLookFile(file: File): Promise<void> {
  const name = file.name.replace(/\.json$/i, "");
  if (file.size > MAX_LOOK_FILE_BYTES) {
    pushToast("negative", "Look not applied", `${name} is larger than ${MAX_LOOK_FILE_BYTES / BYTES_PER_MB} MB.`);
    return;
  }
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isLookShape(parsed)) throw new Error("It is not a ValoShell look file.");
    applyLookDoc(normalizeDoc(parsed), name);
  } catch (error) {
    pushToast("negative", "Look not applied", errorText(error));
  }
}

/** Show the folder saved and shared looks live in. */
export async function openLooksFolder(): Promise<void> {
  try {
    await call("open_looks_folder", {});
  } catch (error) {
    pushToast("negative", "Looks folder unavailable", errorText(error));
  }
}

/** Select a saved look's file in the file explorer, to send it to someone. */
export async function revealLook(name: string): Promise<void> {
  try {
    await call("reveal_look", { name });
  } catch (error) {
    pushToast("negative", "File not shown", errorText(error));
  }
}

export async function deleteLook(name: string): Promise<void> {
  try {
    await call("delete_ui_document", { kind: KIND, name });
    await refreshLooks();
  } catch (error) {
    pushToast("negative", "Look not deleted", errorText(error));
  }
}

function toBase64(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Copy the current setup to the clipboard as shareable text. */
export async function copyLook(): Promise<void> {
  const text = SHARE_PREFIX + toBase64(JSON.stringify(unwrap(doc)));
  try {
    await navigator.clipboard.writeText(text);
    pushToast("positive", "Look copied", "Paste it in another ValoShell to use it.");
  } catch {
    pushToast("negative", "Clipboard unavailable", "");
  }
}

/** Apply a look from shared text (from `copyLook`). */
export function pasteLook(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith(SHARE_PREFIX)) return false;
  try {
    const parsed: unknown = JSON.parse(fromBase64(trimmed.slice(SHARE_PREFIX.length)));
    if (!isLookShape(parsed)) throw new Error("not a look");
    applyLookDoc(normalizeDoc(parsed), "Pasted look");
    return true;
  } catch {
    pushToast("negative", "That text is not a ValoShell look", "");
    return false;
  }
}
