// Night City social screens, after Cyberpunk 2077's phone and crew HUD: Friends as the CONTACTS
// list (a hex code, a portrait in a red and cyan split frame, the handle in red caps, what they
// are doing in cyan, MSG and LINK for whisper and invite), Party as chamfered crew shards.
import { For, Index, Show } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { friendActivity, onlineCount } from "~/state/friends";
import { partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import { artUrl } from "../home";
import {
  type FriendGroupId,
  canInvite,
  canKick,
  canWhisper,
  isInParty,
  isOfflineShown,
  openInvites,
  useFriendGroups,
  useInvite,
  usePartySlots,
  whisper,
} from "./socialActions";
import styles from "./nightcitySocial.module.css";

const GROUP_WORDS: Record<FriendGroupId, string> = {
  available: "Online",
  playing: "On a gig",
  away: "Off-grid",
  offline: "No signal",
};

const hex = (index: number) => `0x${(index + 1).toString(16).toUpperCase().padStart(2, "0")}`;

function Portrait(props: { src: string | null; name: string }) {
  return (
    <span class={styles.portrait}>
      <Art src={props.src} fallback={<b>{props.name.slice(0, 1)}</b>} />
    </span>
  );
}

// ---- contacts ---------------------------------------------------------------------------

function Contact(props: { friend: FriendView; index: number }) {
  const invite = useInvite(() => props.friend);
  return (
    <li class={styles.contact} data-status={props.friend.status} style={{ "--i": Math.min(props.index, 12) }}>
      <span class={styles.code}>{hex(props.index)}</span>
      <Portrait src={props.friend.card_small} name={props.friend.game_name} />
      <span class={styles.contactText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{isInParty(props.friend.puuid) ? "Linked // your crew" : friendActivity(props.friend)}</small>
      </span>
      <span class={styles.contactActions}>
        <button
          class={styles.chip}
          disabled={!canWhisper()}
          onMouseEnter={() => playCue("hover")}
          onClick={() => whisper(props.friend)}
        >
          Msg
        </button>
        <Show when={canInvite(props.friend)}>
          <button class={styles.chip} data-hot="" disabled={invite.isSent()} onClick={() => void invite.send()}>
            {invite.isSent() ? "Sent" : "Link"}
          </button>
        </Show>
      </span>
    </li>
  );
}

export function NcFriends(props: PieceProps) {
  const groups = useFriendGroups(() => isOfflineShown(props), GROUP_WORDS);
  return (
    <section class={styles.panel}>
      <header class={styles.head}>
        <span class={styles.code}>NET//CONTACTS</span>
        <h2 class={styles.title}>Contacts</h2>
        <span class={styles.count}>
          <b class="num">{onlineCount()}</b> online
        </span>
      </header>
      <div class={styles.groups}>
        <For each={groups()} fallback={<p class={styles.empty}>No signal // nobody online</p>}>
          {(group) => (
            <section class={styles.group}>
              <h3 class={styles.groupHead}>
                {group.label} <b class="num">{group.friends.length}</b>
              </h3>
              <ol class={styles.rows}>
                <For each={group.friends}>{(friend, index) => <Contact friend={friend} index={index()} />}</For>
              </ol>
            </section>
          )}
        </For>
      </div>
    </section>
  );
}

// ---- crew -------------------------------------------------------------------------------

function Shard(props: { member: MemberView }) {
  return (
    <article class={styles.shard} data-self={props.member.is_self ? "" : undefined}>
      <span class={styles.shardArt} style={{ "--art": artUrl(props.member.card_tall) }} />
      <span class={styles.shardSmall}>
        <Portrait src={props.member.card_small} name={props.member.game_name} />
      </span>
      <footer class={styles.shardText}>
        <span class={styles.code}>{props.member.is_owner ? "FIXER" : "MERC"}</span>
        <b data-sensitive>{props.member.game_name}</b>
        <span class={styles.shardMeta}>
          <Show when={props.member.rank.icon}>{(icon) => <img src={icon()} alt="" draggable={false} />}</Show>
          LV <b class="num">{props.member.account_level ?? "--"}</b>
        </span>
        <span class={styles.ready} data-ready={props.member.is_ready ? "" : undefined}>
          {props.member.is_ready ? "Ready" : "Idle"}
        </span>
      </footer>
      <Show when={canKick(props.member)}>
        <button
          class={styles.kick}
          title="Remove from party"
          onClick={() => void partyActions.kick(props.member.puuid)}
        >
          ✕
        </button>
      </Show>
    </article>
  );
}

export function NcParty(_props: PieceProps) {
  const slots = usePartySlots();
  return (
    <div class={styles.crew}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} style={{ "--i": index }}>
            <Show
              when={member()}
              fallback={
                <button class={styles.open} onMouseEnter={() => playCue("hover")} onClick={openInvites}>
                  <span class={styles.code}>{hex(index)}</span>
                  Slot open // invite
                </button>
              }
            >
              {(current) => <Shard member={current()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}
