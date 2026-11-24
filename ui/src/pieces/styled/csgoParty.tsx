// CS:GO (Panorama) party: the lobby panel under a bevelled grey title bar. One row per slot
// with the avatar framed in that slot's teammate colour (yellow, purple, green, blue, orange as
// in competitive), rank and a ready tick; open slots invite. The "bar" layout is Panorama's
// party bar: the framed avatars in one row.
import { Index, Show, createMemo, createSignal } from "solid-js";
import { Crown, Search, X } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { party, partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import { Silhouette } from "./avatars";
import { canKick, openInvites, partySlots, rankText } from "./csParty";
import csgo from "./csgo.module.css";
import styles from "./csgoParty.module.css";

/** CS:GO's competitive teammate colours, by slot. */
const SLOT_COLORS = ["#e6dc3d", "#9b55c9", "#2fb36d", "#4fa3e0", "#ef8b2e"];

export function CsgoParty(_props: PieceProps) {
  const slots = createMemo(partySlots);
  const count = () => party()?.members.length ?? 0;
  return (
    <section class={styles.lobby}>
      <header class={csgo.titleBar}>
        <span>Lobby</span>
        <span class={csgo.titleMode}>
          {party()?.queue.label ?? "Offline"} · <span class="num">{count()}/{slots().length}</span>
        </span>
      </header>
      <div class={styles.slots}>
        <Index each={slots()}>
          {(member, index) => (
            <Show when={member()} fallback={<EmptySlot color={SLOT_COLORS[index % SLOT_COLORS.length]} />}>
              {(current) => <MemberSlot member={current()} color={SLOT_COLORS[index % SLOT_COLORS.length]} />}
            </Show>
          )}
        </Index>
      </div>
      <InviteBox />
    </section>
  );
}

function MemberSlot(props: { member: MemberView; color: string | undefined }) {
  return (
    <div class={styles.slot} data-part="slot" data-self={props.member.is_self ? "" : undefined} style={{ "--slot": props.color }}>
      <span class={styles.avatar}>
        <Art src={props.member.card_small ?? props.member.card_tall} class={styles.image} fallback={<Silhouette />} />
      </span>
      <span class={styles.text}>
        <b data-sensitive>{props.member.game_name || "Player"}</b>
        <small>
          {rankText(props.member)}
          <Show when={props.member.account_level !== null}> · Lv {props.member.account_level}</Show>
        </small>
      </span>
      <Show when={props.member.is_owner}>
        <span class={styles.leader} title="Party leader">
          <Crown size={13} />
        </span>
      </Show>
      <span class={styles.ready} data-ready={props.member.is_ready ? "" : undefined}>
        {props.member.is_ready ? "Ready" : "Not ready"}
      </span>
      <Show when={canKick(props.member)}>
        <button class={styles.kick} data-part="kick" title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={13} />
        </button>
      </Show>
    </div>
  );
}

function EmptySlot(props: { color: string | undefined }) {
  return (
    <button class={styles.slot} data-part="invite-slot" data-empty="" style={{ "--slot": props.color }} onClick={openInvites}>
      <span class={styles.avatar}>+</span>
      <span class={styles.text}>
        <b>Invite a friend</b>
      </span>
    </button>
  );
}

/** Panorama's "invite by friend code" box, here a Riot ID. */
function InviteBox() {
  const [riotId, setRiotId] = createSignal("");
  return (
    <form
      class={`${csgo.socialSearch} ${styles.invite}`}
      onSubmit={(event) => {
        event.preventDefault();
        const id = riotId().trim();
        if (!id.includes("#")) return;
        playCue("confirm");
        void partyActions.invite(id);
        setRiotId("");
      }}
    >
      <Search size={15} />
      <input value={riotId()} placeholder="Invite Name#TAG…" onInput={(event) => setRiotId(event.currentTarget.value)} />
    </form>
  );
}
