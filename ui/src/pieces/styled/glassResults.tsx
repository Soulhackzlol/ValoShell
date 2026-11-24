// Glass match report: the result on a frosted card over the map's splash, your numbers as
// rounded tiles and everyone's line in a frosted scoreboard. It reads what the standard match
// summary reads (state/postMatch, or `?match=<id>` from the history) and keeps its naming rule:
// an incognito player is "Hidden" (the backend never sends their name).
import { For, Show } from "solid-js";
import type { MatchResult } from "~/bindings/MatchResult";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import type { PostMatchView } from "~/bindings/PostMatchView";
import type { PieceProps } from "~/studio/registry";
import { rankColor } from "~/pieces/home";
import { cssUrl } from "~/pieces/pregame";
import { Art } from "~/ui/Art";
import { partyLabel, stackColor } from "~/ui/stacks";
import { playerName } from "../playerName";
import { ownTiles, signed } from "./resultsData";
import { type ReportProps, ResultsRoute } from "./resultsRoute";
import styles from "./glassResults.module.css";

const RESULT_LABEL: Record<MatchResult, string> = { victory: "Victory", defeat: "Defeat", draw: "Draw" };

function ResultCard(props: { view: PostMatchView; onContinue: () => void }) {
  const rrChange = () => props.view.rr_change;
  return (
    <header class={styles.card} data-part="post-match-banner">
      <span class={styles.context}>
        {props.view.queue_label} · {props.view.map_name}
      </span>
      <h1 class={styles.result} data-part="result-title">
        {RESULT_LABEL[props.view.result]}
      </h1>
      <span class={`${styles.score} num`} data-part="result-score">
        <b>{props.view.rounds_won}</b>
        <span>:</span>
        <b>{props.view.rounds_lost}</b>
      </span>
      <Show when={rrChange() !== null}>
        <span class={styles.rr} data-down={(rrChange() ?? 0) < 0 ? "" : undefined}>
          <Show when={props.view.rank_after?.icon}>{(icon) => <img src={icon()} alt="" />}</Show>
          <b class="num">{signed(rrChange() ?? 0)} RR</b>
        </span>
      </Show>
      <Show when={props.view.is_ranked && rrChange() === null}>
        <span class={styles.pending}>RR update pending…</span>
      </Show>
      <button class={styles.continue} data-part="play" onClick={() => props.onContinue()}>
        Continue
      </button>
    </header>
  );
}

function ScoreRow(props: { player: PostMatchPlayer; index: number }) {
  return (
    <li
      class={styles.row}
      data-self={props.player.is_self ? "" : undefined}
      data-side={props.player.is_ally ? "ally" : "enemy"}
      style={{ "--i": props.index, "--stack": stackColor(props.player.stack_group) }}
    >
      <Art src={props.player.agent_icon} class={styles.agent} fallback={<span class={styles.agent} />} />
      <span class={styles.name} data-sensitive>
        {playerName(props.player)}
        <Show when={props.player.tag_line}>
          <small>#{props.player.tag_line}</small>
        </Show>
        <Show when={partyLabel(props.player.stack_size)}>{(party) => <span class={styles.stack}>{party()}</span>}</Show>
      </span>
      <span class="num">
        {props.player.kills}/{props.player.deaths}/{props.player.assists}
      </span>
      <b class="num">{Math.round(props.player.acs)}</b>
    </li>
  );
}

function Report(props: ReportProps) {
  const tint = () => rankColor(props.view.rank_after?.color ?? null);
  return (
    <section
      class={styles.report}
      data-part="post-match"
      data-result={props.view.result}
      style={{ "--splash": cssUrl(props.view.map_splash), "--rank": tint() }}
    >
      <ResultCard view={props.view} onContinue={props.onContinue} />
      <div class={styles.tiles} data-part="stat-tiles">
        <For each={ownTiles(props.view)}>
          {([label, value], index) => (
            <div class={styles.tile} style={{ "--i": index() }}>
              <b class="num">{value}</b>
              <small>{label}</small>
            </div>
          )}
        </For>
      </div>
      <ol class={styles.board} data-part="scoreboard">
        <For each={props.view.players}>{(player, index) => <ScoreRow player={player} index={index()} />}</For>
      </ol>
    </section>
  );
}

export function GlassResults(_props: PieceProps) {
  return <ResultsRoute report={Report} />;
}
