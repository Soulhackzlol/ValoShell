// Fortnite's friends look, after the Battle Royale social panel: a see-through navy panel with
// the online count in a yellow pill, friends in Online / Other games / Offline sections, each a
// rounded tile with their picture, a heavy caps name and a coloured status, a yellow Invite and
// a round blue message button.
import { For, Show } from "solid-js";
import { MessageSquare, UserPlus } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import { playCue } from "~/menu/sound";
import { friendActivity, onlineCount } from "~/state/friends";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type PresenceGroupId, emptyFriendsText, friendGroups, isOfflineShown, useFriendActions } from "./friendLook";
import styles from "./fortniteFriends.module.css";

const SECTION_LABELS: Record<PresenceGroupId, string> = {
  valorant: "Online",
  elsewhere: "Other games",
  offline: "Offline",
};

function FriendTile(props: { friend: FriendView }) {
  const actions = useFriendActions(() => props.friend);
  return (
    <li class={styles.tile} data-status={props.friend.status} onMouseEnter={() => playCue("hover")}>
      <Art
        src={props.friend.card_small}
        class={styles.picture}
        fallback={<span class={styles.picture} data-sensitive>{props.friend.game_name.slice(0, 1)}</span>}
      />
      <span class={styles.text}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{actions.isInParty() ? "In your party" : friendActivity(props.friend)}</small>
      </span>
      <Show when={actions.canInvite()}>
        <button class={styles.invite} disabled={actions.isSent()} onClick={() => void actions.invite()}>
          <UserPlus size={14} />
          {actions.isSent() ? "Sent" : "Invite"}
        </button>
      </Show>
      <Show when={actions.canMessage()}>
        <button
          class={styles.message}
          title="Message"
          aria-label={`Message ${props.friend.game_name}`}
          onClick={actions.message}
        >
          <MessageSquare size={14} />
        </button>
      </Show>
    </li>
  );
}

export function FnFriends(props: PieceProps) {
  const groups = () => friendGroups(isOfflineShown(props));
  return (
    <section class={styles.panel}>
      <header class={styles.head}>
        <span class={styles.title}>Friends</span>
        <span class={`${styles.count} num`}>{onlineCount()} online</span>
      </header>
      <div class={styles.list}>
        <For each={groups()} fallback={<p class={styles.empty}>{emptyFriendsText()}</p>}>
          {(group) => (
            <section class={styles.section}>
              <h3 class={styles.sectionHead}>
                {SECTION_LABELS[group.id]}
                <span class="num">{group.friends.length}</span>
              </h3>
              <ol class={styles.tiles}>
                <For each={group.friends}>{(friend) => <FriendTile friend={friend} />}</For>
              </ol>
            </section>
          )}
        </For>
      </div>
    </section>
  );
}
