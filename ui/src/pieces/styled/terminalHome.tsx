// Terminal's own Play, Rank and Profile: each is one console pane answering a command
// (`queue start`, `rank --me`, `whoami`), so the home screen reads like a session log.
import { Show } from "solid-js";
import type { PieceProps } from "~/studio/registry";
import { Prompt } from "./terminalScreens";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { usePlay } from "./usePlay";
import styles from "./terminalHome.module.css";

const BAR_CELLS = 20;

/** `[########............]`: RR through the tier as console cells. */
function asciiBar(progress: number, cells = BAR_CELLS): string {
  const filled = Math.round(Math.min(Math.max(progress, 0), 1) * cells);
  return `[${"#".repeat(filled)}${".".repeat(cells - filled)}]`;
}

/** What PLAY does right now, as the command the button runs. */
function playCommand(play: ReturnType<typeof usePlay>): string {
  if (play.searchClock()) return "queue stop";
  if (!play.isOwner()) return play.isReady() ? "ready --off" : "ready --on";
  return play.isCustom() ? "custom start" : "queue start";
}

export function TerminalPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.pane}>
      <span class={styles.dim}>mode: {play.current()?.label.toLowerCase() ?? "none"}</span>
      <Show when={play.searchClock()}>{(clock) => <span>searching… {clock()}</span>}</Show>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.warn}>locked out {clock()}</span>}</Show>
      <button
        class={styles.run}
        data-part="play"
        disabled={!play.canStart() && !play.searchClock()}
        onClick={() => play.press()}
      >
        <span aria-hidden="true">$ </span>
        {playCommand(play)}
        <span class={styles.caret} aria-hidden="true" />
      </button>
    </section>
  );
}

export function TerminalRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.pane}>
      <Prompt command="rank --me" />
      <Show when={view()} fallback={<span class={styles.dim}>{rankPending()}</span>}>
        {(career) => (
          <>
            <span>tier   {rankLabel(career()).toLowerCase()}</span>
            <span>rr     {rrText(career())}</span>
            <span class={styles.bar}>{asciiBar(rankProgress(career()))}</span>
            <span class={styles.dim}>
              record {career().wins}w / {career().games}g this act
            </span>
          </>
        )}
      </Show>
    </section>
  );
}

export function TerminalProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.pane}>
      <Prompt command="whoami" />
      <span data-sensitive>
        {profile.name()}
        <Show when={profile.tag()}>
          <span class={styles.dim}>#{profile.tag()}</span>
        </Show>
      </span>
      <span>level  {profile.level()}</span>
      <Show when={profile.member()?.title}>{(title) => <span class={styles.dim}>title  "{title()}"</span>}</Show>
    </section>
  );
}
