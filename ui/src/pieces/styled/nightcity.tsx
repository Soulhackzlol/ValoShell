// Night City pieces, after Cyberpunk 2077's netrunner HUD: the party as a "link" of data rows
// (slot number, name, rank, level, ping bars, a READY chip), and a breach panel with the mode
// chips and a chamfered yellow PLAY that glitches when pointed at.
import { For, Index, Show } from "solid-js";
import type { MemberView } from "~/bindings/MemberView";
import { playCue } from "~/menu/sound";
import { setDrawerOpen } from "~/state/friends";
import { party } from "~/state/party";
import { connection } from "~/state/session";
import type { PieceProps } from "~/studio/registry";
import { type PlayState, usePlay } from "./usePlay";
import { slideOnWheel } from "~/ui/sideScroll";
import styles from "./nightcity.module.css";

/** Ping at or under each step lights one more bar (like the client's connection meter). */
const PING_STEPS_MS = [140, 90, 50];

function playWord(play: PlayState): string {
  if (play.searchClock() !== null) return `Jack out ${play.searchClock()}`;
  if (play.penaltyClock()) return `Locked ${play.penaltyClock()}`;
  if (!play.isOwner()) return play.isReady() ? "Standing by" : "Ready";
  return "Play";
}

function PingBars(props: { ms: number | null }) {
  const lit = () =>
    props.ms === null ? 0 : PING_STEPS_MS.filter((step) => props.ms !== null && props.ms <= step).length;
  return (
    <span class={styles.ping} title={props.ms === null ? "No ping" : `${props.ms} ms`}>
      <Index each={PING_STEPS_MS}>{(_, index) => <i data-on={index < lit() ? "" : undefined} />}</Index>
    </span>
  );
}

function LinkRow(props: { member: MemberView | undefined; index: number }) {
  const slot = () => String(props.index + 1).padStart(2, "0");
  return (
    <li class={styles.row} data-empty={props.member ? undefined : ""} style={{ "--i": props.index }}>
      <span class={styles.slot}>{slot()}</span>
      <Show
        when={props.member}
        fallback={
          <button class={styles.openSlot} onClick={() => setDrawerOpen(true)}>
            Slot open // invite
          </button>
        }
      >
        {(member) => (
          <>
            <span class={styles.name} data-sensitive>
              {member().game_name}
            </span>
            <span class={styles.meta}>
              <Show when={member().rank.icon}>{(icon) => <img src={icon()} alt="" draggable={false} />}</Show>
              LV <b class="num">{member().account_level ?? "--"}</b>
            </span>
            <PingBars ms={member().ping_ms} />
            <span class={styles.chip} data-ready={member().is_ready ? "" : undefined}>
              {member().is_ready ? "Ready" : "Idle"}
            </span>
          </>
        )}
      </Show>
    </li>
  );
}

/** The party link: a header with the uplink state, one data row per slot. */
export function NcHub(_props: PieceProps) {
  const play = usePlay();
  const members = () => party()?.members ?? [];
  const slots = () => Array.from({ length: play.maxSize() }, (_, index) => members()[index]);
  const isOnline = () => connection().state === "connected";
  return (
    <section class={styles.panel}>
      <header class={styles.head}>
        <span class={styles.code}>NET//LINK</span>
        <span class={styles.title}>Party</span>
        <span class={styles.uplink} data-off={isOnline() ? undefined : ""}>
          {isOnline() ? "Uplink stable" : "No uplink"}
        </span>
      </header>
      <ol class={styles.rows}>
        {/* Index: slots are places, so a party update (a new member object) refreshes a row in place
          instead of remounting it and replaying its entrance. */}
        <Index each={slots()}>{(member, index) => <LinkRow member={member()} index={index} />}</Index>
      </ol>
      <footer class={styles.foot}>
        <span>
          Crew <b class="num">{play.partySize()}</b>/{play.maxSize()}
        </span>
        <span class="num">{play.current()?.label ?? "Offline"}</span>
      </footer>
    </section>
  );
}

/** The breach panel: mode chips (the owner picks) and the big PLAY. */
export function NcPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.breach} data-searching={play.searchClock() !== null ? "" : undefined}>
      <span class={styles.code}>BREACH PROTOCOL</span>
      <div class={styles.modes} role="radiogroup" aria-label="Mode" onWheel={slideOnWheel}>
        <For each={play.queues()}>
          {(queue) => (
            <button
              class={styles.mode}
              role="radio"
              aria-checked={play.current()?.id === queue.id}
              disabled={!play.isOwner()}
              onMouseEnter={() => playCue("hover")}
              onClick={(event) => {
                play.pickQueue(queue);
                event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
              }}
            >
              {queue.label}
            </button>
          )}
        </For>
      </div>
      <button
        class={styles.play}
        data-part="play"
        data-text={playWord(play)}
        disabled={play.searchClock() === null && !play.canStart()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        {playWord(play)}
      </button>
    </section>
  );
}
