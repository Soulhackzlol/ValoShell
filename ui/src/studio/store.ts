// The live Studio document: edit mode, selection, undo/redo and autosave. Every change is a
// small mutation through `mutate`, which records history (coalescing slider drags) and
// schedules one save; the in-game overlay window receives the same document live.
import { createSignal } from "solid-js";
import { createStore, produce, reconcile, unwrap } from "solid-js/store";
import { emit, listen } from "@tauri-apps/api/event";
import { call } from "~/ipc/commands";
import { isLookPreview, isTauri } from "~/ipc/runtime";
import { pushToast } from "~/state/toasts";
import { defaultDoc, defaultStage, normalizeDoc } from "./defaults";
import { refreshLayouts } from "./skins";
import type { Piece, StageId, StudioDoc, Theme } from "./types";
import { animateChange, settleChange } from "./transitions";

const DOCUMENT_NAME = "studio";
const SAVE_DELAY_MS = 450;
const HISTORY_LIMIT = 120;
/** Repeated changes with the same key inside this window are one undo step (slider drags). */
const COALESCE_MS = 700;
export const STUDIO_EVENT = "studio-doc";

const [doc, setDoc] = createStore<StudioDoc>(defaultDoc());
const [isLoaded, setLoaded] = createSignal(false);
const [isEditing, setEditing] = createSignal(false);
const [selectedId, setSelectedId] = createSignal<string | null>(null);
const [historySize, setHistorySize] = createSignal({ past: 0, future: 0 });

export { doc, isLoaded, isEditing, selectedId, setSelectedId, historySize };

const past: string[] = [];
const future: string[] = [];
let lastRecord = { key: "", at: 0 };
let saveTimer = 0;

function snapshot(): string {
  return JSON.stringify(unwrap(doc));
}

function syncHistorySize(): void {
  setHistorySize({ past: past.length, future: future.length });
}

function record(key: string): void {
  settleChange();
  const now = performance.now();
  const isSameGesture = key !== "" && key === lastRecord.key && now - lastRecord.at < COALESCE_MS;
  lastRecord = { key, at: now };
  if (isSameGesture) return;
  past.push(snapshot());
  if (past.length > HISTORY_LIMIT) past.shift();
  future.length = 0;
  syncHistorySize();
}

/** Apply a change. `key` groups rapid repeats (e.g. `theme.accent`) into one undo step. */
export function mutate(change: (draft: StudioDoc) => void, key = ""): void {
  record(key);
  setDoc(produce(change));
  scheduleSave();
}

export function undo(): void {
  settleChange();
  const previous = past.pop();
  if (previous === undefined) return;
  future.push(snapshot());
  animateChange(() => setDoc(reconcile(JSON.parse(previous) as StudioDoc)));
  lastRecord = { key: "", at: 0 };
  syncHistorySize();
  scheduleSave();
}

export function redo(): void {
  settleChange();
  const next = future.pop();
  if (next === undefined) return;
  past.push(snapshot());
  animateChange(() => setDoc(reconcile(JSON.parse(next) as StudioDoc)));
  syncHistorySize();
  scheduleSave();
}

// ---- persistence ------------------------------------------------------------------------

function hasOverlayPieces(): boolean {
  return (doc.stages.ingame ?? []).some((piece) => !piece.isHidden);
}

let hasPendingSave = false;

function scheduleSave(): void {
  // A gallery preview shows a look it was handed; it never writes over anything.
  if (isLookPreview) return;
  window.clearTimeout(saveTimer);
  hasPendingSave = true;
  saveTimer = window.setTimeout(() => void save(), SAVE_DELAY_MS);
}

/** Save now if an edit is still waiting for its delayed save (before quitting). */
export async function flushSave(): Promise<void> {
  if (!hasPendingSave) return;
  window.clearTimeout(saveTimer);
  await save();
}

// Closing the page (the browser preview, a reload) must not drop the last edit.
window.addEventListener("pagehide", () => void flushSave());

async function save(): Promise<void> {
  hasPendingSave = false;
  const document = unwrap(doc);
  try {
    await call("save_ui_document", { kind: "layouts", name: DOCUMENT_NAME, document });
    await call("set_overlay_enabled", { isEnabled: hasOverlayPieces() });
    if (isTauri) await emit(STUDIO_EVENT, document);
  } catch (error) {
    pushToast("negative", "Layout not saved", typeof error === "string" ? error : "");
  }
}

