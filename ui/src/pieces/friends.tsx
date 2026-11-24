// Friends: who is online and what they are doing, with one-click party invites and a button
// that opens a whisper in the chat dock, plus pending friend requests (friendRequests.tsx).
// Used as a Studio piece and inside the friends drawer.
import { For, Show, createMemo, createSignal } from "solid-js";
import { MessageSquare, Search, UserPlus, X } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { openDirectChat } from "~/state/chat";
import { friendActivity, friends, isDrawerOpen, onlineCount, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { isConnected } from "~/state/session";
import { Empty } from "~/ui/controls";
import { AddFriend, FriendRequests } from "./friendRequests";
import styles from "./friends.module.css";

function lastSeen(ms: number | null): string {
  if (ms === null) return "";
  const hours = Math.floor((Date.now() - ms) / 3_600_000);
  if (hours < 1) return "Recently";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FriendRow(props: { friend: FriendView }) {
  const [isSent, setSent] = createSignal(false);
  const isInParty = () => party()?.members.some((member) => member.puuid === props.friend.puuid) ?? false;
  const canInvite = () =>
    isConnected() &&
    !isInParty() &&
    (props.friend.status === "menus" || props.friend.status === "queueing") &&
    (party()?.members.length ?? 0) < (party()?.max_size ?? 5);
  const invite = async () => {
    if (await partyActions.invite(`${props.friend.game_name}#${props.friend.tag_line}`)) setSent(true);
  };
  const message = () => {
    playCue("confirm");
    // The drawer's scrim would cover the dock.
    setDrawerOpen(false);
    openDirectChat(props.friend.puuid);
  };
  return (
    <li class={styles.friend} data-status={props.friend.status} onMouseEnter={() => playCue("hover")}>
      <span class={styles.dot} />
      {/* Only the Faces and Rich layouts show it; the list reads as names first. */}
      <span
        class={styles.avatar}
        style={{ "--face": props.friend.card_small ? `url("${props.friend.card_small}")` : "none" }}
        aria-hidden="true"
      />
      <span class={styles.text}>
        <span class={styles.name} data-sensitive>
          {props.friend.game_name}
          <span class={styles.tag}>#{props.friend.tag_line}</span>
        </span>
        <span class={styles.detail}>
          {/* The same line every style's friends look shows: what they do, then the party. */}
          {isInParty() ? "In your party" : friendActivity(props.friend)}
          <Show when={props.friend.status === "offline" && props.friend.last_online_ms}>
            <> · {lastSeen(props.friend.last_online_ms)}</>
          </Show>
        </span>
      </span>
      <button class={styles.message} title="Message" aria-label={`Message ${props.friend.game_name}`} disabled={!isConnected()} onClick={message}>
        <MessageSquare size={14} />
      </button>
      <Show when={canInvite()}>
        <button class={styles.invite} disabled={isSent()} title="Invite to party" onClick={() => void invite()}>
          <UserPlus size={14} />
          {isSent() ? "Sent" : "Invite"}
        </button>
      </Show>
    </li>
  );
}

function FriendsList(props: { showOffline: boolean }) {
  const [query, setQuery] = createSignal("");
  const shown = createMemo(() => {
    const text = query().trim().toLowerCase();
    return friends().filter(
      (friend) =>
        (props.showOffline || friend.status !== "offline") &&
        (!text || `${friend.game_name}#${friend.tag_line}`.toLowerCase().includes(text)),
    );
  });
  return (
    <div class={styles.list}>
      <label class={styles.search}>
        <Search size={14} />
        <input placeholder="Search friends" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} spellcheck={false} />
      </label>
      <Show
        when={shown().length > 0}
        fallback={<Empty title={friends().length === 0 ? "No friends yet" : "Nobody matches"}>{isConnected() ? "" : "Connect to VALORANT to see your friends."}</Empty>}
      >
        <ol class={styles.rows}>
          <For each={shown()}>{(friend) => <FriendRow friend={friend} />}</For>
        </ol>
      </Show>
    </div>
  );
}

export function FriendsPiece(props: PieceProps) {
  return (
    <section class={styles.piece}>
      <header class={styles.header}>
        <h2 class={styles.title}>Friends</h2>
        <span class={styles.count}>{onlineCount()} online</span>
      </header>
      <FriendRequests />
      <FriendsList showOffline={props.piece.props["showOffline"] === true} />
    </section>
  );
}

function InviteById() {
  const [riotId, setRiotId] = createSignal("");
  return (
    <form
      class={styles.byId}
      onSubmit={(event) => {
        event.preventDefault();
        void partyActions.invite(riotId()).then((isSent) => isSent && setRiotId(""));
      }}
    >
      <input
        placeholder="Invite by Riot ID (Name#TAG)"
        aria-label="Invite by Riot ID"
        value={riotId()}
        spellcheck={false}
        data-sensitive
        onInput={(event) => setRiotId(event.currentTarget.value)}
      />
      <button type="submit" disabled={!riotId().includes("#") || !isConnected()} title="Send invite">
        <UserPlus size={14} />
      </button>
    </form>
  );
}

export function FriendsDrawer() {
  return (
    <Show when={isDrawerOpen()}>
      <div class={styles.scrim} onPointerDown={() => setDrawerOpen(false)} />
      <aside class={styles.drawer} aria-label="Friends">
        <header class={styles.header}>
          <h2 class={styles.title}>Friends</h2>
          <span class={styles.count}>{onlineCount()} online</span>
          <button
            class={styles.close}
            aria-label="Close"
            onClick={() => {
              playCue("back");
              setDrawerOpen(false);
            }}
          >
            <X size={16} />
          </button>
        </header>
        <InviteById />
        <AddFriend />
        <FriendRequests />
        <FriendsList showOffline />
      </aside>
    </Show>
  );
}
