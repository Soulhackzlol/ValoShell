// Leaderboard piece: the region's top competitive players this act, the player's own line
// highlighted (or pinned below when they rank lower). Names are sensitive in streamer mode,
// and players who hide their name show as "Secret Agent", like in the client.
import { For, Show, onMount } from "solid-js";
import { RefreshCw } from "lucide-solid";
import type { LeaderboardRow } from "~/bindings/LeaderboardRow";
import type { PieceProps } from "~/studio/registry";
import { leaderboardView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { ViewStatus } from "~/ui/ViewStatus";
import styles from "./leaderboard.module.css";

const HIDDEN_NAME = "Secret Agent";

function Row(props: { row: LeaderboardRow; index: number }) {
  return (
    <li class={styles.row} data-self={props.row.is_self ? "" : undefined} style={{ "--stagger": Math.min(props.index, 20) }}>
      <span class={`${styles.place} num`}>{props.row.rank}</span>
      <Art src={props.row.card_small} class={styles.card} fallback={<span class={styles.card} />} />
      <span class={styles.name} data-sensitive={props.row.is_anonymized ? undefined : ""}>
        <Show when={!props.row.is_anonymized} fallback={HIDDEN_NAME}>
          {props.row.game_name}
          <small>#{props.row.tag_line}</small>
        </Show>
      </span>
      <Art src={props.row.tier.icon} class={styles.tier} fallback={<span class={styles.tier} />} />
      <span class={`${styles.rr} num`}>
        {props.row.rr}
        <small>RR</small>
      </span>
      <span class={`${styles.wins} num`}>{props.row.wins} W</span>
    </li>
  );
}

function Status() {
  return <ViewStatus view={leaderboardView} title={"Leaderboard"} loading="Loading the leaderboard…" idle="Connect to VALORANT to see the leaderboard." />;
}

export function LeaderboardPiece(_props: PieceProps) {
  onMount(() => {
    if (!leaderboardView.value() && !leaderboardView.isLoading()) void leaderboardView.load();
  });
  return (
    <Show when={leaderboardView.value()} fallback={<Status />}>
      {(view) => (
        <section class={styles.board}>
          <header class={styles.header}>
            <div>
              <h2 class={styles.title}>Leaderboard</h2>
              <span class={styles.subtitle}>
                {view().region} · {view().total_players.toLocaleString()} ranked players
              </span>
            </div>
            <button class={styles.refresh} title="Refresh" aria-label="Refresh the leaderboard" disabled={leaderboardView.isLoading()} onClick={() => void leaderboardView.load(true)}>
              <RefreshCw size={15} />
            </button>
          </header>
          <Show when={view().rows.length > 0} fallback={<Empty title="Nobody ranked yet">The leaderboard fills as players reach Immortal this act.</Empty>}>
            <ol class={styles.rows}>
              <For each={view().rows}>{(row, index) => <Row row={row} index={index()} />}</For>
            </ol>
          </Show>
          <Show when={view().own_row}>
            {(own) => (
              <ol class={styles.own} aria-label="Your place">
                <Row row={own()} index={0} />
              </ol>
            )}
          </Show>
        </section>
      )}
    </Show>
  );
}
