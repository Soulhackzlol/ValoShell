// Unread counting for the chat dock, kept free of IPC so it can be tested on its own.
import type { ChatMessageView } from "~/bindings/ChatMessageView";

/** The newest message time in a chat; 0 when it is empty. */
export function newestAt(messages: readonly ChatMessageView[]): number {
  return messages.reduce((latest, message) => Math.max(latest, message.sent_at_ms), 0);
}

/** Messages from other players sent after `seenAt`; the player's own and system lines never count. */
export function countUnread(messages: readonly ChatMessageView[], seenAt: number): number {
  return messages.filter((message) => !message.is_self && !message.is_system && message.sent_at_ms > seenAt).length;
}
