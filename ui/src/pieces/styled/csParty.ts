// The party as fixed slots for the three Counter-Strike party looks: you first, then the others
// in Riot's order, then empty slots up to the party size, so rows never jump around.
import type { MemberView } from "~/bindings/MemberView";
import { partySlots as slotsOf, rankText as rankBadgeText } from "./socialActions";

export { canKick, openInvites } from "./socialActions";

export function partySlots(): (MemberView | null)[] {
  return slotsOf({ selfFirst: true });
}

export function rankText(member: MemberView): string {
  return rankBadgeText(member.rank);
}
