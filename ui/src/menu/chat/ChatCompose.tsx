// The message box: one draft per thread, Up recalls the last message sent there, and a count of
// characters left once the limit is near. Sending is tracked per thread, so a slow send in one
// conversation never blocks another.
import { Show, createEffect, on } from "solid-js";
import { Send } from "lucide-solid";
import { draftOf, isSending, lastSentTo, sendChat, setDraft } from "~/state/chat";
import type { ThreadKey } from "~/state/chatThreads";
import controls from "~/ui/controls.module.css";
import styles from "./chat.module.css";

/** Riot rejects longer messages; the backend checks the same limit. */
const MAX_MESSAGE_CHARS = 300;
/** The count of characters left shows from here on. */
const COUNTER_FROM = 60;

type ComposeProps = { thread: ThreadKey; placeholder: string; isEnabled: boolean; onEscape: () => void };

/** Keys in the box: never the styles' global shortcuts; Esc closes, Up recalls. */
function onComposeKey(event: KeyboardEvent, props: ComposeProps): void {
  event.stopPropagation();
  if (event.key === "Escape") props.onEscape();
  if (event.key !== "ArrowUp" || draftOf(props.thread)) return;
  const last = lastSentTo(props.thread);
  if (!last) return;
  event.preventDefault();
  setDraft(props.thread, last);
}

export function ChatCompose(props: ComposeProps) {
  let input: HTMLInputElement | undefined;
  const text = () => draftOf(props.thread);
  const left = () => MAX_MESSAGE_CHARS - text().length;
  const canSend = () => props.isEnabled && text().trim() !== "" && !isSending(props.thread);
  // Switching threads moves the cursor to the new thread's box.
  createEffect(on(() => props.thread, () => queueMicrotask(() => input?.focus())));
  const send = (event: SubmitEvent) => {
    event.preventDefault();
    if (canSend()) void sendChat(props.thread, text().trim());
  };
  return (
    <form class={styles.compose} data-part="chat-compose" onSubmit={send}>
      <input
        ref={input}
        class={controls.input}
        aria-label="Message"
        placeholder={props.isEnabled ? props.placeholder : "Not available"}
        maxLength={MAX_MESSAGE_CHARS}
        disabled={!props.isEnabled}
        value={text()}
        onInput={(event) => setDraft(props.thread, event.currentTarget.value)}
        onKeyDown={(event) => onComposeKey(event, props)}
      />
      <Show when={left() <= COUNTER_FROM}>
        <span class={styles.counter} aria-live="polite">
          {left()}
        </span>
      </Show>
      <button class={styles.send} type="submit" aria-label="Send" disabled={!canSend()}>
        <Send size={15} />
      </button>
    </form>
  );
}
