// Fortnite's own Rank and Profile: the Ranked card (the badge on a gradient tile, the rank in
// heavy caps and a progress percentage) and the lobby's player banner with your name and level.
import { Show } from "solid-js";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { isRated, rankLabel, rankPending, rankProgress, useProfile, useRank } from "./homeData";
import styles from "./fortniteHome.module.css";

const PERCENT = 100;

export function FnRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.card}>
      <Show when={view()} fallback={<span class={styles.small}>{rankPending()}</span>}>
        {(career) => (
          <>
            <span class={styles.tile}>
              <Art src={career().rank.icon} class={styles.badge} fallback={<span />} />
            </span>
            <div class={styles.body}>
              <span class={styles.small}>Ranked</span>
              <b class={styles.big}>{rankLabel(career())}</b>
              <span class={styles.track} style={{ "--progress": rankProgress(career()) }} />
              <span class={styles.small}>
                <Show when={isRated(career())} fallback={`${career().placements_left} placement matches left`}>
                  {Math.round(rankProgress(career()) * PERCENT)}% to next rank
                </Show>
              </span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

export function FnProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.card}>
      <Art src={profile.member()?.card_small} class={styles.banner} fallback={<span class={styles.banner} />} />
      <div class={styles.body}>
        <b class={styles.big} data-sensitive>
          {profile.name()}
        </b>
        <span class={styles.level}>
          <span class={styles.star} aria-hidden="true">
            ★
          </span>
          Level {profile.level()}
        </span>
      </div>
    </section>
  );
}
