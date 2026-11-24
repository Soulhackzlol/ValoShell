// Server status notice (bottom left, home and play only, above the restriction notice): Riot's
// running or scheduled maintenance and serious incidents for the region. A dismissed notice
// stays dismissed; one Riot posts later still shows.
import { For, Show } from "solid-js";
import { X } from "lucide-solid";
import type { ServiceNoticeView } from "~/bindings/ServiceNoticeView";
import {
  dismissServiceNotices,
  visibleServiceNotices,
} from "~/state/serviceStatus";
import styles from "./ServiceNotice.module.css";

function label(notice: ServiceNoticeView): string {
  if (notice.kind === "incident")
    return notice.is_urgent ? "Service outage" : "Service issue";
  return notice.is_urgent ? "Maintenance now" : "Maintenance planned";
}

export function ServiceNotice() {
  return (
    <Show when={visibleServiceNotices().length > 0}>
      <div class={styles.notice} role="status">
        <span class={styles.bar} />
        <div class={styles.list}>
          <For each={visibleServiceNotices()}>
            {(notice) => (
              <div
                class={styles.item}
                data-urgent={notice.is_urgent ? "" : undefined}
              >
                <span class={styles.kind}>{label(notice)}</span>
                <span class={styles.title}>{notice.title}</span>
                <Show when={notice.detail}>
                  <span class={styles.body}>{notice.detail}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
        <button
          class={styles.close}
          aria-label="Dismiss"
          onClick={dismissServiceNotices}
        >
          <X size={14} />
        </button>
      </div>
    </Show>
  );
}
