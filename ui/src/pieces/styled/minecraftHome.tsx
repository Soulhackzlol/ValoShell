// Minecraft's own Play, Rank and Profile: a stone Play button with the mode as the button
// below it would say, the rank as the XP bar with its green level number, and you as a
// player head under a floating nametag.
import { Show } from "solid-js";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { McButton } from "./minecraft";
import { isRated, rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./minecraftHome.module.css";

/** The button's words for what it does now, in the title screen's sentence case. */
function playLabel(play: PlayState): string {
  if (play.searchClock()) return "Cancel";
  if (!play.isOwner()) return play.isReady() ? "Not Ready" : "Ready";
  return play.isCustom() ? "Start Game" : "Play";
}

export function McPlay(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.play}>
      <McButton isPlay isDisabled={!play.canStart() && !play.searchClock()} onClick={() => play.press()}>
        {playLabel(play)}
      </McButton>
      <span class={styles.caption}>
        <Show when={play.searchClock()} fallback={`Mode: ${play.current()?.label ?? "None"}`}>
          {(clock) => `Searching for a match... ${clock()}`}
        </Show>
      </span>
      <Show when={play.penaltyClock()}>{(clock) => <span class={styles.warn}>Locked out for {clock()}</span>}</Show>
    </section>
  );
}

export function McRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.rank}>
      <Show when={view()} fallback={<span class={styles.caption}>{rankPending()}</span>}>
        {(career) => (
          <>
            <span class={styles.slot}>
              <Art src={career().rank.icon} class={styles.item} fallback={<span />} />
            </span>
            <div class={styles.rankBody}>
              <span class={styles.rankName}>{rankLabel(career())}</span>
              {/* The XP bar: the green level number sits on it, as in the hotbar. */}
              <span class={styles.xp} style={{ "--progress": rankProgress(career()) }}>
                <Show when={isRated(career())}>
                  <b class={styles.level}>{career().rr}</b>
                </Show>
              </span>
              <span class={styles.caption}>{rrText(career())}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

export function McProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.profile}>
      <span class={styles.nametag} data-sensitive>
        {profile.name()}
      </span>
      <Art src={profile.member()?.card_small} class={styles.head} fallback={<span class={styles.head} />} />
      <b class={styles.level} title="Account level">
        {profile.level()}
      </b>
    </section>
  );
}
