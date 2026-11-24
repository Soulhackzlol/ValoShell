// Phantom's own Play, Rank and Profile: PLAY as one huge slanted cut-out word that turns white
// over a red slash, the rank as a jagged calling-card stat, and a tilted status card with the
// name in ransom-note letters.
import { For, Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./phantomHome.module.css";

function playWord(play: PlayState): string {
  if (play.searchClock()) return "Cancel";
  if (!play.isOwner()) return play.isReady() ? "Wait" : "Ready";
  return play.isCustom() ? "Start" : "Play";
}

export function PhPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.play}>
      <button
        class={styles.word}
        data-part="play"
        disabled={!play.canStart() && !play.searchClock()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        {playWord(play)}
      </button>
      <span class={styles.tag}>
        <Show when={play.searchClock()} fallback={play.current()?.label ?? "No mission"}>
          {(clock) => `Infiltrating… ${clock()}`}
        </Show>
      </span>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.tag}>Lying low {clock()}</span>}</Show>
    </section>
  );
}

export function PhRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.card}>
      <Show when={view()} fallback={<span class={styles.tag}>{rankPending()}</span>}>
        {(career) => (
          <>
            <Art src={career().rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
            <div class={styles.body}>
              <b class={styles.stat}>{rankLabel(career())}</b>
              <span class={styles.gauge} style={{ "--progress": rankProgress(career()) }} />
              <span class={styles.tag}>{rrText(career())}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

/** A fixed lean per letter between -5 and 5 degrees, so the name never wobbles between draws. */
function letterTilt(index: number): string {
  return `${((index * 37) % 11) - 5}deg`;
}

/** The name as ransom-note letters: every other one inverted, each leaning its own way. */
function RansomName(props: { name: string }) {
  return (
    <span class={styles.ransom} data-sensitive aria-label={props.name}>
      <For each={[...props.name]}>
        {(letter, index) => (
          <span
            class={styles.letter}
            data-alt={index() % 2 === 1 ? "" : undefined}
            style={{ "--tilt": letterTilt(index()) }}
            aria-hidden="true"
          >
            {letter}
          </span>
        )}
      </For>
    </span>
  );
}

export function PhProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.card}>
      <Art src={profile.member()?.card_small} class={styles.portrait} fallback={<span class={styles.portrait} />} />
      <div class={styles.body}>
        <RansomName name={profile.name()} />
        <span class={styles.tag}>Lv {profile.level()}</span>
      </div>
    </section>
  );
}
