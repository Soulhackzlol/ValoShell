// The chat panel's size: dragged or arrow-keyed from its corner grip, kept inside the window,
// and remembered on this device. A lost or unreadable saved size only means the default.

export type PanelSize = { width: number; height: number };

export const DEFAULT_PANEL_SIZE: PanelSize = { width: 520, height: 400 };
/** Below this the rail and the conversation no longer both fit. */
export const MIN_PANEL_SIZE: PanelSize = { width: 300, height: 260 };
/** Room the panel leaves to the window's edges (the corner stack's own margins). */
const WINDOW_MARGIN_PX = 48;
/** One arrow-key press on the grip. */
export const KEY_STEP_PX = 24;

const STORAGE_KEY = "valoshell.chat.panel";

/** `size` kept between the minimum and what the window has room for. */
export function clampPanelSize(size: PanelSize, viewport: PanelSize): PanelSize {
  const maxWidth = Math.max(MIN_PANEL_SIZE.width, viewport.width - WINDOW_MARGIN_PX);
  const maxHeight = Math.max(MIN_PANEL_SIZE.height, viewport.height - WINDOW_MARGIN_PX * 2);
  return {
    width: Math.round(Math.min(maxWidth, Math.max(MIN_PANEL_SIZE.width, size.width))),
    height: Math.round(Math.min(maxHeight, Math.max(MIN_PANEL_SIZE.height, size.height))),
  };
}

function isPanelSize(value: unknown): value is PanelSize {
  if (typeof value !== "object" || value === null) return false;
  const { width, height } = value as Record<string, unknown>;
  return typeof width === "number" && typeof height === "number" && Number.isFinite(width) && Number.isFinite(height);
}

/** The saved size, or the default when there is none or it cannot be read. */
export function loadPanelSize(): PanelSize {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isPanelSize(saved) ? saved : DEFAULT_PANEL_SIZE;
  } catch (error) {
    console.warn("chat_panel_size_unread", error);
    return DEFAULT_PANEL_SIZE;
  }
}

export function savePanelSize(size: PanelSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch (error) {
    console.warn("chat_panel_size_unsaved", error);
  }
}
