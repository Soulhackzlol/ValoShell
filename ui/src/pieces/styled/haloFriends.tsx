// Halo 3's friends look, after the Xbox 360 lobby's friends list: banded rows (emblem, gamertag,
// what they are playing), the colour of the band telling online from in-game from away, and the
// lobby's description box under them for the highlighted friend with its options as bars.
import { For, Show, createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import { playCue } from "~/menu/sound";
import { friendActivity, friends } from "~/state/friends";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { emptyFriendsText, friendGroups, isOfflineShown, useFriendActions } from "./friendLook";
import styles from "./halo.module.css";
import own from "./haloFriends.module.css";

function FriendBand(props: { friend: FriendView; isActive: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        class={`${styles.row} ${own.band}`}
        data-status={props.friend.status}
        data-active={props.isActive ? "" : undefined}
        onMouseEnter={() => {
          if (!props.isActive) playCue("hover");
          props.onPick();
        }}
        onFocus={() => props.onPick()}
      >
        <span class={styles.emblem}>
          <Art
            src={props.friend.card_small}
            class={styles.emblemImage}
            fallback={<span data-sensitive>{props.friend.game_name.slice(0, 1)}</span>}
          />
        </span>
        <span class={own.text}>
          <span class={styles.gamertag} data-sensitive>
            {props.friend.game_name}
          </span>
          <small class={own.presence}>{friendActivity(props.friend)}</small>
        </span>
      </button>
    </li>
  );
}

/** The description box: who is highlighted and what can be done with them. */
function FriendOptions(props: { friend: FriendView }) {
  const actions = useFriendActions(() => props.friend);
  return (
    <div class={`${styles.description} ${own.options}`}>
      <span class={own.who} data-sensitive>
        {props.friend.game_name}
        <small>#{props.friend.tag_line}</small>
      </span>
      <button
        class={styles.option}
        disabled={!actions.canInvite() || actions.isSent()}
        onClick={() => void actions.invite()}
      >
        {actions.isInParty() ? "In your party" : actions.isSent() ? "Invite sent" : "Invite to party"}
      </button>
      <button class={styles.option} disabled={!actions.canMessage()} onClick={actions.message}>
        Send message
      </button>
    </div>
  );
}

export function HaloFriends(props: PieceProps) {
  const [picked, setPicked] = createSignal("");
  const shown = () => friendGroups(isOfflineShown(props)).flatMap((group) => group.friends);
  const highlighted = () => shown().find((friend) => friend.puuid === picked()) ?? shown()[0];
  const online = () => friends().filter((friend) => friend.status !== "offline").length;
  return (
    <section class={styles.roster}>
      <header class={styles.rosterHead}>
        <span>Friends</span>
        <span class="num">{online()} online</span>
      </header>
      <ol class={styles.rows}>
        <For each={shown()} fallback={<li class={styles.openRow}>{emptyFriendsText()}</li>}>
          {(friend) => (
            <FriendBand
              friend={friend}
              isActive={highlighted()?.puuid === friend.puuid}
              onPick={() => setPicked(friend.puuid)}
            />
          )}
        </For>
      </ol>
      <Show when={highlighted()} keyed>
        {(friend) => <FriendOptions friend={friend} />}
      </Show>
    </section>
  );
}
