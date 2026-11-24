// Pending friend requests, both ways: read on connect, when the friend list changes and after
// every answer. Accept, decline, cancel and add only ever run from the player's own click.
import { createSignal } from "solid-js";
import type { FriendRequestView } from "~/bindings/FriendRequestView";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { attempt, pushToast } from "./toasts";

const [friendRequests, setFriendRequests] = createSignal<FriendRequestView[]>(
  [],
);

export { friendRequests };

/** `Name#TAG` with both halves filled in. */
export function isRiotId(text: string): boolean {
  const at = text.lastIndexOf("#");
  return (
    at > 0 &&
    text.slice(0, at).trim() !== "" &&
    text.slice(at + 1).trim() !== ""
  );
}

/** Read the requests again; a failed read keeps the last answer. */
export async function refreshFriendRequests(): Promise<void> {
  try {
    setFriendRequests(await call("get_friend_requests", {}));
  } catch (error) {
    // Only the requests section misses out; the friend list reads on its own.
    console.warn("friend_requests_read_failed", error);
  }
}

async function answer(
  action: () => Promise<unknown>,
  failure: string,
): Promise<boolean> {
  const isDone = await attempt(action, failure);
  void refreshFriendRequests();
  return isDone;
}

export const friendRequestActions = {
  accept: (puuid: string) =>
    answer(
      () => call("friend_request_accept", { puuid }),
      "Request not accepted",
    ),
  /** Decline an incoming request or cancel an outgoing one. */
  remove: (puuid: string) =>
    answer(
      () => call("friend_request_remove", { puuid }),
      "Request not removed",
    ),
  async add(riotId: string) {
    const isSent = await answer(
      () => call("friend_request_send", { riotId: riotId.trim() }),
      "Friend request not sent",
    );
    if (isSent) pushToast("positive", "Friend request sent", riotId.trim());
    return isSent;
  },
};

void refreshFriendRequests();
onAppEvent("friends", () => void refreshFriendRequests());
onAppEvent("connection", (status) => {
  if (status.state === "connected") void refreshFriendRequests();
  else setFriendRequests([]);
});
