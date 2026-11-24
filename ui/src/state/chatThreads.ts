// The dock's conversations as plain data: which thread a key names, its messages, whether it
// can be written to, and how lines group under one author header. Free of IPC so it can be
// tested on its own.
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import type { ChatView } from "~/bindings/ChatView";
import type { DirectChatView } from "~/bindings/DirectChatView";

/** A conversation the dock shows: the party, the agent-select team, or a whisper thread. */
export type ThreadKey = "party" | "team" | `dm:${string}`;

const DIRECT_PREFIX = "dm:";
/** Lines by one author closer together than this share one name and time header. */
export const GROUP_GAP_MS = 2 * 60_000;

export function directKey(puuid: string): ThreadKey {
  return `${DIRECT_PREFIX}${puuid}`;
}

/** The friend a whisper thread is with; null for the party and team chats. */
export function directPuuid(key: ThreadKey): string | null {
  return key.startsWith(DIRECT_PREFIX) ? key.slice(DIRECT_PREFIX.length) : null;
}

export function directThread(view: ChatView | null, puuid: string): DirectChatView | undefined {
  return view?.direct.find((thread) => thread.puuid === puuid);
}

/** A thread's messages, oldest first; empty when it has none or the chat is not read yet. */
export function threadMessages(view: ChatView | null, key: ThreadKey): readonly ChatMessageView[] {
  if (key === "party") return view?.party ?? [];
  if (key === "team") return view?.team ?? [];
  return directThread(view, directPuuid(key) ?? "")?.messages ?? [];
}

/** Whether a message can go out: the group chats must exist; the backend checks friendship. */
export function canSendTo(view: ChatView | null, key: ThreadKey): boolean {
  if (!view) return false;
  if (key === "party") return view.is_party_open;
  if (key === "team") return view.is_team_open;
  return true;
}

/** Whisper threads for the rail: ones just started first, then the latest conversation first. */
export function directThreadList(view: ChatView | null, started: readonly string[]): string[] {
  const existing = (view?.direct ?? []).map((thread) => thread.puuid);
  const fresh = started.filter((puuid) => !existing.includes(puuid));
  return [...fresh, ...existing];
}

/** Whether the line at `index` opens a new author group (and so shows the name and time). */
export function isGroupStart(messages: readonly ChatMessageView[], index: number): boolean {
  const line = messages[index];
  const before = messages[index - 1];
  if (!line || !before) return true;
  if (line.is_system || before.is_system) return true;
  const isSameAuthor = line.is_self === before.is_self && line.author === before.author && line.author_agent === before.author_agent;
  return !isSameAuthor || line.sent_at_ms - before.sent_at_ms > GROUP_GAP_MS;
}

/** Every thread in a view, as keys (the party and team chats always). */
export function threadKeys(view: ChatView): ThreadKey[] {
  return ["party", "team", ...view.direct.map((thread) => directKey(thread.puuid))];
}
