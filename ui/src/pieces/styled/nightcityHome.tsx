// Night City's own Rank and Profile: the rank as a street-cred tier readout (a chamfered red
// panel with a segmented bar and a cyan readout), and the character header: a portrait shard
// beside your handle, level and the tier you run at.
import { Show } from "solid-js";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import styles from "./nightcityHome.module.css";

export function NcRank(_props: PieceProps) {
  const view = useRank();
  return (
    <section class={styles.panel}>
      <Show when={view()} fallback={<span class={styles.readout}>{rankPending()}</span>}>
        {(career) => (
          <>
            <Art src={career().rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
            <div class={styles.body}>
              <span class={styles.label}>Street cred</span>
              <b class={styles.value}>{rankLabel(career())}</b>
              <span class={styles.segments} style={{ "--progress": rankProgress(career()) }} />
              <span class={styles.readout}>{rrText(career())}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

export function NcProfile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.panel}>
      <Art src={profile.member()?.card_small} class={styles.shard} fallback={<span class={styles.shard} />} />
      <div class={styles.body}>
        <span class={styles.label}>Handle</span>
        <b class={styles.value} data-sensitive>
          {profile.name()}
        </b>
        <span class={styles.readout}>
          LVL {profile.level()}
          <Show when={profile.member()?.rank.name}>{(rank) => <> · {rank()}</>}</Show>
        </span>
      </div>
    </section>
  );
}
