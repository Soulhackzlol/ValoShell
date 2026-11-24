// The League client's own Play, Modes, Rank and Profile: the gold-rimmed PLAY (FIND MATCH once
// a lobby is set), the game-mode select as tall tiles, the ranked crest with its division and a
// points bar, and the summoner icon in its level ring beside your name.
import { Index, Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./leagueHome.module.css";

function playLabel(play: PlayState): string {
  if (play.searchClock()) return "Cancel";
  if (!play.isOwner()) return play.isReady() ? "Not ready" : "Ready";
  return play.isCustom() ? "Start game" : "Find match";
}

export function LolPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.play}>
      <button
        class={styles.playButton}
        data-part="play"
        disabled={!play.canStart() && !play.searchClock()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        {playLabel(play)}
      </button>
      <span class={styles.caption}>
        <Show when={play.searchClock()} fallback={play.current()?.label ?? "No mode"}>
          {(clock) => `In queue ${clock()}`}
        </Show>
      </span>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.warn}>Queue lockout {clock()}</span>}</Show>
    </section>
  );
}

export function LolModes(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.modes}>
      <h3 class={styles.heading}>Game mode</h3>
      <div class={styles.tiles}>
        <Index each={play.queues()}>
          {(queue) => (
            <button
              class={styles.tile}
              data-active={queue().id === play.current()?.id ? "" : undefined}
              disabled={!play.isOwner() || play.searchClock() !== null}
              onMouseEnter={() => playCue("hover")}
              onClick={() => play.pickQueue(queue())}
            >
              <Art src={queue().art} class={styles.tileArt} fallback={<span class={styles.tileArt} />} />
              <span class={styles.tileName}>{queue().label}</span>
            </button>
          )}
        </Index>
      </div>
      <Show when={!play.isOwner()}>
        <p class={styles.caption}>Only the party leader can change the mode.</p>
      </Show>
    </section>
  );
}

export function LolRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.rank}>
      <Show when={view()} fallback={<span class={styles.caption}>{rankPending()}</span>}>
        {(career) => (
          <>
            <Art src={career().rank.icon} class={styles.crest} fallback={<span class={styles.crest} />} />
            <b class={styles.division}>{rankLabel(career())}</b>
            <span class={styles.points} style={{ "--progress": rankProgress(career()) }} />
            <span class={styles.caption}>{rrText(career())}</span>
          </>
        )}
      </Show>
    </section>
  );
}

export function LolProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.profile}>
      <span class={styles.icon}>
        <Art src={profile.member()?.card_small} class={styles.iconArt} fallback={<span class={styles.iconArt} />} />
        <b class={styles.levelBadge}>{profile.level()}</b>
      </span>
      <div class={styles.who}>
        <b class={styles.name} data-sensitive>
          {profile.name()}
        </b>
        <span class={styles.status}>Online</span>
      </div>
    </section>
  );
}
