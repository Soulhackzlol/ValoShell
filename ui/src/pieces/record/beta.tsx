// VALORANT beta "Progression": hairlines, pale cyan and pale yellow only. The rank with a thin
// RR rail, the act numbers in outlined boxes, the nine-step tier ladder (passed steps cyan, the
// current one yellow with its divisions, the act peak marked), and the latest games as a list.
import { For, Show } from "solid-js";
import { Art } from "~/ui/Art";
import { relativeDate } from "../career";
import { TIER_GROUPS, division, groupIndex, signed, useCountUp, type RecordProps } from "./shared";
import styles from "./beta.module.css";
import { useOpenMatch } from "~/menu/openMatch";

export function BetaRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const rr = useCountUp(() => props.view.rr, 300, 900);
  const current = () => groupIndex(props.view.rank.tier);
  const peak = () => groupIndex(props.view.peak?.tier ?? 0);
  const biggest = () => Math.max(1, ...props.view.updates.map((update) => Math.abs(update.rr_earned)));
  return (
    <section class={styles.beta}>
      <header class={styles.head}>
        <span class={styles.eyebrow}>Competitive // Act record</span>
        <h2 class={styles.title}>Progression</h2>
      </header>

      <div class={styles.hero}>
        <div class={styles.rank}>
          <span class={styles.emblem}>
            <Art src={props.view.rank.icon} fallback={<span class={styles.emblemFallback} />} />
          </span>
          <div class={styles.rankText}>
            <span class={styles.label}>Current rank</span>
            <span class={styles.rankName}>{props.view.rank.name}</span>
            <Show when={props.view.placements_left === 0} fallback={<span class={styles.label}>{props.view.placements_left} placements left</span>}>
              <div class={styles.rail}>
                <span class={styles.railFill} style={{ width: `${Math.min(100, props.view.rr)}%` }} />
                <span class={styles.railMark} style={{ left: `${Math.min(100, props.view.rr)}%` }} />
              </div>
              <span class={styles.rrLine}>
                <b>{rr()}</b> / 100 RR
              </span>
            </Show>
          </div>
        </div>
        <div class={styles.boxes}>
          <Box label="Wins" value={`${props.view.wins}`} index={0} />
          <Box label="Games" value={`${props.view.games}`} index={1} />
          <Box label="Win rate" value={`${props.stats.winRate}%`} index={2} />
          <Box label={`Last ${props.stats.recent}`} value={signed(props.stats.net)} index={3} />
        </div>
      </div>

      <div class={styles.ladder}>
        <span class={styles.ladderLine} />
        <span class={styles.ladderDone} style={{ width: `${(Math.max(0, current()) / (TIER_GROUPS.length - 1)) * 100}%` }} />
        <For each={TIER_GROUPS}>
          {(group, index) => (
            <div
              class={styles.step}
              data-state={index() < current() ? "done" : index() === current() ? "current" : "ahead"}
              style={{ "--stagger": index(), left: `${(index() / (TIER_GROUPS.length - 1)) * 100}%` }}
            >
              <Show when={index() === peak() && peak() >= 0}>
                <span class={styles.peak}>Peak</span>
              </Show>
              <span class={styles.node} />
              <span class={styles.stepName}>{group.name}</span>
              <Show when={index() === current() && division(props.view.rank.tier) > 0}>
                <span class={styles.pips}>
                  <For each={[1, 2, 3]}>{(pip) => <i data-on={pip <= division(props.view.rank.tier) ? "" : undefined} />}</For>
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>

      <div class={styles.history}>
        <div class={styles.historyHead}>
          <span>Recent matches</span>
          <span>RR</span>
        </div>
        <ol class={styles.rows}>
          <For each={props.view.updates}>
            {(update, index) => (
              <li {...rowProps(update.match_id)} class={styles.row} data-up={update.rr_earned >= 0 ? "" : undefined} style={{ "--stagger": index() }}>
                <span class={styles.index}>{String(index() + 1).padStart(2, "0")}</span>
                <span class={styles.map}>{update.map_name}</span>
                <span class={styles.when}>{relativeDate(update.started_at_ms)}</span>
                <span class={styles.track}>
                  <i style={{ width: `${(Math.abs(update.rr_earned) / biggest()) * 100}%` }} />
                </span>
                <span class={styles.delta}>{signed(update.rr_earned)}</span>
              </li>
            )}
          </For>
        </ol>
      </div>
    </section>
  );
}

function Box(props: { label: string; value: string; index: number }) {
  return (
    <div class={styles.box} style={{ "--stagger": props.index }}>
      <span class={styles.label}>{props.label}</span>
      <span class={styles.boxValue}>{props.value}</span>
    </div>
  );
}
