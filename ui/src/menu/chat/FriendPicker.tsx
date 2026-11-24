// "New message": pick a friend to whisper, searched by Riot ID, available friends first (the
// order the friend list already has). Enter takes the first match, Esc goes back.
import { For, Show, createMemo, createSignal } from "solid-js";
import { Search, X } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import { friendActivity, friends } from "~/state/friends";
import { focusWhenShown } from "~/ui/modal";
import { FriendAvatar } from "./ChatRail";
import styles from "./chat.module.css";

function PickRow(props: { friend: FriendView; onPick: (puuid: string) => void }) {
  return (
    <li>
      <button class={styles.thread} data-part="chat-pick" data-status={props.friend.status} onClick={() => props.onPick(props.friend.puuid)}>
        <FriendAvatar puuid={props.friend.puuid} />
        <span class={styles.threadText}>
          <span class={styles.threadName} data-sensitive>
            {props.friend.game_name}
            <Show when={props.friend.tag_line}>
              <small>#{props.friend.tag_line}</small>
            </Show>
          </span>
          <span class={styles.preview}>{friendActivity(props.friend)}</span>
        </span>
      </button>
    </li>
  );
}

export function FriendPicker(props: { onPick: (puuid: string) => void; onCancel: () => void }) {
  const [query, setQuery] = createSignal("");
  const shown = createMemo(() => {
    const text = query().trim().toLowerCase();
    return friends().filter((friend) => !text || `${friend.game_name}#${friend.tag_line}`.toLowerCase().includes(text));
  });
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") props.onCancel();
    const first = shown()[0];
    if (event.key === "Enter" && first) props.onPick(first.puuid);
  };
  return (
    <section class={styles.pane} data-part="chat-picker" aria-label="New message">
      <header class={styles.paneHead} data-part="chat-head">
        <div class={styles.paneTitle}>
          <b>New message</b>
          <span class={styles.paneStatus}>Whisper a friend</span>
        </div>
        <button class={styles.close} aria-label="Back to the conversation" onClick={() => props.onCancel()}>
          <X size={14} />
        </button>
      </header>
      <label class={styles.search}>
        <Search size={14} />
        <input ref={focusWhenShown} placeholder="Search friends" spellcheck={false} value={query()} onInput={(event) => setQuery(event.currentTarget.value)} onKeyDown={onKeyDown} />
      </label>
      <ul class={styles.picks}>
        <For each={shown()} fallback={<li class={styles.empty}>{friends().length === 0 ? "No friends yet." : "Nobody matches."}</li>}>
          {(friend) => <PickRow friend={friend} onPick={props.onPick} />}
        </For>
      </ul>
    </section>
  );
}
