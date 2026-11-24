// The webview's built-in browser shortcuts: reload, print and back/forward. The menu never uses
// them, and each one would reload the app or navigate it away mid-session.

export type ShortcutKey = Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey">;

const RELOAD_OR_PRINT = new Set(["r", "p"]);
const NAVIGATION_KEYS = new Set(["BrowserBack", "BrowserForward", "BrowserRefresh", "F5"]);

/** Whether a key press is one of the browser's own reload, print or history shortcuts. */
export function isBrowserShortcut(event: ShortcutKey): boolean {
  if (NAVIGATION_KEYS.has(event.key)) return true;
  if ((event.ctrlKey || event.metaKey) && RELOAD_OR_PRINT.has(event.key.toLowerCase())) return true;
  return event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
}
