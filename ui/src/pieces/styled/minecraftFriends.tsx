// Minecraft's friends look, after the Java edition's Play Multiplayer screen: each friend an entry
// in the server list (their head as the server icon, the name, what they are doing as the grey
// MOTD, party size and signal bars on the right). A click selects, and the stone buttons below
// act on the selected friend.
import { For, Show, createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import { playCue } from "~/menu/sound";
import { friendActivity } from "~/state/friends";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { emptyFriendsText, friendGroups, groupOfFriend, isOfflineShown, useFriendActions } from "./friendLook";
import { McButton, SteveHead } from "./minecraft";
import styles from "./minecraft.module.css";
import own from "./minecraftFriends.module.css";

const SIGNAL_BARS = 5;

/** The signal bars stand for how reachable a friend is: full in the menus, fewer while busy. */
function signalOf(friend: FriendView): number {
  if (friend.status === "menus") return 5;
  if (friend.status === "queueing") return 4;
  if (friend.status === "offline") return 0;
  return groupOfFriend(friend) === "valorant" ? 3 : 1;
}

function Signal(props: { friend: FriendView }) {
  const level = () => signalOf(props.friend);
  return (
    <span class={own.signal} data-level={level()} title={friendActivity(props.friend)} aria-hidden="true">
      <Show when={level() > 0} fallback={<span class={own.cross}>x</span>}>
        <For each={Array.from({ length: SIGNAL_BARS }, (_, index) => index)}>
          {(index) => <i data-on={index < level() ? "" : undefined} style={{ height: `${(index + 1) * 20}%` }} />}
        </For>
      </Show>
    </span>
  );
}

function ServerEntry(props: { friend: FriendView; isSelected: boolean; onSelect: () => void }) {
  const isInValorant = () => groupOfFriend(props.friend) === "valorant";
  return (
    <button
      class={styles.world}
      data-selected={props.isSelected ? "" : undefined}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.onSelect()}
    >
      <Art src={props.friend.card_small} class={own.head} fallback={<SteveHead class={own.head} />} />
      <span class={styles.worldText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{friendActivity(props.friend)}</small>
      </span>
      <span class={own.right}>
        <Show when={isInValorant()}>
          <span class={own.players}>{Math.max(1, props.friend.party_size)}/5</span>
        </Show>
        <Signal friend={props.friend} />
      </span>
    </button>
  );
}

/** Invite and message for the selected friend; keyed by friend, so "Sent" stays with them. */
function FriendButtons(props: { friend: FriendView }) {
  const actions = useFriendActions(() => props.friend);
  return (
    <>
      <McButton isPlay isDisabled={!actions.canInvite() || actions.isSent()} onClick={() => void actions.invite()}>
        {actions.isSent() ? "Invite Sent" : "Invite to Party"}
      </McButton>
      <McButton isDisabled={!actions.canMessage()} onClick={actions.message}>
        Send Message
      </McButton>
    </>
  );
}

/** The same buttons, greyed out, while no friend is selected. */
function IdleButtons() {
  const ignore = () => undefined;
  return (
    <>
      <McButton isPlay isDisabled onClick={ignore}>
        Invite to Party
      </McButton>
      <McButton isDisabled onClick={ignore}>
        Send Message
      </McButton>
    </>
  );
}

export function McFriends(props: PieceProps) {
  const [picked, setPicked] = createSignal("");
  const [shownOffline, setShownOffline] = createSignal<boolean | null>(null);
  const showOffline = () => shownOffline() ?? isOfflineShown(props);
  const shown = () => friendGroups(showOffline()).flatMap((group) => group.friends);
  const selected = () => shown().find((friend) => friend.puuid === picked());
  return (
    <section class={`${styles.worlds} ${own.screen}`}>
      <h2 class={styles.worldsTitle}>Friends</h2>
      <div class={styles.worldList}>
        <For each={shown()} fallback={<p class={styles.statEmpty}>{emptyFriendsText()}</p>}>
          {(friend) => (
            <ServerEntry
              friend={friend}
              isSelected={picked() === friend.puuid}
              onSelect={() => setPicked(friend.puuid)}
            />
          )}
        </For>
      </div>
      <div class={`${styles.worldButtons} ${own.buttons}`}>
        <Show when={selected()} keyed fallback={<IdleButtons />}>
          {(friend) => <FriendButtons friend={friend} />}
        </Show>
        <McButton onClick={() => setShownOffline(!showOffline())}>
          Offline: {showOffline() ? "Shown" : "Hidden"}
        </McButton>
      </div>
    </section>
  );
}
