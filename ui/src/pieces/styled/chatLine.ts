// The party chat line every style draws at the edge of the menu (the standard one, Glass's and
// each style's own): it sends to party chat for real and shares the chat dock's party draft, so
// a message started in one is still there in the other. Up recalls the last message sent, as in
// the game; with no party chat yet (VALORANT closed) the line says so instead of eating text.
import {
  chat,
  directUnreadCount,
  draftOf,
  isSending,
  lastSentTo,
  openThread,
  sendChat,
  setDraft,
  unreadCount,
} from "~/state/chat";
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import { canSendTo, threadMessages } from "~/state/chatThreads";

const THREAD = "party";
const CLOSED = "Party chat opens with VALORANT";
/** How many party messages the Chat box layout shows; older ones are in the full chat. */
const RECENT_MESSAGES = 6;

export interface ChatLine {
  text: () => string;
  canSend: () => boolean;
  isSending: () => boolean;
  /** `ready` while party chat is open, else `closed` (a style may word both in its language). */
  placeholder: (ready: string, closed?: string) => string;
  /** The full chat panel on the party thread: history, whispers, unread. */
  openChat: () => void;
  /** Unread party messages and whispers: the line stands in for the chat chip and its badge. */
  unread: () => number;
  /** The latest party messages, oldest first, for the Chat box layout. */
  recent: () => readonly ChatMessageView[];
  onInput: (value: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  submit: () => void;
}

export function useChatLine(): ChatLine {
  const canSend = () => canSendTo(chat(), THREAD);
  const text = () => draftOf(THREAD);
  return {
    text,
    canSend,
    isSending: () => isSending(THREAD),
    placeholder: (ready, closed = CLOSED) => (canSend() ? ready : closed),
    openChat: () => openThread(THREAD),
    unread: () => unreadCount(THREAD) + directUnreadCount(),
    recent: () => threadMessages(chat(), THREAD).slice(-RECENT_MESSAGES),
    onInput: (value) => setDraft(THREAD, value),
    onKeyDown: (event) => {
      if (event.key === "ArrowUp" && !text()) setDraft(THREAD, lastSentTo(THREAD));
    },
    submit: () => {
      const message = text().trim();
      if (message && canSend() && !isSending(THREAD)) void sendChat(THREAD, message);
    },
  };
}
