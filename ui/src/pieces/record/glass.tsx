// Glass career, after Apple's Fitness and Health summaries: the rank inside a ring that fills to
// the next one, four highlight tiles, the climb as one quiet line, and recent games as an inset
// grouped list. The ring and the line draw once on arrival; nothing else moves.
import { For, Show, createMemo } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { Art } from "~/ui/Art";
import { relativeDate } from "../career";
import { rankColor } from "../home";
import { nextRankName, outcome, signed, useCountUp, type RecordProps } from "./shared";
import { chartPath, chartPoints, rankTrend } from "./trend";
import styles from "./glass.module.css";

const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const CHART = { width: 600, height: 160, pad: 14 };

function Ring(props: { progress: number; icon: string | null; initial: string }) {
  return (
    <div class={styles.ring}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class={styles.ringTrack} cx="50" cy="50" r={RING_RADIUS} />
        <circle
          class={styles.ringFill}
          cx="50"
          cy="50"
          r={RING_RADIUS}
          stroke-dasharray={`${RING_LENGTH}`}
          stroke-dashoffset={`${RING_LENGTH * (1 - props.progress)}`}
          style={{ "--ring-length": RING_LENGTH }}
        />
      </svg>
      <Art src={props.icon} class={styles.emblem} fallback={<span class={styles.emblemInitial}>{props.initial}</span>} />
    </div>
  );
}

function Trend(props: RecordProps) {
  const points = createMemo(() => chartPoints(rankTrend(props.view.updates), CHART));
  const last = () => points()[points().length - 1];
  return (
    <section class={`${styles.card} ${styles.trend}`}>
      <header class={styles.cardHead}>
        <h3>Rank rating</h3>
        <span>Last {props.stats.recent} ranked games</span>
      </header>
      <div class={styles.chartBox}>
        <svg class={styles.chart} viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="glass-record-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--rank)" stop-opacity="0.32" />
              <stop offset="1" stop-color="var(--rank)" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path class={styles.area} d={chartPath(points(), CHART.height, true)} fill="url(#glass-record-area)" />
          <path class={styles.line} d={chartPath(points(), CHART.height)} pathLength="1" />
        </svg>
        <Show when={last()}>
          {(point) => (
            <span class={styles.dot} style={{ left: `${(point().x / CHART.width) * 100}%`, top: `${(point().y / CHART.height) * 100}%` }} />
          )}
        </Show>
      </div>
    </section>
  );
}

function Tile(props: { label: string; value: string; sign?: "pos" | "neg" }) {
  return (
    <div class={styles.tile}>
      <span>{props.label}</span>
      <b data-sign={props.sign}>{props.value}</b>
    </div>
  );
}

/** "3 wins", "1 loss"; a dash before the first game. */
function streakText(streak: RecordProps["stats"]["streak"]): string {
  if (!streak) return "—";
  const noun = streak.isWin ? (streak.length === 1 ? "win" : "wins") : streak.length === 1 ? "loss" : "losses";
  return `${streak.length} ${noun}`;
}

export function GlassRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const rr = useCountUp(() => props.view.rr, 200, 800);
  const isPlaced = () => props.view.placements_left === 0;
  return (
    <section class={styles.record} style={{ "--rank": rankColor(props.view.rank.color) }}>
      <section class={`${styles.card} ${styles.hero}`}>
        <Ring progress={isPlaced() ? Math.min(1, props.view.rr / 100) : 0} icon={props.view.rank.icon} initial={props.view.rank.name.slice(0, 1)} />
        <h2 class={styles.rankName}>{props.view.rank.name}</h2>
        <Show when={isPlaced()} fallback={<p class={styles.sub}>{props.view.placements_left} placement games to go</p>}>
          <p class={styles.sub}>
            <b class={styles.rr}>{rr()}</b> RR · {Math.max(0, 100 - props.view.rr)} to {nextRankName(props.view.rank.tier)}
          </p>
        </Show>
      </section>
      <div class={styles.tiles}>
        <Tile label="Matches" value={`${props.view.games}`} />
        <Tile label="Win rate" value={`${props.stats.winRate}%`} />
        <Tile label="Net RR" value={signed(props.stats.net)} sign={props.stats.net < 0 ? "neg" : "pos"} />
        <Tile label="Streak" value={streakText(props.stats.streak)} />
      </div>
      <Trend {...props} />
      <section class={`${styles.card} ${styles.list}`}>
        <header class={styles.cardHead}>
          <h3>Recent games</h3>
          <span>
            {props.stats.recentWins} won · {props.stats.recent - props.stats.recentWins} lost
          </span>
        </header>
        <ol class={styles.rows}>
          <For each={props.view.updates}>
            {(update) => (
              <li {...rowProps(update.match_id)} class={styles.row} data-result={outcome(update)}>
                <Art src={update.map_image} class={styles.map} fallback={<span class={styles.map} />} />
                <span class={styles.rowText}>
                  <b>{update.map_name}</b>
                  <small>
                    {relativeDate(update.started_at_ms)} · {update.rank_after.name}
                  </small>
                </span>
                <span class={styles.delta}>{signed(update.rr_earned)}</span>
              </li>
            )}
          </For>
        </ol>
      </section>
    </section>
  );
}
