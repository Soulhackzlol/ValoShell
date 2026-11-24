// Editor keyboard and clipboard: Ctrl+E/F2 toggles edit mode; while editing, arrows nudge,
// Delete removes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Shift+Z undo/redo, [ ] restack, Esc
// deselects then exits; pasting a link or image adds it as a widget, a shared look applies it.
// Anywhere: F8 / Shift+F8 step through the menu styles, F9 replays the style's intro.
import { onCleanup, onMount } from "solid-js";
import { replayIntro } from "~/menu/Intro";
import { playCue } from "~/menu/sound";
import { isTyping } from "~/menu/typing";
import { pushToast } from "~/state/toasts";
import { isModalOpen } from "~/ui/modal";
import { addFromImageFile, addFromUrl, currentStage, deleteSelected, duplicatePiece, nudgeSelected } from "./actions";
import { pasteLook } from "./looks";
import { SKINS } from "./skins";
import { switchStyle } from "./styleSwitch";
import { doc, isEditing, mutate, redo, restack, selectedId, setEditMode, setSelectedId, undo } from "./store";
import { animateChange } from "./transitions";

/** Switch to the next (or previous) menu style, as picking it in the Theme tab would. */
function stepSkin(direction: 1 | -1): void {
  const index = SKINS.findIndex((skin) => skin.id === doc.theme.skin);
  const next = SKINS[(index + direction + SKINS.length) % SKINS.length];
  if (!next) return;
  playCue("confirm");
  animateChange(() => mutate((draft) => switchStyle(draft, next)), "build");
  pushToast("info", next.label, "F8 next style · Shift+F8 previous · F9 intro", "style");
}

/** Switch straight to one style (the command palette's "Style: ..." entries). */
export function switchSkin(id: string): void {
  const next = SKINS.find((skin) => skin.id === id);
  if (!next || next.id === doc.theme.skin) return;
  playCue("confirm");
  animateChange(() => mutate((draft) => switchStyle(draft, next)), "build");
}

function stageSize(): { w: number; h: number } {
  return { w: window.innerWidth, h: Math.max(window.innerHeight - 72, 1) };
}

function onEditKey(event: KeyboardEvent): boolean {
  const stage = currentStage();
  const id = selectedId();
  const isCommand = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (isCommand && key === "z") {
    if (event.shiftKey) redo();
    else undo();
    return true;
  }
  if (isCommand && key === "y") {
    redo();
    return true;
  }
  if (event.key === "Escape") {
    if (id) setSelectedId(null);
    else setEditMode(false);
    return true;
  }
  if (!id) return false;
  if (event.key === "Delete" || event.key === "Backspace") {
    deleteSelected(stage);
    return true;
  }
  if (isCommand && key === "d") {
    duplicatePiece(stage, id);
    return true;
  }
  if (event.key === "[" || event.key === "]") {
    restack(stage, id, event.key === "]" ? 1 : -1);
    return true;
  }
  const step = event.shiftKey ? 10 : 1;
  const arrows: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = arrows[event.key];
  if (move) {
    nudgeSelected(stage, move[0], move[1], stageSize());
    return true;
  }
  return false;
}

function onKeyDown(event: KeyboardEvent): void {
  // A dialog owns the keyboard: no style switch, Studio or intro under it.
  if (isTyping(event.target) || isModalOpen()) return;
  const isToggle = event.key === "F2" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e");
  if (isToggle) {
    event.preventDefault();
    setEditMode(!isEditing());
    return;
  }
  if (event.key === "F8") {
    event.preventDefault();
    stepSkin(event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === "F9") {
    event.preventDefault();
    replayIntro();
    return;
  }
  if (isEditing() && onEditKey(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function onPaste(event: ClipboardEvent): void {
  if (!isEditing() || isTyping(event.target)) return;
  const data = event.clipboardData;
  if (!data) return;
  const file = [...data.files].find((entry) => entry.type.startsWith("image/"));
  if (file) {
    event.preventDefault();
    void addFromImageFile(currentStage(), file).then((isAdded) => {
      if (!isAdded) pushToast("info", "Image too large", "Use a link for images over 1.5 MB.");
    });
    return;
  }
  const text = data.getData("text/plain");
  if (text && (pasteLook(text) || addFromUrl(currentStage(), text))) event.preventDefault();
}

/** Install the editor's global listeners for the lifetime of the calling component. */
export function useEditorShortcuts(): void {
  onMount(() => {
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("paste", onPaste);
  });
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("paste", onPaste);
  });
}
