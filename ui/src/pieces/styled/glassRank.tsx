// Glass rank card: your rank emblem, RR toward the next tier as a filling bar, and the last few
// ranked results as dots, so the climb reads at a glance from the home screen.
import { For, Show, onMount } from "solid-js";
import type { CareerView } from "~/bindings/CareerView";
import type { PieceProps } from "~/studio/registry";
import { rankColor } from "~/pieces/home";
import { careerView } from "~/state/views";
import { Art } from "~/ui/Art";
import { pointerGlow } from "./glassMotion";
import styles from "./glassRank.module.css";

/** Ranked results shown as dots. */
const RECENT_GAMES = 5;
/** Immortal 1 and up count RR without a 100 cap. */
const UNCAPPED_TIER = 24;
const RR_PER_TIER = 100;

function isRated(view: CareerView): boolean {
  return view.rank.tier >= 3 && view.placements_left === 0;
}

/** RR progress through the tier, 0..1; uncapped tiers show a full bar. */
function progress(view: CareerView): number {
  if (view.rank.tier >= UNCAPPED_TIER) return 1;
  return Math.min(Math.max(view.rr / RR_PER_TIER, 0), 1);
}

export function GlassRank(_props: PieceProps) {
  onMount(() => {
    if (!careerView.value() && !careerView.isLoading()) void careerView.load();
  });
  const recent = () => careerView.value()?.updates.slice(0, RECENT_GAMES).reverse() ?? [];
  return (
    <section ref={(element) => pointerGlow(element)} class={styles.rank}>
      <span class={styles.glare} aria-hidden="true" />
      <Show when={careerView.value()} fallback={<p class={styles.note}>{careerView.isLoading() ? "Loading rank…" : "Rank shows once VALORANT is open"}</p>}>
        {(view) => (
          <>
            <Art src={view().rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
            <div class={styles.body} style={{ "--rank": rankColor(view().rank.color), "--progress": progress(view()) }}>
              <div class={styles.head}>
                <b>{isRated(view()) ? view().rank.name : "Unrated"}</b>
                <span class={styles.rr}>
                  <Show when={isRated(view())} fallback={`${view().placements_left} placements left`}>
                    {view().rank.tier >= UNCAPPED_TIER ? `${view().rr} RR` : `${view().rr} / ${RR_PER_TIER} RR`}
                  </Show>
                </span>
              </div>
              <span class={styles.track}>
                <span class={styles.fill} />
              </span>
              <Show when={recent().length > 0}>
                <ol class={styles.recent} aria-label="Last ranked games">
                  <For each={recent()}>
                    {(update, index) => (
                      <li
                        style={{ "--i": index() }}
                        data-result={update.rr_earned > 0 ? "win" : update.rr_earned < 0 ? "loss" : "draw"}
                        title={`${update.map_name} ${update.rr_earned > 0 ? "+" : ""}${update.rr_earned} RR`}
                      />
                    )}
                  </For>
                </ol>
              </Show>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}
