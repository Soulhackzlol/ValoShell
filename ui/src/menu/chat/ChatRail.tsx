// The dock's conversations: the party, the team in agent select, and one thread per friend,
// each with its last line and unread count. A narrow panel shows only the avatars
// (chat.module.css), so the rail scales down with the panel instead of crowding it.
import { For, type JSX, Show } from "solid-js";
import { Plus, Shield, Users } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import { activeThread, chat, directThreads, unreadCount } from "~/state/chat";
import { type ThreadKey, directKey, directThread, threadMessages } from "~/state/chatThreads";
import { friends } from "~/state/friends";
import { Art } from "~/ui/Art";
import styles from "./chat.module.css";

export function friendOf(puuid: string): FriendView | undefined {
  return friends().find((friend) => friend.puuid === puuid);
}

/** A whisper thread's name: the friend list's, else the thread's own, else a plain word. */
export function directName(puuid: string): string {
  return friendOf(puuid)?.game_name || directThread(chat(), puuid)?.game_name || "Friend";
}

/** The newest line a player wrote. Riot's system lines may hold a Riot ID, which a preview
 * line could not blur on its own, so they are skipped. */
function lastLine(thread: ThreadKey): string {
  const last = [...threadMessages(chat(), thread)].reverse().find((message) => !message.is_system);
  if (!last) return "";
  return last.is_self ? `You: ${last.body}` : last.body;
}

/** A friend's card, or their initial while it loads or when they have none. */
export function FriendAvatar(props: { puuid: string }) {
  return (
    <span class={styles.avatar} data-status={friendOf(props.puuid)?.status ?? "offline"}>
      <Art src={friendOf(props.puuid)?.card_small} fallback={<span data-sensitive>{directName(props.puuid).charAt(0).toUpperCase()}</span>} />
    </span>
  );
}

type ThreadProps = { thread: ThreadKey; title: string; avatar: JSX.Element; isSensitive: boolean; onSelect: (thread: ThreadKey) => void };

function ThreadButton(props: ThreadProps) {
  const unread = () => unreadCount(props.thread);
  return (
    <li>
      <button
        class={styles.thread}
        data-part="chat-thread"
        aria-current={activeThread() === props.thread ? "true" : undefined}
        // A tooltip is not blurred in streamer mode, so friends' names never go in one.
        title={props.isSensitive ? undefined : props.title}
        onClick={() => props.onSelect(props.thread)}
      >
        {props.avatar}
        <span class={styles.threadText}>
          <span class={styles.threadName} data-sensitive={props.isSensitive ? "" : undefined}>
            {props.title}
          </span>
          <span class={styles.preview}>{lastLine(props.thread)}</span>
        </span>
        <Show when={unread() > 0}>
          <b class={styles.badge}>
            {unread()}
            <span class={styles.hidden}> unread</span>
          </b>
        </Show>
      </button>
    </li>
  );
}

export function ChatRail(props: { isTeamScene: boolean; isPicking: boolean; onSelect: (thread: ThreadKey) => void; onNewMessage: () => void }) {
  return (
    <nav class={styles.rail} data-part="chat-rail" aria-label="Conversations">
      <ul class={styles.threads}>
        <ThreadButton thread="party" title="Party" avatar={<span class={styles.avatar}><Users size={16} /></span>} isSensitive={false} onSelect={props.onSelect} />
        <Show when={props.isTeamScene}>
          <ThreadButton thread="team" title="Team" avatar={<span class={styles.avatar}><Shield size={16} /></span>} isSensitive={false} onSelect={props.onSelect} />
        </Show>
      </ul>
      <h3 class={styles.railHeading}>Direct messages</h3>
      <ul class={styles.threads} data-part="chat-direct">
        <For each={directThreads()}>
          {(puuid) => (
            <ThreadButton thread={directKey(puuid)} title={directName(puuid)} avatar={<FriendAvatar puuid={puuid} />} isSensitive onSelect={props.onSelect} />
          )}
        </For>
      </ul>
      <button class={styles.newMessage} data-part="chat-new" aria-pressed={props.isPicking} title="New message" onClick={() => props.onNewMessage()}>
        <Plus size={15} />
        <span>New message</span>
      </button>
    </nav>
  );
}
