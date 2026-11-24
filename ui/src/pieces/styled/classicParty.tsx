// CS 1.6 party: the scoreboard's sunken olive table in a VGUI window, one row per slot (name,
// rank, latency, status). The "slots" layout turns the rows into five sunken picture boxes like
// the team-select menu. Invite opens the friends list; Kick removes the picked player.
import { Index, Show, createMemo, createSignal } from "solid-js";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { party, partyActions } from "~/state/party";
import { Art } from "~/ui/Art";
import { Silhouette } from "./avatars";
import { Window, onActivate, titleOf } from "./classic";
import { canKick, openInvites, partySlots, rankText } from "./csParty";
import classic from "./classic.module.css";
import styles from "./classicParty.module.css";

function statusOf(member: MemberView): string {
  if (member.is_owner) return "Leader";
  return member.is_ready ? "Ready" : "Waiting";
}

export function Cs16Party(props: PieceProps) {
  const slots = createMemo(partySlots);
  const [selected, setSelected] = createSignal<string | null>(null);
  return (
    <Window title={titleOf(props, "Party")} footer={<PartyFooter selected={selected()} onKick={() => setSelected(null)} />}>
      <div class={`${classic.table} ${styles.board}`}>
        <div class={styles.head}>
          <span>Name</span>
          <span>Rank</span>
          <span>Latency</span>
          <span>Status</span>
        </div>
        <div class={styles.rows}>
          <Index each={slots()}>
            {(member) => (
              <Show when={member()} fallback={<EmptyRow />}>
                {(current) => <MemberRow member={current()} isPicked={selected() === current().puuid} onPick={setSelected} />}
              </Show>
            )}
          </Index>
        </div>
      </div>
    </Window>
  );
}

function PartyFooter(props: { selected: string | null; onKick: () => void }) {
  const picked = () => party()?.members.find((member) => member.puuid === props.selected);
  const isKickable = () => {
    const member = picked();
    return member ? canKick(member) : false;
  };
  const kickPicked = () => {
    const member = picked();
    if (!member) return;
    playCue("back");
    props.onKick();
    void partyActions.kick(member.puuid);
  };
  const status = () => {
    const view = party();
    return view ? `${view.members.length} / ${view.max_size} players · ${view.queue.label}` : "Not connected";
  };
  return (
    <>
      <span class={classic.status}>{status()}</span>
      <button class={classic.button} data-part="invite" onClick={openInvites}>
        Invite...
      </button>
      <button class={classic.button} data-part="kick" disabled={!isKickable()} onClick={kickPicked}>
        Kick
      </button>
    </>
  );
}

function MemberRow(props: { member: MemberView; isPicked: boolean; onPick: (puuid: string) => void }) {
  const pick = () => props.onPick(props.member.puuid);
  return (
    <div
      class={styles.row}
      data-part="slot"
      role="row"
      tabIndex={0}
      aria-selected={props.isPicked}
      data-active={props.isPicked ? "" : undefined}
      data-self={props.member.is_self ? "" : undefined}
      onClick={pick}
      onKeyDown={(event) => onActivate(event, pick)}
    >
      <span class={styles.picture}>
        <Art src={props.member.card_small ?? props.member.card_tall} class={styles.portrait} fallback={<Silhouette />} />
      </span>
      <span class={styles.name} data-sensitive>
        {props.member.game_name || "Player"}
      </span>
      <span>{rankText(props.member)}</span>
      <span class="num">{props.member.ping_ms ?? "-"}</span>
      <span data-ready={props.member.is_ready ? "" : undefined}>{statusOf(props.member)}</span>
    </div>
  );
}

function EmptyRow() {
  return (
    <button class={styles.row} data-part="invite-slot" data-empty="" onClick={openInvites}>
      <span class={styles.picture} />
      <span class={styles.name}>&lt;empty slot&gt;</span>
      <span>Invite...</span>
    </button>
  );
}
