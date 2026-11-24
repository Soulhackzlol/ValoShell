// The frame every party chat line sits in (the standard one, Glass's and each style's own), so
// the line can be laid out three ways (chatLayouts.module.css): the line alone, a chat box with
// the latest party messages above it, as in-game chats show them, or just its icon. The line
// itself (its label, field and colours) stays each style's own.
import { For, Show, type JSX } from "solid-js";
import type { ChatLine } from "./chatLine";
import { unreadBadge } from "./screenData";
import layouts from "./chatLayouts.module.css";

export function ChatFrame(props: { line: ChatLine; children: JSX.Element }) {
  return (
    <div class={layouts.frame}>
      <ol class={layouts.log} aria-label="Party chat">
        <For each={props.line.recent()}>
          {(message) => (
            <li class={layouts.message} data-system={message.is_system ? "" : undefined}>
              <b class={layouts.author} data-self={message.is_self ? "" : undefined} data-sensitive>
                {message.author}
              </b>
              <span>{message.body}</span>
            </li>
          )}
        </For>
      </ol>
      {props.children}
    </div>
  );
}

/** The unread count on a line's open-chat button, as the chat chip it replaces shows it. */
export function ChatUnread(props: { line: ChatLine }) {
  return (
    <Show when={props.line.unread() > 0}>
      <span class={layouts.unread} aria-hidden="true">
        {unreadBadge(props.line.unread())}
      </span>
    </Show>
  );
}
