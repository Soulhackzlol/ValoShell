// CS2 party, after the main menu's top-right party row: square avatar tiles with a status
// stripe (warm = not ready, green = ready) and a "+" tile per open slot. The "slots" layout is
// the lobby's five player slots: each tile grows a name plate with rank and level.
import { Index, Show, createMemo } from "solid-js";
import { Crown, Plus, X } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { party, partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import { Silhouette } from "./avatars";
import { canKick, openInvites, partySlots, rankText } from "./csParty";
import styles from "./cs2Party.module.css";

export function Cs2Party(_props: PieceProps) {
  const slots = createMemo(partySlots);
  const count = () => party()?.members.length ?? 0;
  return (
    <section class={styles.party}>
      <header class={styles.head}>
        <span class={styles.title}>Party</span>
        <span class={`${styles.count} num`}>
          {count()}/{slots().length}
        </span>
      </header>
      <div class={styles.slots}>
        <Index each={slots()}>
          {(member) => (
            <Show when={member()} fallback={<EmptySlot />}>
              {(current) => <MemberSlot member={current()} />}
            </Show>
          )}
        </Index>
      </div>
    </section>
  );
}

function MemberSlot(props: { member: MemberView }) {
  return (
    <article
      class={styles.slot}
      data-part="slot"
      data-self={props.member.is_self ? "" : undefined}
      data-ready={props.member.is_ready ? "" : undefined}
      onMouseEnter={() => playCue("hover")}
    >
      <span class={styles.face}>
        <Art src={props.member.card_small ?? props.member.card_tall} class={styles.image} fallback={<Silhouette />} />
      </span>
      <Show when={props.member.is_owner}>
        <span class={styles.owner} title="Party leader">
          <Crown size={11} />
        </span>
      </Show>
      <Show when={canKick(props.member)}>
        <button class={styles.kick} data-part="kick" title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={12} />
        </button>
      </Show>
      <span class={styles.plate}>
        <b data-sensitive>{props.member.game_name || "Player"}</b>
        <small>
          {rankText(props.member)}
          <Show when={props.member.account_level !== null}> · Lv {props.member.account_level}</Show>
        </small>
      </span>
    </article>
  );
}

function EmptySlot() {
  return (
    <button class={styles.slot} data-part="invite-slot" data-empty="" title="Invite a friend" onClick={openInvites}>
      <span class={styles.face}>
        <Plus size={16} />
      </span>
      <span class={styles.plate}>
        <b>Invite</b>
      </span>
    </button>
  );
}
