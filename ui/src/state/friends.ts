// Friends with live status, kept current by the backend.
import { createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { preloadArt } from "~/ui/Art";
import { partyLabel } from "~/ui/stacks";

const [friends, setFriendList] = createSignal<FriendView[]>([]);
const setFriends = (next: FriendView[]) => {
  preloadArt(next.map((friend) => friend.card_small));
  setFriendList(next);
};
const [isDrawerOpen, setDrawerOpen] = createSignal(false);

onAppEvent("friends", setFriends);
void call("get_friends", {}).then(setFriends, (error) => console.warn("get_friends_failed", error));

export { friends, isDrawerOpen, setDrawerOpen };

/** Friends playing VALORANT right now (any state but away/offline/other game). */
export const onlineCount = () =>
  friends().filter((friend) => friend.status !== "offline" && friend.status !== "away" && friend.status !== "online").length;

/** Riot's other games, as their launcher names them. */
const PRODUCTS: Record<string, string> = {
  league_of_legends: "League of Legends",
  bacon: "Legends of Runeterra",
  tft: "Teamfight Tactics",
  lion: "2XKO",
  riot_client: "Riot Client",
};

/** A product id (`league_of_legends`) as people read it; unknown ids lose their underscores. */
export function productName(id: string): string {
  const known = PRODUCTS[id.toLowerCase()];
  if (known) return known;
  return id
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const STATUS_WORDS: Record<FriendView["status"], string> = {
  menus: "Available",
  queueing: "In queue",
  agent_select: "Agent select",
  in_match: "In a match",
  online: "Other game",
  away: "Away",
  offline: "Offline",
};

/** Online in another game or only the Riot Client, away there included: not in VALORANT. */
export function isElsewhere(friend: FriendView): boolean {
  if (friend.status === "online") return true;
  return friend.status === "away" && friend.product !== "" && friend.product !== "valorant";
}

/** One line on what a friend is doing: "In queue · Swiftplay · Duo", "League of Legends",
 *  "Lotus 9-6 · Trio". The party size rides along so every friends look shows the lobby. */
export function friendActivity(friend: FriendView): string {
  const party = partyLabel(friend.party_size);
  const activity = activityOf(friend);
  return party ? `${activity} · ${party}` : activity;
}

function activityOf(friend: FriendView): string {
  if (friend.status === "online") {
    const product = friend.product || friend.detail;
    return product && product !== "valorant" ? productName(product) : STATUS_WORDS.online;
  }
  if (isElsewhere(friend)) return `${STATUS_WORDS.away} · ${productName(friend.product)}`;
  if (friend.status === "in_match" && friend.detail) return friend.detail;
  if (friend.queue && friend.status !== "menus") return `${STATUS_WORDS[friend.status]} · ${friend.queue}`;
  return STATUS_WORDS[friend.status];
}
