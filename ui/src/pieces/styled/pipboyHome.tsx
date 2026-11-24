// Pip-Boy's own Play, Rank and Profile: a "[ PLAY ]" menu action with its prompt line, the
// rank as a perk card (emblem, name, a segmented bar like a skill's), and the STAT header
// (name, level, an XP bar).
import { Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./pipboyHome.module.css";

function actionLabel(play: PlayState): string {
  if (play.searchClock()) return "CANCEL";
  if (!play.isOwner()) return play.isReady() ? "NOT READY" : "READY";
  return play.isCustom() ? "START" : "PLAY";
}

export function PipPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.frame}>
      <button
        class={styles.action}
        data-part="play"
        disabled={!play.canStart() && !play.searchClock()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        [ {actionLabel(play)} ]
      </button>
      <span class={styles.prompt}>
        <Show when={play.searchClock()} fallback={`MODE: ${play.current()?.label.toUpperCase() ?? "NONE"}`}>
          {(clock) => `SEARCHING… ${clock()}`}
        </Show>
      </span>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.prompt}>LOCKED OUT {clock()}</span>}</Show>
    </section>
  );
}

export function PipRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.frame} data-row>
      <Show when={view()} fallback={<span class={styles.prompt}>{rankPending().toUpperCase()}</span>}>
        {(career) => (
          <>
            <span class={styles.card}>
              <Art src={career().rank.icon} class={styles.emblem} fallback={<span />} />
            </span>
            <div class={styles.body}>
              <b class={styles.title}>{rankLabel(career()).toUpperCase()}</b>
              <span class={styles.meter} style={{ "--progress": rankProgress(career()) }} />
              <span class={styles.prompt}>{rrText(career()).toUpperCase()}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

export function PipProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.frame}>
      <div class={styles.header}>
        <b class={styles.title} data-sensitive>
          {profile.name().toUpperCase()}
        </b>
        <span>LEVEL {profile.level()}</span>
      </div>
      {/* The level bar runs through the hundred levels a border stands for. */}
      <span class={styles.meter} style={{ "--progress": (profile.level() % 100) / 100 }} />
      <Show when={profile.member()?.title}>
        {(title) => <span class={styles.prompt}>{title().toUpperCase()}</span>}
      </Show>
    </section>
  );
}
