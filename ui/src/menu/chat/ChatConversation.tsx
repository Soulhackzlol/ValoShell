// One open conversation: who it is with (and what they are doing, for a friend), the lines
// grouped under one name and time per author, and the message box with a per-thread draft.
// Names come from the backend as the lineup or friend list shows them, and blur in streamer
// mode; Riot's own system lines may hold a Riot ID, so they blur too.
import { For, Show, createEffect, on } from "solid-js";
import { X } from "lucide-solid";
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import { activeThread, chat, markRead } from "~/state/chat";
import { type ThreadKey, canSendTo, directPuuid, isGroupStart, threadMessages } from "~/state/chatThreads";
import { friendActivity } from "~/state/friends";
import { ChatCompose } from "./ChatCompose";
import { directName, friendOf } from "./ChatRail";
import styles from "./chat.module.css";

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function authorOf(message: ChatMessageView, fallback: string): string {
  if (message.is_self) return "You";
  return message.author || message.author_agent || fallback;
}

/** `isDirect`: a whisper, where even the fallback author is a friend's name. */
function Line(props: { message: ChatMessageView; isStart: boolean; fallbackAuthor: string; isDirect: boolean }) {
  const time = () => (props.message.sent_at_ms > 0 ? CLOCK.format(props.message.sent_at_ms) : "");
  const isNamed = () => !props.message.is_self && (props.message.author !== "" || props.isDirect);
  return (
    <li
      class={styles.line}
      data-part="chat-line"
      data-self={props.message.is_self ? "" : undefined}
      data-system={props.message.is_system ? "" : undefined}
      data-start={props.isStart ? "" : undefined}
    >
      <Show when={props.isStart && !props.message.is_system}>
        <header class={styles.lineHead}>
          <b data-sensitive={isNamed() ? "" : undefined}>{authorOf(props.message, props.fallbackAuthor)}</b>
          <time dateTime={new Date(props.message.sent_at_ms).toISOString()}>{time()}</time>
        </header>
      </Show>
      <p class={styles.body} title={time()} data-sensitive={props.message.is_system ? "" : undefined}>
        {props.message.body}
      </p>
    </li>
  );
}

const GROUP_TITLES = { party: "Party", team: "Team" } as const;
const GROUP_HINTS = { party: "Everyone in your party", team: "Your team in agent select" } as const;

const groupOf = (thread: ThreadKey) => (thread === "team" ? "team" : "party");

/** Who the conversation is with: a group and its hint, or a friend and what they are doing. */
function PaneHead(props: { friendId: string | null; onClose: () => void }) {
  const friend = () => (props.friendId ? friendOf(props.friendId) : undefined);
  return (
    <header class={styles.paneHead} data-part="chat-head">
      <Show
        when={props.friendId}
        fallback={
          <div class={styles.paneTitle}>
            <b>{GROUP_TITLES[groupOf(activeThread())]}</b>
            <span class={styles.paneStatus}>{GROUP_HINTS[groupOf(activeThread())]}</span>
          </div>
        }
      >
        {(puuid) => (
          <div class={styles.paneTitle}>
            <b data-sensitive>
              {directName(puuid())}
              <Show when={friend()}>{(shown) => <small>#{shown().tag_line}</small>}</Show>
            </b>
            <Show when={friend()} fallback={<span class={styles.paneStatus}>Not on your friend list</span>}>
              {(shown) => (
                <span class={styles.paneStatus} data-status={shown().status}>
                  {friendActivity(shown())}
                </span>
              )}
            </Show>
          </div>
        )}
      </Show>
      <button class={styles.close} aria-label="Close chat" onClick={() => props.onClose()}>
        <X size={14} />
      </button>
    </header>
  );
}

function EmptyLine(props: { friendId: string | null; isEnabled: boolean }) {
  return (
    <li class={styles.empty}>
      <Show when={chat()} fallback="Connect to VALORANT to chat.">
        <Show when={props.friendId} fallback={props.isEnabled ? "No messages yet." : "This chat opens once you are in a party."}>
          {(puuid) => (
            <>
              Say hi to <span data-sensitive>{directName(puuid())}</span>.
            </>
          )}
        </Show>
      </Show>
    </li>
  );
}

export function ChatConversation(props: { onClose: () => void }) {
  let log: HTMLDivElement | undefined;
  const friendId = () => directPuuid(activeThread());
  const messages = () => threadMessages(chat(), activeThread());
  const isEnabled = () => canSendTo(chat(), activeThread());
  // A friend's name is never put in the placeholder: it would not blur in streamer mode.
  const placeholder = () => (friendId() ? "Write a message" : `Message your ${groupOf(activeThread())}`);
  // The newest line's id: the store keeps the same array as lines arrive, so this is what moves.
  const newestId = () => messages()[messages().length - 1]?.id ?? "";
  // While open, what arrives is read, and the list follows the newest line.
  createEffect(
    on([activeThread, newestId], ([thread]) => {
      markRead(thread);
      queueMicrotask(() => log?.scrollTo({ top: log.scrollHeight }));
    }),
  );
  return (
    <section class={styles.pane} data-part="chat-conversation" aria-label="Conversation">
      <PaneHead friendId={friendId()} onClose={props.onClose} />
      <div class={styles.log} ref={log} role="log" aria-label="Messages">
        <ol class={styles.lines}>
          <For each={messages()} fallback={<EmptyLine friendId={friendId()} isEnabled={isEnabled()} />}>
            {(message, index) => {
              const fallbackAuthor = () => {
                const puuid = friendId();
                return puuid ? directName(puuid) : "Teammate";
              };
              return <Line message={message} isStart={isGroupStart(messages(), index())} fallbackAuthor={fallbackAuthor()} isDirect={friendId() !== null} />;
            }}
          </For>
        </ol>
      </div>
      <ChatCompose thread={activeThread()} placeholder={placeholder()} isEnabled={isEnabled()} onEscape={() => props.onClose()} />
    </section>
  );
}
