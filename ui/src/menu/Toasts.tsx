// Toast stack (bottom right): action errors and confirmations.
import { For } from "solid-js";
import { X } from "lucide-solid";
import { dismissToast, toasts } from "~/state/toasts";
import styles from "./Toasts.module.css";

export function Toasts() {
  return (
    <div class={styles.stack} data-part="toasts" aria-live="polite">
      <For each={toasts()}>
        {(toast) => (
          <div class={styles.toast} data-tone={toast.tone}>
            <span class={styles.bar} />
            <div class={styles.text}>
              <span class={styles.title}>{toast.title}</span>
              {toast.body ? <span class={styles.body}>{toast.body}</span> : null}
            </div>
            <button class={styles.close} aria-label="Dismiss" onClick={() => dismissToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
