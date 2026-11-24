// Entry point of the main window.
import { render } from "solid-js/web";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { App } from "./App";
import { isTauri } from "./ipc/runtime";
import { isBrowserShortcut } from "./menu/browserKeys";
import { bindTheme } from "./studio/theme";
import { loadStudio } from "./studio/store";
import "./state/uiSounds";
import "./state/performance";
import "./theme/tokens.css";
import "./theme/base.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element in index.html");
}

bindTheme();
blockBrowserMenu();
// The saved layout and theme load before the first paint, so nothing jumps.
void loadStudio().then(() => {
  render(() => <App />, root);
  // The window starts hidden so the first frame is already painted (no white flash).
  if (isTauri) requestAnimationFrame(() => void getCurrentWindow().show());
});

/** The webview's own right-click menu (Back, Reload, Print, Inspect) and its shortcuts belong to
 *  a browser, not a game menu: they could reload or navigate the app away. Text fields keep the
 *  menu for copy/paste. The browser demo keeps both, so the page can still be inspected there. */
function blockBrowserMenu(): void {
  if (!isTauri) return;
  document.addEventListener("contextmenu", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable='true']")) return;
    event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (isBrowserShortcut(event)) event.preventDefault();
  });
}
