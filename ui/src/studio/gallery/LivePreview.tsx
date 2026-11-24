// The gallery's live preview: the app itself, run in a frame with demo data, wearing the
// picked look. It draws exactly what applying gives (same styles, layouts, animations and
// backdrops) on any page, and can be clicked through. The frame is drawn at full window size
// and scaled down, so the look is laid out as it will be, not squeezed.
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { unwrap } from "solid-js/store";
import { Check } from "lucide-solid";
import { controls } from "~/ui/controls";
import type { StudioDoc } from "../types";
import {
  PREVIEW_HEIGHT,
  PREVIEW_PAGES,
  PREVIEW_WIDTH,
  type PreviewPage,
  isReadyMessage,
  showMessage,
} from "./previewProtocol";
import { pickedLook } from "./selection";
import styles from "./gallery.module.css";

const APPLY_ICON_PX = 14;

/** Scale that fits the full-size frame into `box`'s width. */
function useFitScale(): { setBox: (box: HTMLDivElement) => void; scale: () => number } {
  const [scale, setScale] = createSignal(0);
  const observer = new ResizeObserver(([entry]) => {
    if (entry) setScale(entry.contentRect.width / PREVIEW_WIDTH);
  });
  onCleanup(() => observer.disconnect());
  return { setBox: (box) => observer.observe(box), scale };
}

function PageChips(props: { page: PreviewPage; onPick: (page: PreviewPage) => void }) {
  return (
    <div class={styles.pageChips} role="tablist" aria-label="Page to preview">
      <For each={PREVIEW_PAGES}>
        {(page) => (
          <button
            role="tab"
            class={styles.pageChip}
            aria-selected={props.page === page.id}
            onClick={() => props.onPick(page.id)}
          >
            {page.label}
          </button>
        )}
      </For>
    </div>
  );
}

export function LivePreview(props: { onApply: (doc: StudioDoc, name: string) => void }) {
  const [page, setPage] = createSignal<PreviewPage>("home");
  const [isReady, setReady] = createSignal(false);
  const fit = useFitScale();
  let frame: HTMLIFrameElement | undefined;
  const onMessage = (event: MessageEvent) => {
    const isOurFrame = event.source === frame?.contentWindow && event.origin === window.location.origin;
    if (isOurFrame && isReadyMessage(event.data)) setReady(true);
  };
  onMount(() => window.addEventListener("message", onMessage));
  onCleanup(() => window.removeEventListener("message", onMessage));
  createEffect(() => {
    const look = pickedLook();
    if (!isReady() || !look) return;
    // A plain copy: store proxies cannot cross into the frame.
    frame?.contentWindow?.postMessage(showMessage(structuredClone(unwrap(look.doc)), page()), window.location.origin);
  });
  return (
    <section class={styles.live} data-part="look-live-preview" aria-label="Live preview">
      <div class={styles.liveScreen} ref={fit.setBox} data-ready={isReady() ? "" : undefined}>
        <iframe
          ref={frame}
          class={styles.liveFrame}
          src="/?look-preview"
          title="Live preview of the picked look"
          sandbox="allow-scripts allow-same-origin"
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          style={{ transform: `scale(${fit.scale()})` }}
        />
        <Show when={!isReady()}>
          <span class={styles.liveLoading}>Starting the preview…</span>
        </Show>
      </div>
      <PageChips page={page()} onPick={setPage} />
      <Show when={pickedLook()}>
        {(look) => (
          <div class={styles.liveInfo}>
            <span class={styles.liveText}>
              <b>{look().name}</b>
              <span>{look().caption} · sample data</span>
            </span>
            <button class={`${controls.button} ${controls.small}`} onClick={() => props.onApply(look().doc, look().name)}>
              <Check size={APPLY_ICON_PX} /> Apply
            </button>
          </div>
        )}
      </Show>
    </section>
  );
}
