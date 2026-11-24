// Friends and party rules for every style's own Friends and Party looks (friendLook.ts and
// csParty.ts build on these). The rules are the standard friends piece's (pieces/friends.tsx): the same people can
// be invited, whispers go only to friends through the chat dock, so no look can do more.
import { createMemo, createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { RankBadge } from "~/bindings/RankBadge";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { openDirectChat } from "~/state/chat";
import { friends, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { isConnected } from "~/state/session";

/** Friends grouped the way game social lists sort them: free first, offline last. */
export type FriendGroupId = "available" | "playing" | "away" | "offline";

export interface FriendGroup {
  id: FriendGroupId;
  label: string;
  friends: FriendView[];
}

const GROUP_ORDER: readonly FriendGroupId[] = ["available", "playing", "away", "offline"];
const DEFAULT_PARTY_SIZE = 5;

export function friendGroupOf(friend: FriendView): FriendGroupId {
  if (friend.status === "offline") return "offline";
  if (friend.status === "menus") return "available";
  if (friend.status === "online" || friend.status === "away") return "away";
  return "playing";
}

/** Whether a piece's "Show offline" toggle is on. */
export function isOfflineShown(props: Pick<PieceProps, "piece">): boolean {
  return props.piece.props["showOffline"] === true;
}

/** The friends in their groups, each style naming the groups in its own words; empty ones go. */
export function useFriendGroups(
  showOffline: () => boolean,
  labels: Record<FriendGroupId, string>,
): () => FriendGroup[] {
  return createMemo(() => {
    const shown = friends().filter((friend) => showOffline() || friend.status !== "offline");
    const inGroup = (id: FriendGroupId) => shown.filter((friend) => friendGroupOf(friend) === id);
    const grouped = GROUP_ORDER.map((id) => ({ id, label: labels[id], friends: inGroup(id) }));
    return grouped.filter((group) => group.friends.length > 0);
  });
}

export function isInParty(puuid: string): boolean {
  return party()?.members.some((member) => member.puuid === puuid) ?? false;
}

export function canInvite(friend: FriendView): boolean {
  const members = party()?.members.length ?? 0;
  const isFree = friend.status === "menus" || friend.status === "queueing";
  return isConnected() && isFree && !isInParty(friend.puuid) && members < (party()?.max_size ?? DEFAULT_PARTY_SIZE);
}

/** Invite once per row: `isSent` stays true so the button can say so. */
export function useInvite(friend: () => FriendView): { isSent: () => boolean; send: () => Promise<void> } {
  const [isSent, setSent] = createSignal(false);
  const send = async () => {
    playCue("confirm");
    if (await partyActions.invite(`${friend().game_name}#${friend().tag_line}`)) setSent(true);
  };
  return { isSent, send };
}

/** Whispers go through the chat dock, which needs the Riot client connection. */
export function canWhisper(): boolean {
  return isConnected();
}

export function whisper(friend: FriendView): void {
  if (!canWhisper()) return;
  playCue("confirm");
  // The friends drawer's scrim would cover the chat dock.
  setDrawerOpen(false);
  openDirectChat(friend.puuid);
}

/** Only the party owner removes players, and never themselves. */
export function canKick(member: MemberView): boolean {
  return (party()?.is_owner ?? false) && !member.is_self;
}

/**
 * Every party slot, `null` for the open ones: the client's order, or you first when `selfFirst`
 * (the Counter-Strike lobbies always put you in the first slot).
 */
export function partySlots(options: { selfFirst: boolean }): (MemberView | null)[] {
  const members = party()?.members ?? [];
  const ordered = options.selfFirst
    ? [...members.filter((member) => member.is_self), ...members.filter((member) => !member.is_self)]
    : members;
  const size = Math.max(party()?.max_size ?? DEFAULT_PARTY_SIZE, ordered.length);
  return Array.from({ length: size }, (_, index) => ordered[index] ?? null);
}

/** Every party slot in the client's order, `null` for the open ones. */
export function usePartySlots(): () => (MemberView | null)[] {
  return createMemo(() => partySlots({ selfFirst: false }));
}

/** Below Iron 1 (tier 3) Riot sends no real rank, only "Unranked" placeholders. */
const FIRST_RANKED_TIER = 3;

export function rankText(rank: RankBadge): string {
  return rank.tier >= FIRST_RANKED_TIER ? rank.name : "Unranked";
}

export function openInvites(): void {
  playCue("confirm");
  setDrawerOpen(true);
}
