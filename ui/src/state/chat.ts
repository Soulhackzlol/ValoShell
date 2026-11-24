// Party, agent-select and whisper chat as the backend publishes it, what the player has read,
// the dock's open thread and drafts, and sending. Unread counts only grow from other players'
// messages: what a thread held when ValoShell first saw the chat is history read in the
// client, not news, and is never compared against this machine's clock.
import { createSignal } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import type { ChatView } from "~/bindings/ChatView";
import { call, errorText } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { type ThreadKey, directKey, directPuuid, directThreadList, threadKeys, threadMessages } from "./chatThreads";
import { countUnread, newestAt } from "./chatUnread";
import { pushToast } from "./toasts";

/** What counts as seen in a thread that first appears after the first chat read: all of it is new. */
const NOTHING_SEEN = 0;

/** A store, merged by message id, so an update keeps every line on screen that did not change. */
const [store, setStore] = createStore<{ view: ChatView | null }>({ view: null });
/** The newest message time the player has seen, per thread. */
const [seenAt, setSeenAt] = createSignal<Partial<Record<ThreadKey, number>>>({});
const [isDockOpen, setDockOpen] = createSignal(false);
const [activeThread, setActiveThread] = createSignal<ThreadKey>("party");
/** Whispers opened from a friend before any message exists; they join the rail at once. */
const [startedDirect, setStartedDirect] = createSignal<string[]>([]);
const [drafts, setDrafts] = createSignal<Partial<Record<ThreadKey, string>>>({});
const [sending, setSending] = createSignal<ReadonlySet<ThreadKey>>(new Set());
/** The last message sent per thread, recalled with the Up arrow like the game's chat. */
const lastSent = new Map<ThreadKey, string>();
let hasBaseline = false;

export const chat = () => store.view;
export { activeThread, isDockOpen, setActiveThread, setDockOpen };

function receive(view: ChatView | null): void {
  if (view && !hasBaseline) {
    hasBaseline = true;
    setSeenAt(Object.fromEntries(threadKeys(view).map((key) => [key, newestAt(threadMessages(view, key))])));
  }
  if (!view || !store.view) setStore("view", view);
  else setStore("view", reconcile(view, { key: "id" }));
}

onAppEvent("chat", receive);
// Before the first event; a failure here only means the first event brings the chat instead.
void call("get_chat", {}).then(
  (current) => current && receive(current),
  (failure: unknown) => console.warn("chat_initial_read_failed", failure),
);

/** Messages from others newer than what the player saw. */
export function unreadCount(key: ThreadKey): number {
  return countUnread(threadMessages(chat(), key), seenAt()[key] ?? NOTHING_SEEN);
}

/** Unread whispers across every friend. */
export function directUnreadCount(): number {
  return (chat()?.direct ?? []).reduce((total, thread) => total + unreadCount(directKey(thread.puuid)), 0);
}

export function markRead(key: ThreadKey): void {
  const newest = newestAt(threadMessages(chat(), key));
  if (newest > (seenAt()[key] ?? NOTHING_SEEN)) setSeenAt((current) => ({ ...current, [key]: newest }));
}

/** The friends with a whisper thread in the rail, as puuids. */
export const directThreads = () => directThreadList(chat(), startedDirect());

/** Open the dock on a thread. */
export function openThread(key: ThreadKey): void {
  setActiveThread(key);
  setDockOpen(true);
}

/** Open the dock on a whisper with a friend, starting the thread when there is none. */
export function openDirectChat(puuid: string): void {
  if (!startedDirect().includes(puuid)) setStartedDirect((current) => [puuid, ...current]);
  openThread(directKey(puuid));
}

export const draftOf = (key: ThreadKey) => drafts()[key] ?? "";

export function setDraft(key: ThreadKey, text: string): void {
  setDrafts((current) => ({ ...current, [key]: text }));
}

export const lastSentTo = (key: ThreadKey) => lastSent.get(key) ?? "";

/** A message to this thread is on its way (other threads can still send). */
export const isSending = (key: ThreadKey) => sending().has(key);

function markSending(key: ThreadKey, isOn: boolean): void {
  setSending((current) => {
    const next = new Set(current);
    if (isOn) next.add(key);
    else next.delete(key);
    return next;
  });
}

/** Send one message; on success the draft clears, unless more was typed while it went out. */
export async function sendChat(key: ThreadKey, text: string): Promise<boolean> {
  const puuid = directPuuid(key);
  markSending(key, true);
  try {
    if (puuid) await call("chat_send_direct", { puuid, text });
    else await call("chat_send", { scope: key === "team" ? "team" : "party", text });
    lastSent.set(key, text);
    if (draftOf(key).trim() === text) setDraft(key, "");
    return true;
  } catch (failure) {
    pushToast("negative", "Message not sent", errorText(failure));
    return false;
  } finally {
    markSending(key, false);
  }
}
