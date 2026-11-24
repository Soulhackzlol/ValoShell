// League client social sidebar: friends in folders by status (each folder folds on its head),
// a round icon ringed in the status colour, the name in cream and the activity in that colour
// under it; whisper and invite show on the row the pointer is on, as the client's do.
import { For, Show, createSignal } from "solid-js";
import { ChevronDown, MessageSquare, UserPlus } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { friendActivity, onlineCount } from "~/state/friends";
import { Art } from "~/ui/Art";
import {
  type FriendGroupId,
  canInvite,
  canWhisper,
  friendGroupOf,
  isInParty,
  isOfflineShown,
  useFriendGroups,
  useInvite,
  whisper,
} from "./socialActions";
import styles from "./leagueSocial.module.css";

const GROUP_WORDS: Record<FriendGroupId, string> = {
  available: "Online",
  playing: "In game",
  away: "Away",
  offline: "Offline",
};

function FriendRow(props: { friend: FriendView }) {
  const invite = useInvite(() => props.friend);
  return (
    <li class={styles.row} data-group={friendGroupOf(props.friend)} onMouseEnter={() => playCue("hover")}>
      <span class={styles.icon}>
        <Art src={props.friend.card_small} fallback={<b data-sensitive>{props.friend.game_name.slice(0, 1)}</b>} />
      </span>
      <span class={styles.text}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{isInParty(props.friend.puuid) ? "In your party" : friendActivity(props.friend)}</small>
      </span>
      <span class={styles.actions}>
        <button class={styles.action} title="Whisper" disabled={!canWhisper()} onClick={() => whisper(props.friend)}>
          <MessageSquare size={13} />
        </button>
        <Show when={canInvite(props.friend)}>
          <button
            class={styles.action}
            title={invite.isSent() ? "Invite sent" : "Invite"}
            disabled={invite.isSent()}
            onClick={() => void invite.send()}
          >
            <UserPlus size={13} />
          </button>
        </Show>
      </span>
    </li>
  );
}

export function LolFriends(props: PieceProps) {
  const groups = useFriendGroups(() => isOfflineShown(props), GROUP_WORDS);
  const [folded, setFolded] = createSignal<ReadonlySet<FriendGroupId>>(new Set());
  const toggle = (id: FriendGroupId) => {
    playCue("tab");
    const next = new Set(folded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFolded(next);
  };
  return (
    <section class={styles.social}>
      <header class={styles.head}>
        <h2>Social</h2>
        <span>
          <b class="num">{onlineCount()}</b> online
        </span>
      </header>
      <div class={styles.folders}>
        <For each={groups()} fallback={<p class={styles.empty}>No friends online</p>}>
          {(group) => (
            <section class={styles.folder} data-folded={folded().has(group.id) ? "" : undefined}>
              <button class={styles.folderHead} onClick={() => toggle(group.id)}>
                <ChevronDown size={12} class={styles.chevron ?? ""} />
                {group.label} ({group.friends.length})
              </button>
              <Show when={!folded().has(group.id)}>
                <ol class={styles.rows}>
                  <For each={group.friends}>{(friend) => <FriendRow friend={friend} />}</For>
                </ol>
              </Show>
            </section>
          )}
        </For>
      </div>
    </section>
  );
}
