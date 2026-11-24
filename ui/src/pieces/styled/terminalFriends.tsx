// Terminal's friends look: the list as `friends --list` prints it, one padded line per friend
// (Riot ID, status, what they are doing), grouped like `ls` sections, with [invite] and [msg]
// on the line itself. `--all` adds the offline friends; a caret waits after the last prompt.
import { For, Show, createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import { playCue } from "~/menu/sound";
import { friendActivity, friends } from "~/state/friends";
import type { PieceProps } from "~/studio/registry";
import { type PresenceGroupId, emptyFriendsText, friendGroups, groupOfFriend, isOfflineShown, useFriendActions } from "./friendLook";
import { Prompt, pad } from "./terminalScreens";
import styles from "./terminalScreens.module.css";
import own from "./terminalFriends.module.css";

const NAME_COLUMN = 22;
const STATUS_COLUMN = 14;

/** Section headers as a shell prints a heading: a comment line. */
const GROUP_HEADINGS: Record<PresenceGroupId, string> = {
  valorant: "# in valorant",
  elsewhere: "# other games",
  offline: "# offline",
};

function FriendLine(props: { friend: FriendView }) {
  const actions = useFriendActions(() => props.friend);
  const status = () => (actions.isInParty() ? "in-party" : props.friend.status.replace("_", "-"));
  return (
    <div class={`${styles.line} ${own.friend}`} data-status={props.friend.status} onMouseEnter={() => playCue("hover")}>
      <span data-sensitive>{pad(`${props.friend.game_name}#${props.friend.tag_line}`, NAME_COLUMN)}</span>
      <span>{pad(status(), STATUS_COLUMN)}</span>
      <span class={own.activity}>{friendActivity(props.friend).toLowerCase()}</span>
      <Show when={actions.canInvite()}>
        <button class={own.act} disabled={actions.isSent()} onClick={() => void actions.invite()}>
          {actions.isSent() ? "[sent]" : "[invite]"}
        </button>
      </Show>
      <Show when={actions.canMessage()}>
        <button class={own.act} title="Whisper" onClick={actions.message}>
          [msg]
        </button>
      </Show>
    </div>
  );
}

/** `3 in valorant · 1 elsewhere · 4 offline`, counted over every friend, shown or not. */
function summary(): string {
  const count = (id: PresenceGroupId) => friends().filter((friend) => groupOfFriend(friend) === id).length;
  return `${count("valorant")} in valorant · ${count("elsewhere")} elsewhere · ${count("offline")} offline`;
}

export function TerminalFriends(props: PieceProps) {
  // Clicking the flag overrides the Inspector's "Show offline" until the screen is left.
  const [typedAll, setAll] = createSignal<boolean | null>(null);
  const isAll = () => typedAll() ?? isOfflineShown(props);
  const groups = () => friendGroups(isAll());
  return (
    <div class={styles.console} data-single="">
      <section class={styles.pane}>
        <Prompt command={`friends --list${isAll() ? " --all" : ""}`} />
        <button class={styles.flag} data-on={isAll() ? "" : undefined} onClick={() => setAll(!isAll())}>
          --all
        </button>
        <div class={styles.dim}>{`${pad("riot-id", NAME_COLUMN)}${pad("status", STATUS_COLUMN)}activity`}</div>
        <For each={groups()} fallback={<p class={styles.out}>{`friends: ${emptyFriendsText().toLowerCase()}`}</p>}>
          {(group) => (
            <div class={styles.table}>
              <div class={styles.dim}>{GROUP_HEADINGS[group.id]}</div>
              <For each={group.friends}>{(friend) => <FriendLine friend={friend} />}</For>
            </div>
          )}
        </For>
        <div class={styles.dim}>{summary()}</div>
        <Prompt command="" isLast />
      </section>
    </div>
  );
}