/** Load the saved document once at startup (main window and overlay). */
export async function loadStudio(): Promise<void> {
  try {
    const saved = await call("load_ui_document", { kind: "layouts", name: DOCUMENT_NAME });
    if (saved) {
      const loaded = normalizeDoc(saved);
      const isRelaid = refreshLayouts(loaded);
      setDoc(reconcile(loaded));
      if (isRelaid) scheduleSave();
    }
    await call("set_overlay_enabled", { isEnabled: hasOverlayPieces() });
  } catch (error) {
    pushToast("negative", "Saved layout unreadable, using the default", typeof error === "string" ? error : "");
  } finally {
    setLoaded(true);
  }
}

/** The gallery's preview frame: show `next` as it is, unsaved (scheduleSave is off there). */
export function showPreviewDoc(next: StudioDoc): void {
  setDoc(reconcile(next));
}

/** Overlay window: follow the main window's edits live. */
export function followStudio(): void {
  if (!isTauri) return;
  void listen<unknown>(STUDIO_EVENT, ({ payload }) => setDoc(reconcile(normalizeDoc(payload))));
}

// ---- edit mode and pieces ---------------------------------------------------------------

export function setEditMode(isOn: boolean): void {
  setEditing(isOn);
  if (!isOn) setSelectedId(null);
}

/** Pieces of a stage (defaults until the stage is first edited). */
export function stagePieces(stage: StageId): Piece[] {
  return doc.stages[stage] ?? defaultStage(stage);
}

/** Copy the defaults into the document before the first edit of a stage. */
function ensureStage(draft: StudioDoc, stage: StageId): Piece[] {
  const existing = draft.stages[stage];
  if (existing) return existing;
  const created = defaultStage(stage);
  draft.stages[stage] = created;
  return created;
}

/** Make a stage's pieces live store objects before editing it, so a gesture never sees its
 * piece re-created mid-flight. Not an edit: no history, no save. */
export function materializeStage(stage: StageId): void {
  if (doc.stages[stage]) return;
  setDoc(produce((draft) => void ensureStage(draft, stage)));
}

export function updatePiece(stage: StageId, id: string, change: (piece: Piece) => void, key = ""): void {
  mutate((draft) => {
    const piece = ensureStage(draft, stage).find((entry) => entry.id === id);
    if (piece) change(piece);
  }, key);
}

export function addPiece(stage: StageId, piece: Piece): void {
  animateChange(() =>
    mutate((draft) => {
      const pieces = ensureStage(draft, stage);
      const top = pieces.reduce((max, entry) => Math.max(max, entry.z), 0);
      pieces.push({ ...piece, z: top + 1 });
    }),
  );
  setSelectedId(piece.id);
}

export function removePiece(stage: StageId, id: string): void {
  animateChange(() =>
    mutate((draft) => {
      const pieces = ensureStage(draft, stage);
      const index = pieces.findIndex((entry) => entry.id === id);
      if (index >= 0) pieces.splice(index, 1);
    }),
  );
  if (selectedId() === id) setSelectedId(null);
}

/** Move a piece one step up or down the stacking order. */
export function restack(stage: StageId, id: string, direction: 1 | -1): void {
  mutate((draft) => {
    const ordered = [...ensureStage(draft, stage)].sort((a, b) => a.z - b.z);
    const index = ordered.findIndex((entry) => entry.id === id);
    const other = ordered[index + direction];
    const current = ordered[index];
    if (!other || !current) return;
    const z = current.z;
    current.z = other.z === z ? z + direction : other.z;
    other.z = z;
  });
}

export function resetStage(stage: StageId): void {
  animateChange(() =>
    mutate((draft) => {
      delete draft.stages[stage];
    }),
  );
  setSelectedId(null);
}

export function updateTheme(change: (theme: Theme) => void, key = ""): void {
  mutate((draft) => change(draft.theme), key);
}

export function resetEverything(): void {
  animateChange(
    () =>
      mutate((draft) => {
        const fresh = defaultDoc();
        draft.theme = fresh.theme;
        draft.stages = {};
      }),
    "build",
  );
  setSelectedId(null);
}
