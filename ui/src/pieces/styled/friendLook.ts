// What every style's own friends look shares: the friends split into who is in VALORANT, who is
// in another game and who is offline, and one friend's actions (party invite and a whisper that
// opens the chat dock) by the same rules as every other look (socialActions.ts).
import type { FriendView } from "~/bindings/FriendView";
import { friends, isElsewhere } from "~/state/friends";
import { canInvite, canWhisper, isInParty, useInvite, whisper } from "./socialActions";

export { isOfflineShown } from "./socialActions";

/** Where a friend is: in VALORANT, in another game, or offline (socialActions groups by status). */
export type PresenceGroupId = "valorant" | "elsewhere" | "offline";

export interface PresenceGroup {
  id: PresenceGroupId;
  friends: FriendView[];
}

export function groupOfFriend(friend: FriendView): PresenceGroupId {
  if (friend.status === "offline") return "offline";
  return isElsewhere(friend) ? "elsewhere" : "valorant";
}

/** The friends list in its three groups, empty groups left out; offline only when asked for. */
export function friendGroups(showOffline: boolean): PresenceGroup[] {
  const ids: PresenceGroupId[] = showOffline ? ["valorant", "elsewhere", "offline"] : ["valorant", "elsewhere"];
  return ids
    .map((id) => ({ id, friends: friends().filter((friend) => groupOfFriend(friend) === id) }))
    .filter((group) => group.friends.length > 0);
}

/** What an empty list says: nobody online, or no friends at all. */
export function emptyFriendsText(): string {
  return friends().length ? "No friends online" : "No friends yet";
}

export interface FriendActions {
  isInParty: () => boolean;
  canInvite: () => boolean;
  isSent: () => boolean;
  invite: () => Promise<void>;
  canMessage: () => boolean;
  message: () => void;
}

/** One friend's invite and whisper, by the shared rules in socialActions.ts. */
export function useFriendActions(friend: () => FriendView): FriendActions {
  const invite = useInvite(friend);
  return {
    isInParty: () => isInParty(friend().puuid),
    canInvite: () => canInvite(friend()),
    isSent: invite.isSent,
    invite: invite.send,
    canMessage: canWhisper,
    message: () => whisper(friend()),
  };
}
