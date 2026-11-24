// Career pieces: the rank card (emblem, RR bar, act record, peak) and the RR history of the
// latest ranked matches with a trend line.
import { For, Show, createMemo, onMount } from "solid-js";
import { RefreshCw } from "lucide-solid";
import type { RrUpdate } from "~/bindings/RrUpdate";
import type { PieceProps } from "~/studio/registry";
import { careerView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { rankColor } from "./home";
import styles from "./career.module.css";
import { useOpenMatch } from "~/menu/openMatch";
import { ViewStatus } from "~/ui/ViewStatus";

export function useCareer(): void {
  onMount(() => {
    if (!careerView.value()) void careerView.load();
  });
}

export function Status(props: { what: string }) {
  return <ViewStatus view={careerView} title={props.what} loading="Loading your career…" idle="Connect to VALORANT to see your rank." />;
}

export function RankCard(_props: PieceProps) {
  useCareer();
  return (
    <Show when={careerView.value()} fallback={<Status what="Rank" />}>
      {(view) => {
        const winRate = () => (view().games > 0 ? Math.round((view().wins / view().games) * 100) : 0);
        return (
          <section class={styles.rank} style={{ "--rank": rankColor(view().rank.color) }}>
            <div class={styles.emblem}>
              <Art src={view().rank.icon} fallback={<span class={styles.emblemFallback} />} />
            </div>
            <div class={styles.rankInfo}>
              <span class="overline">Current rank</span>
              <span class={styles.rankName}>{view().rank.name}</span>
              <Show
                when={view().placements_left === 0}
                fallback={<span class={styles.placements}>{view().placements_left} placement games left</span>}
              >
                <div class={styles.rrRow}>
                  <div class={styles.rrBar}>
                    <span class={styles.rrFill} style={{ width: `${Math.min(100, view().rr)}%` }} />
                  </div>
                  <span class={`${styles.rr} num`}>
                    {view().rr}
                    <small>RR</small>
                  </span>
                </div>
              </Show>
              <div class={styles.stats}>
                <span>
                  <b class="num">{view().wins}</b> wins
                </span>
                <span>
                  <b class="num">{view().games}</b> games
                </span>
                <span>
                  <b class="num">{winRate()}%</b> win rate
                </span>
                <Show when={view().leaderboard_rank > 0}>
                  <span>
                    <b class="num">#{view().leaderboard_rank}</b> leaderboard
                  </span>
                </Show>
              </div>
              <Show when={view().peak}>
                {(peak) => (
                  <span class={styles.peak} style={{ "--peak": rankColor(peak().color) }}>
                    Act peak <b>{peak().name}</b>
                  </span>
                )}
              </Show>
            </div>
          </section>
        );
      }}
    </Show>
  );
}

/** Total ladder points (tier * 100 + RR) after each match, oldest first, for the trend line. */
export function ladder(updates: readonly RrUpdate[]): number[] {
  return [...updates].reverse().map((update) => update.rank_after.tier * 100 + update.rr_after);
}

function Trend(props: { points: number[] }) {
  const path = createMemo(() => {
    const points = props.points;
    if (points.length < 2) return "";
    const min = Math.min(...points);
    const span = Math.max(...points) - min || 1;
    return points
      .map((value, index) => `${((index / (points.length - 1)) * 100).toFixed(2)},${(36 - ((value - min) / span) * 32).toFixed(2)}`)
      .join(" ");
  });
  return (
    <svg class={styles.trend} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={path()} />
    </svg>
  );
}

export function relativeDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function RrHistory(_props: PieceProps) {
  const { rowProps } = useOpenMatch();
  useCareer();
  return (
    <Show when={careerView.value()} fallback={<Status what="Ranked history" />}>
      {(view) => (
        <section class={styles.history}>
          <header class={styles.header}>
            <h2 class={styles.title}>Ranked history</h2>
            <button class={styles.refresh} title="Refresh" disabled={careerView.isLoading()} onClick={() => void careerView.load(true)}>
              <RefreshCw size={14} />
            </button>
          </header>
          <Show when={view().updates.length > 0} fallback={<Empty title="No ranked games yet" />}>
            <Trend points={ladder(view().updates)} />
            <ol class={styles.matches}>
              <For each={view().updates}>
                {(update, index) => (
                  <li {...rowProps(update.match_id)} class={styles.match} style={{ "--stagger": index() }} data-result={update.rr_earned >= 0 ? "up" : "down"}>
                    <span class={styles.mapThumb}>
                      <Art src={update.map_image} fallback={<span />} />
                    </span>
                    <span class={styles.matchText}>
                      <span class={styles.matchMap}>{update.map_name}</span>
                      <span class={styles.matchWhen}>{relativeDate(update.started_at_ms)}</span>
                    </span>
                    <Show when={update.is_promotion || update.is_demotion}>
                      <span class={styles.movement} data-up={update.is_promotion ? "" : undefined}>
                        {update.is_promotion ? "Promoted" : "Demoted"}
                      </span>
                    </Show>
                    <span class={`${styles.delta} num`}>
                      {update.rr_earned > 0 ? "+" : ""}
                      {update.rr_earned}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </section>
      )}
    </Show>
  );
}
