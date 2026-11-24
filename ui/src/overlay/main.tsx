// Entry point of the in-game overlay window (transparent, click-through, over VALORANT).
// It renders the "In-game overlay" stage and follows the main window's Studio edits live.
import { render } from "solid-js/web";
import { Stage } from "~/studio/Stage";
import { followStudio, loadStudio } from "~/studio/store";
import { bindTheme } from "~/studio/theme";
// Streamer mode, contrast and colour vision must hold over the game too; settings.ts also
// follows the menu's changes live.
import "~/state/settings";
import "../theme/tokens.css";
import "../theme/base.css";
import "./overlay.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element in overlay.html");
}

bindTheme();
followStudio();
void loadStudio().then(() => render(() => <Stage id="ingame" />, root));
