// Phantom social screens, after Persona 5: Friends as the Confidants list (black strips leaning
// by hand, each portrait in a jagged white frame, the activity on a red tag; the pointed strip
// turns white over a red slash), Party as the battle HUD's tilted portraits along the bottom.
import { For, Index, Show } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { friendActivity } from "~/state/friends";
import { partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import { artUrl } from "../home";
import { RansomText } from "./phantom";
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
import styles from "./phantomSocial.module.css";

const GROUP_WORDS: Record<FriendGroupId, string> = {
  available: "Free",
  playing: "On a heist",
  away: "Away",
  offline: "Offline",
};

function Face(props: { src: string | null; name: string }) {
  return (
    <span class={styles.face}>
      <Art src={props.src} fallback={<b>{props.name.slice(0, 1)}</b>} />
    </span>
  );
}

// ---- confidants -------------------------------------------------------------------------

function Confidant(props: { friend: FriendView; index: number }) {
  const invite = useInvite(() => props.friend);
  return (
    <li class={styles.strip} data-status={props.friend.status} style={{ "--i": Math.min(props.index, 12) }}>
      <Face src={props.friend.card_small} name={props.friend.game_name} />
      <span class={styles.stripText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{isInParty(props.friend.puuid) ? "In your crew" : friendActivity(props.friend)}</small>
      </span>
      <span class={styles.actions}>
        <button
          class={styles.tag}
          disabled={!canWhisper()}
          onMouseEnter={() => playCue("hover")}
          onClick={() => whisper(props.friend)}
        >
          Call
        </button>
        <Show when={canInvite(props.friend)}>
          <button class={styles.tag} data-hot="" disabled={invite.isSent()} onClick={() => void invite.send()}>
            {invite.isSent() ? "Sent" : "Recruit"}
          </button>
        </Show>
      </span>
    </li>
  );
}

export function PhFriends(props: PieceProps) {
  const groups = useFriendGroups(() => isOfflineShown(props), GROUP_WORDS);
  return (
    <section class={styles.confidants}>
      <header class={styles.head}>
        <RansomText text="CONFIDANTS" class={styles.title} />
      </header>
      <div class={styles.groups}>
        <For each={groups()} fallback={<p class={styles.empty}>Nobody's around</p>}>
          {(group) => (
            <section>
              <h3 class={styles.groupHead}>
                {group.label} <b class="num">{group.friends.length}</b>
              </h3>
              <ol class={styles.strips}>
                <For each={group.friends}>{(friend, index) => <Confidant friend={friend} index={index()} />}</For>
              </ol>
            </section>
          )}
        </For>
      </div>
    </section>
  );
}

// ---- party HUD --------------------------------------------------------------------------

function Portrait(props: { member: MemberView }) {
  return (
    <article class={styles.portrait} data-self={props.member.is_self ? "" : undefined}>
      <span class={styles.portraitArt} style={{ "--art": artUrl(props.member.card_small) }} />
      <Show when={props.member.is_owner}>
        <span class={styles.leader}>Leader</span>
      </Show>
      <footer class={styles.plate}>
        <b data-sensitive>{props.member.game_name}</b>
        <span class={styles.stamp} data-ready={props.member.is_ready ? "" : undefined}>
          {props.member.is_ready ? "Ready" : "Not ready"}
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

export function PhParty(_props: PieceProps) {
  const slots = usePartySlots();
  return (
    <div class={styles.hud}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} style={{ "--i": index }}>
            <Show
              when={member()}
              fallback={
                <button class={styles.recruit} onMouseEnter={() => playCue("hover")} onClick={openInvites}>
                  + Recruit
                </button>
              }
            >
              {(current) => <Portrait member={current()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}
