// Pip-Boy social screens, after Fallout 4's DATA and RADIO tabs: Friends as a cursor list under
// group sub-tabs (the picked friend opened beside it, card drawn in green, INVITE and WHISPER as
// the screen's boxed actions), Party as the slot list with a ■ for each ready member.
import { For, Index, type JSX, Show, createMemo, createSignal } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { friendActivity, friends } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import {
  type FriendGroupId,
  canInvite,
  canKick,
  canWhisper,
  friendGroupOf,
  isInParty,
  isOfflineShown,
  openInvites,
  rankText,
  useFriendGroups,
  useInvite,
  usePartySlots,
  whisper,
} from "./socialActions";
import styles from "./pipboySocial.module.css";

const GROUP_WORDS: Record<FriendGroupId, string> = {
  available: "Online",
  playing: "In game",
  away: "Away",
  offline: "Offline",
};

function Row(props: { isPicked: boolean; mark: string; onPick: () => void; children: JSX.Element }) {
  return (
    <li>
      <button
        class={styles.row}
        data-picked={props.isPicked ? "" : undefined}
        onMouseEnter={() => playCue("hover")}
        onClick={() => props.onPick()}
      >
        <span class={styles.cursor}>{props.isPicked ? "▶" : ""}</span>
        <span class={styles.label}>{props.children}</span>
        <span class={styles.mark}>{props.mark}</span>
      </button>
    </li>
  );
}

function Fact(props: { term: string; children: JSX.Element }) {
  return (
    <div>
      <dt>{props.term}</dt>
      <dd>{props.children}</dd>
    </div>
  );
}

// ---- friends ----------------------------------------------------------------------------

function FriendDetail(props: { friend: FriendView }) {
  const invite = useInvite(() => props.friend);
  return (
    <div class={styles.detail}>
      <Art src={props.friend.card_small} class={styles.art} fallback={<span class={styles.art} />} />
      <h3 class={styles.name} data-sensitive>
        {props.friend.game_name}
        <small>#{props.friend.tag_line}</small>
      </h3>
      <dl class={styles.table}>
        <Fact term="Status">{isInParty(props.friend.puuid) ? "In your party" : friendActivity(props.friend)}</Fact>
        <Show when={props.friend.account_level !== null}>
          <Fact term="Level">{props.friend.account_level}</Fact>
        </Show>
      </dl>
      <div class={styles.actions}>
        <Show when={canInvite(props.friend)}>
          <button class={styles.action} disabled={invite.isSent()} onClick={() => void invite.send()}>
            {invite.isSent() ? "[ Sent ]" : "[ Invite ]"}
          </button>
        </Show>
        <button class={styles.action} disabled={!canWhisper()} onClick={() => whisper(props.friend)}>
          [ Whisper ]
        </button>
      </div>
    </div>
  );
}

export function PipFriends(props: PieceProps) {
  const groups = useFriendGroups(() => isOfflineShown(props), GROUP_WORDS);
  const [tab, setTab] = createSignal<FriendGroupId | "all">("all");
  const [pickedId, setPickedId] = createSignal<string | null>(null);
  const shown = createMemo(() =>
    groups().flatMap((group) => (tab() === "all" || group.id === tab() ? group.friends : [])),
  );
  const picked = () => shown().find((friend) => friend.puuid === pickedId()) ?? shown()[0];
  const pickTab = (next: FriendGroupId | "all") => {
    playCue("tab");
    setTab(next);
  };
  return (
    <section class={styles.screen}>
      <nav class={styles.subTabs}>
        <button data-on={tab() === "all" ? "" : undefined} onClick={() => pickTab("all")}>
          All {friends().length}
        </button>
        <For each={groups()}>
          {(group) => (
            <button data-on={tab() === group.id ? "" : undefined} onClick={() => pickTab(group.id)}>
              {group.label} {group.friends.length}
            </button>
          )}
        </For>
      </nav>
      <div class={styles.split}>
        <ol class={styles.list}>
          <For each={shown()} fallback={<li class={styles.empty}>No signal</li>}>
            {(friend) => (
              <Row
                isPicked={picked()?.puuid === friend.puuid}
                mark={GROUP_WORDS[friendGroupOf(friend)]}
                onPick={() => setPickedId(friend.puuid)}
              >
                <span data-sensitive>{friend.game_name}</span>
              </Row>
            )}
          </For>
        </ol>
        {/* Keyed so a newly picked friend starts with a fresh invite ("Sent" is per friend). */}
        <Show when={picked()} keyed>
          {(friend) => <FriendDetail friend={friend} />}
        </Show>
      </div>
    </section>
  );
}

// ---- party ------------------------------------------------------------------------------

function MemberDetail(props: { member: MemberView }) {
  return (
    <div class={styles.detail}>
      <Art src={props.member.card_tall} class={styles.art} fallback={<span class={styles.art} />} />
      <h3 class={styles.name} data-sensitive>
        {props.member.game_name}
      </h3>
      <dl class={styles.table}>
        <Fact term="Rank">{rankText(props.member.rank)}</Fact>
        <Fact term="Level">{props.member.account_level ?? "--"}</Fact>
        <Fact term="Ready">{props.member.is_ready ? "Yes" : "No"}</Fact>
        <Fact term="Leader">{props.member.is_owner ? "Yes" : "No"}</Fact>
      </dl>
      <Show when={canKick(props.member)}>
        <div class={styles.actions}>
          <button class={styles.action} onClick={() => void partyActions.kick(props.member.puuid)}>
            [ Remove ]
          </button>
        </div>
      </Show>
    </div>
  );
}

export function PipParty(_props: PieceProps) {
  const slots = usePartySlots();
  const [pickedIndex, setPickedIndex] = createSignal(0);
  const picked = () => slots()[pickedIndex()] ?? null;
  return (
    <section class={styles.screen}>
      <nav class={styles.subTabs}>
        <span data-on="">
          Party {party()?.members.length ?? 0}/{slots().length}
        </span>
      </nav>
      <div class={styles.split}>
        <ol class={styles.list}>
          {/* Index: a party update refreshes a row in place, so a focused row keeps focus. */}
          <Index each={slots()}>
            {(member, index) => (
              <Row
                isPicked={pickedIndex() === index}
                mark={member() ? (member()?.is_ready ? "■" : "□") : ""}
                onPick={() => setPickedIndex(index)}
              >
                <Show when={member()} fallback="- Empty slot -">
                  {(current) => <span data-sensitive>{current().game_name}</span>}
                </Show>
              </Row>
            )}
          </Index>
        </ol>
        <Show
          when={picked()}
          fallback={
            <div class={styles.detail}>
              <p class={styles.empty}>Slot open</p>
              <div class={styles.actions}>
                <button class={styles.action} onClick={openInvites}>
                  [ Invite ]
                </button>
              </div>
            </div>
          }
        >
          {(member) => <MemberDetail member={member()} />}
        </Show>
      </div>
    </section>
  );
}
