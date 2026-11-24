// Halo 3's own Play, Rank and Profile: the lobby's highlighted "Start Game" bar with the
// playlist under it, the skill rank in its insignia frame with the experience bar, and the
// service record nameplate (emblem, gamertag, service tag).
import { Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./haloHome.module.css";

/** Halo's service tag: four letters taken from the Riot tag. */
const SERVICE_TAG_LENGTH = 4;

function startLabel(play: PlayState): string {
  if (play.searchClock()) return "Cancel Search";
  if (!play.isOwner()) return play.isReady() ? "Not Ready" : "Ready Up";
  return play.isCustom() ? "Start Custom Game" : "Start Game";
}

export function HaloPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.frame}>
      <button
        class={styles.start}
        data-part="play"
        disabled={!play.canStart() && !play.searchClock()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        {startLabel(play)}
      </button>
      <span class={styles.sub}>
        <Show when={play.searchClock()} fallback={`Playlist: ${play.current()?.label ?? "None"}`}>
          {(clock) => `Searching for players… ${clock()}`}
        </Show>
      </span>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.warn}>Matchmaking banned {clock()}</span>}</Show>
    </section>
  );
}

export function HaloRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.frame} data-row>
      <Show when={view()} fallback={<span class={styles.sub}>{rankPending()}</span>}>
        {(career) => (
          <>
            <span class={styles.insignia}>
              <Art src={career().rank.icon} class={styles.emblem} fallback={<span />} />
            </span>
            <div class={styles.body}>
              <span class={styles.label}>Skill</span>
              <b class={styles.value}>{rankLabel(career())}</b>
              <span class={styles.track} style={{ "--progress": rankProgress(career()) }} />
              <span class={styles.sub}>{rrText(career())}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

export function HaloProfile(_props: PieceProps) {
  const profile = useProfile();
  const serviceTag = () => profile.tag().slice(0, SERVICE_TAG_LENGTH).toUpperCase();
  return (
    <section class={styles.frame} data-row>
      <Art src={profile.member()?.card_small} class={styles.badge} fallback={<span class={styles.badge} />} />
      <div class={styles.body}>
        <b class={styles.value} data-sensitive>
          {profile.name()}
        </b>
        <span class={styles.label} data-sensitive>
          Service tag {serviceTag()}
        </span>
        <span class={styles.sub}>Level {profile.level()}</span>
      </div>
    </section>
  );
}
