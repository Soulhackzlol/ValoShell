// Every style's own match report, dressed by the sheet its Agent select and Lobby use
// (<style>Match.module.css) plus that sheet's Results rules (.resultTitle, .mvp, the defeat
// mood). The parts are the ones every shooter's post-match shares: a banner with the result and
// score, your numbers, and both teams best-first with each team's MVP marked. What changes is
// the words: Minecraft's "You Died!", Fortnite's "Victory Royale", Night City's "Flatlined".
// Naming follows the standard report: an incognito player is "Hidden".
import { For, Show } from "solid-js";
import type { MatchResult } from "~/bindings/MatchResult";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import { cssUrl } from "~/pieces/pregame";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { partyLabel, stackColor } from "~/ui/stacks";
import { playerName } from "../playerName";
import { mvpOf, ownTiles, signed, teamsOf } from "./resultsData";
import { type ReportProps, ResultsRoute } from "./resultsRoute";
import type { Sheet } from "./styledMatch";
import base from "./resultsBase.module.css";

/** What a style calls things on its report. */
export interface ResultWords {
  result: Record<MatchResult, string>;
  /** The line over the result: "Carnage report", "$ match --report"... */
  context: string;
  continue: string;
  allies: string;
  enemies: string;
  /** The MVP mark beside a team's best player: "★", "MVP", "ACE"... */
  mvp: string;
}

function Banner(props: ReportProps & { css: Sheet; words: ResultWords }) {
  const rrChange = () => props.view.rr_change;
  return (
    <header class={`${base.banner} ${props.css["head"]}`} data-part="report-banner">
      <span class={base.context}>
        {props.words.context} · {props.view.queue_label} · {props.view.map_name}
      </span>
      <h1 class={`${base.title} ${props.css["resultTitle"] ?? ""}`} data-part="report-title">
        {props.words.result[props.view.result]}
      </h1>
      <span class={`${base.score} num`} data-part="report-score">
        <b>{props.view.rounds_won}</b>
        <i>:</i>
        <b>{props.view.rounds_lost}</b>
      </span>
      <Show when={rrChange() !== null}>
        <span class={`${base.rr} num`} data-down={(rrChange() ?? 0) < 0 ? "" : undefined}>
          <Art src={props.view.rank_after?.icon} class={base.rrIcon} fallback={null} />
          {signed(rrChange() ?? 0)} RR
        </span>
      </Show>
      <Show when={props.view.is_ranked && rrChange() === null}>
        <span class={base.context}>RR update pending…</span>
      </Show>
      <button class={`${base.continue} ${props.css["lock"]}`} onClick={() => props.onContinue()}>
        {props.words.continue}
      </button>
    </header>
  );
}

function BoardRow(props: { player: PostMatchPlayer; isMvp: boolean; css: Sheet; mvp: string }) {
  return (
    <li
      class={`${base.row} ${props.css["line"]}`}
      data-self={props.player.is_self ? "" : undefined}
      style={{ "--stack": stackColor(props.player.stack_group) }}
    >
      <Art src={props.player.agent_icon} class={base.agent} fallback={<span class={base.agent} />} />
      <span class={`${base.name} ${props.css["lineName"]}`} data-sensitive>
        {playerName(props.player)}
        <Show when={props.isMvp}>
          <span class={`${base.mvp} ${props.css["mvp"] ?? ""}`} title="Best combat score on the team">
            {props.mvp}
          </span>
        </Show>
        <Show when={partyLabel(props.player.stack_size)}>{(party) => <small class={base.party}>{party()}</small>}</Show>
      </span>
      <span class="num">
        {props.player.kills}/{props.player.deaths}/{props.player.assists}
      </span>
      <b class="num">{Math.round(props.player.acs)}</b>
    </li>
  );
}

function Board(props: { title: string; rounds: number; players: PostMatchPlayer[]; css: Sheet; mvp: string }) {
  const mvp = () => mvpOf(props.players);
  return (
    <section class={props.css["team"]}>
      <header class={props.css["teamHead"]}>
        <b>{props.title}</b>
        <span class="num">{props.rounds}</span>
      </header>
      <div class={base.columns} aria-hidden="true">
        <span />
        <span>Player</span>
        <span>K / D / A</span>
        <span>ACS</span>
      </div>
      <ol class={base.rows}>
        <For each={props.players}>
          {(player) => <BoardRow player={player} isMvp={player.puuid === mvp()} css={props.css} mvp={props.mvp} />}
        </For>
      </ol>
    </section>
  );
}

function Report(props: ReportProps & { css: Sheet; words: ResultWords }) {
  const teams = () => teamsOf(props.view.players);
  return (
    <section
      class={`${props.css["lobby"]} ${base.report}`}
      data-part="report"
      data-result={props.view.result}
      style={{ "--splash": cssUrl(props.view.map_splash) }}
    >
      <Banner view={props.view} onContinue={props.onContinue} css={props.css} words={props.words} />
      <div class={base.tiles} data-part="report-tiles">
        <For each={ownTiles(props.view)}>
          {([label, value]) => (
            <div class={`${base.tile} ${props.css["line"]}`}>
              <b class="num">{value}</b>
              <small>{label}</small>
            </div>
          )}
        </For>
      </div>
      <div class={props.css["teams"]} data-part="report-board">
        <Board
          title={props.words.allies}
          rounds={props.view.rounds_won}
          players={teams().allies}
          css={props.css}
          mvp={props.words.mvp}
        />
        <Show when={teams().enemies.length > 0}>
          <Board
            title={props.words.enemies}
            rounds={props.view.rounds_lost}
            players={teams().enemies}
            css={props.css}
            mvp={props.words.mvp}
          />
        </Show>
      </div>
    </section>
  );
}

/** A style's Results piece from its sheet and words. */
export function resultsLook(css: Sheet, words: ResultWords) {
  const StyleReport = (props: ReportProps) => <Report {...props} css={css} words={words} />;
  return (_props: PieceProps) => <ResultsRoute report={StyleReport} />;
}
