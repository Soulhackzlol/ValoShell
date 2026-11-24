// Inside the gallery's preview frame: takes the look and page the gallery sends, shows them
// (demo data, nothing saved), and says when it is ready. Rendered by the menu shell only when
// the app runs as a preview (`isLookPreview`), so it sits inside the router to change pages.
import { onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { normalizeDoc } from "../defaults";
import { showPreviewDoc } from "../store";
import { animateChange } from "../transitions";
import { READY_MESSAGE, isShowMessage } from "./previewProtocol";

/** Only the gallery that embeds this frame, from the app's own origin, may drive it. */
function isFromGallery(event: MessageEvent): boolean {
  return event.source === window.parent && event.origin === window.location.origin;
}

export function PreviewBridge() {
  const navigate = useNavigate();
  let shownDoc = "";
  const onMessage = async (event: MessageEvent) => {
    if (!isFromGallery(event) || !isShowMessage(event.data)) return;
    const text = JSON.stringify(event.data.doc);
    if (text !== shownDoc) {
      shownDoc = text;
      const next = normalizeDoc(event.data.doc);
      animateChange(() => showPreviewDoc(next), "build");
    }
    // The demo backend only: a preview frame never talks to the real one.
    const { prepareDemoPage } = await import("~/ipc/demo");
    prepareDemoPage(event.data.page);
    navigate(`/${event.data.page}`);
  };
  onMount(() => {
    window.addEventListener("message", onMessage);
    window.parent.postMessage(READY_MESSAGE, window.location.origin);
  });
  onCleanup(() => window.removeEventListener("message", onMessage));
  return null;
}
