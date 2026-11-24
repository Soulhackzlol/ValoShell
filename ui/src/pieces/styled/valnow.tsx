// VALORANT 2022 (Episode 4-5) home pieces: the party as five tall flat player cards with the
// player in the middle, the big PLAY word at the top with the mode under it, and the social
// panel with friends split into Online and Offline. Flat navy, red rules, tall condensed caps:
// no glass or gradients, so it reads as the older client next to the `val-*` pieces.
import { For, Index, Show, createMemo, createSignal } from "solid-js";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Star, UserPlus, X } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { artUrl, useLineupSlots } from "~/pieces/home";
import { friendActivity, friends } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { isConnected } from "~/state/session";
import { Art } from "~/ui/Art";
import { canInvite, canKick, isOfflineShown, openInvites, rankText, useInvite } from "./socialActions";
import { usePlay } from "./usePlay";
import styles from "./valnow.module.css";
import social from "./valnowSocial.module.css";

function textOf(props: PieceProps, key: string, fallback: string): string {
  const value = props.piece.props[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

// ---- party --------------------------------------------------------------------------------

export function V22Party(props: PieceProps) {
  const slots = useLineupSlots();
  const showRanks = () => props.piece.props["showRanks"] !== false;
  return (
    <div class={styles.party}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} data-centre={index === 2 ? "" : undefined} style={{ "--i": index }}>
            <Show when={member()} fallback={<InviteSlot isCentre={index === 2} />}>
              {(current) => <PlayerCard member={current()} showRanks={showRanks()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}

function PlayerCard(props: { member: MemberView; showRanks: boolean }) {
  const art = () => ({
    "--art": artUrl(props.member.card_tall),
    "--art-small": artUrl(props.member.card_small ?? props.member.card_tall),
  });
  return (
    <article class={styles.card} data-self={props.member.is_self ? "" : undefined} data-ready={props.member.is_ready ? "" : undefined}>
      <span class={styles.cardArt} style={art()} />
      <Show when={props.member.account_level !== null}>
        <span class={styles.level}>{props.member.account_level}</span>
      </Show>
      <Show when={props.member.is_owner}>
        <span class={styles.leader} title="Party leader">
          <Star size={12} />
        </span>
      </Show>
      <Show when={canKick(props.member)}>
        <button class={styles.kick} title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={12} />
        </button>
      </Show>
      <footer class={styles.plate}>
        <b class={styles.name} data-sensitive>
          {props.member.game_name || "Player"}
        </b>
        <small class={styles.title}>{props.member.title ?? ""}</small>
        <Show when={props.showRanks}>
          <span class={styles.rank}>
            <Art src={props.member.rank.icon} class={styles.rankIcon} fallback={<span />} />
            {rankText(props.member.rank)}
          </span>
        </Show>
      </footer>
      <span class={styles.ready}>{props.member.is_ready ? "Ready" : "Not ready"}</span>
    </article>
  );
}

/** An empty slot opens the friends drawer; the middle one only waits for the game. */
function InviteSlot(props: { isCentre: boolean }) {
  const label = () => {
    if (!props.isCentre) return "Invite";
    return isConnected() ? "Loading" : "Offline";
  };
  return (
    <button
      class={styles.invite}
      disabled={!isConnected() || props.isCentre}
      onMouseEnter={() => playCue("hover")}
      onClick={openInvites}
    >
      <span class={styles.inviteIcon}>
        <Plus size={20} />
      </span>
      <span class={styles.inviteLabel}>{label()}</span>
    </button>
  );
}

// ---- PLAY ---------------------------------------------------------------------------------

export function V22Play(props: PieceProps) {
  const play = usePlay();
  const isSearching = () => play.searchClock() !== null;
  const canPick = () => play.isOwner() && !isSearching() && play.queues().length > 1;
  const label = () => {
    if (isSearching()) return "Cancel";
    if (play.penaltyClock()) return `Wait ${play.penaltyClock()}`;
    if (!play.isOwner() && party()) return play.isReady() ? "Not ready" : "Ready";
    if (play.isCustom()) return "Start";
    return textOf(props, "label", "Play");
  };
  // The 2022 lobby flicked through modes with arrows beside the name, wrapping at the ends.
  const step = (delta: number) => {
    const list = play.queues();
    const at = Math.max(0, list.findIndex((queue) => queue.id === play.current()?.id));
    const next = list[(at + delta + list.length) % list.length];
    if (next) play.pickQueue(next);
  };
  return (
    <div class={styles.play}>
      <button
        class={styles.playButton}
        data-part="play"
        data-searching={isSearching() ? "" : undefined}
        disabled={!isSearching() && !play.canStart()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        {label()}
      </button>
      <div class={styles.mode}>
        <button class={styles.modeStep} title="Previous mode" disabled={!canPick()} onClick={() => step(-1)}>
          <ChevronLeft size={16} />
        </button>
        <span class={styles.modeName}>
          {isSearching() ? `Searching ${play.searchClock()}` : (play.current()?.label ?? "Offline")}
        </span>
        <button class={styles.modeStep} title="Next mode" disabled={!canPick()} onClick={() => step(1)}>
          <ChevronRight size={16} />
        </button>
      </div>
      <span class={styles.playMeta}>
        Party {play.partySize()}/{play.maxSize()}
      </span>
    </div>
  );
}

// ---- social -------------------------------------------------------------------------------

export function V22Friends(props: PieceProps) {
  const showOffline = () => isOfflineShown(props);
  const online = createMemo(() => friends().filter((friend) => friend.status !== "offline"));
  const offline = createMemo(() => friends().filter((friend) => friend.status === "offline"));
  return (
    <section class={social.social}>
      <header class={social.socialHead}>
        <h2>{textOf(props, "title", "Social")}</h2>
        <span>{online().length} online</span>
      </header>
      <div class={social.groups}>
        <FriendGroup label="Online" list={online()} isOpenAtFirst />
        <Show when={showOffline()}>
          <FriendGroup label="Offline" list={offline()} isOpenAtFirst={false} />
        </Show>
      </div>
    </section>
  );
}

function FriendGroup(props: { label: string; list: FriendView[]; isOpenAtFirst: boolean }) {
  const [isOpen, setOpen] = createSignal(props.isOpenAtFirst);
  const toggle = () => {
    playCue("tab");
    setOpen(!isOpen());
  };
  return (
    <section class={social.group} data-open={isOpen() ? "" : undefined}>
      <button class={social.groupHead} onClick={toggle}>
        <ChevronDown size={14} class={social.chevron ?? ""} />
        <span>{props.label}</span>
        <b>({props.list.length})</b>
      </button>
      <Show when={isOpen()}>
        <ol class={social.friendList}>
          <For each={props.list} fallback={<li class={social.empty}>Nobody here</li>}>
            {(friend, index) => <FriendRow friend={friend} index={index()} />}
          </For>
        </ol>
      </Show>
    </section>
  );
}

function FriendRow(props: { friend: FriendView; index: number }) {
  const invite = useInvite(() => props.friend);
  return (
    <li class={social.friend} data-status={props.friend.status} style={{ "--i": Math.min(props.index, 12) }}>
      <Art
        src={props.friend.card_small}
        class={social.friendArt}
        fallback={<span class={social.friendArt} data-sensitive>{props.friend.game_name.slice(0, 1).toUpperCase()}</span>}
      />
      <span class={social.friendText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small class={social.activity}>{friendActivity(props.friend)}</small>
      </span>
      <Show when={canInvite(props.friend)}>
        <button class={social.friendInvite} title="Invite to party" disabled={invite.isSent()} onClick={() => void invite.send()}>
          <Show when={invite.isSent()} fallback={<UserPlus size={14} />}>
            <Check size={14} />
          </Show>
        </button>
      </Show>
    </li>
  );
}
