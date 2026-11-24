// Post-match summary: the result over the map's splash art, the player's own numbers as
// tiles, the RR change of a ranked match and everyone's scoreboard line. Incognito players
// stay unnamed (the backend never sends their names). `?match=<id>` shows a past match from
// the history instead of the one just played.
import { For, Match, Show, Switch, createResource, type JSX } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import type { MatchResult } from "~/bindings/MatchResult";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import type { PostMatchView } from "~/bindings/PostMatchView";
import type { PieceProps } from "~/studio/registry";
import { doc } from "~/studio/store";
import type { Skin } from "~/studio/types";
import { dismissPostMatch, postMatch } from "~/state/postMatch";
import { call, errorText } from "~/ipc/commands";
import { Art } from "~/ui/Art";
import { partyLabel, stackColor } from "~/ui/stacks";
import { playerName } from "./playerName";
import controls from "~/ui/controls.module.css";
import { Empty } from "~/ui/controls";
import { rankColor } from "./home";
import styles from "./postmatch.module.css";
// Layouts (Teams, Card, Line) restyle the parts below by their data-part hooks.
import "./postmatchLayouts.module.css";

const RESULT_LABEL: Record<MatchResult, string> = { victory: "Victory", defeat: "Defeat", draw: "Draw" };

/** What each style's own game would shout at the end of a match. */
const STYLE_RESULT: Partial<Record<Skin, Record<MatchResult, string>>> = {
  cs16: { victory: "Counter-Terrorists Win!", defeat: "Terrorists Win!", draw: "Round Draw!" },
  csgo: { victory: "Match won", defeat: "Match lost", draw: "Match tied" },
  cs2: { victory: "You won", defeat: "You lost", draw: "Tie" },
  fortnite: { victory: "#1 Victory Royale", defeat: "Eliminated", draw: "Top 2" },
  minecraft: { victory: "Victory!", defeat: "You Died!", draw: "Stalemate" },
  halo: { victory: "Victory", defeat: "Defeat", draw: "Tie game" },
  terminal: { victory: "exit 0  # victory", defeat: "exit 1  # defeat", draw: "exit 2  # draw" },
};

/** The heading over the scoreboard, in the style's vocabulary. */
const STYLE_CONTEXT: Partial<Record<Skin, string>> = {
  halo: "Post-game carnage report",
  minecraft: "Statistics",
  terminal: "$ match --summary",
  fortnite: "Match stats",
};

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function Tile(props: { label: string; index: number; accent?: boolean; children: JSX.Element }) {
  return (
    <div class={styles.tile} data-part="stat-tile" data-accent={props.accent ? "" : undefined} style={{ "--stagger": props.index }}>
      <span class={styles.tileValue}>{props.children}</span>
      <span class={styles.tileLabel}>{props.label}</span>
    </div>
  );
}

function OwnPanel(props: { view: PostMatchView }) {
  const stats = () => props.view.stats;
  const kd = () => (stats().deaths === 0 ? stats().kills : stats().kills / stats().deaths).toFixed(2);
  return (
    <aside class={styles.own} data-part="own-stats">
      <div class={styles.agent} data-part="own-agent">
        <span class={styles.agentIcon}>
          <Art src={props.view.agent_icon} fallback={<span>{props.view.agent_name?.slice(0, 2) ?? "?"}</span>} />
        </span>
        <span class={styles.agentText}>
          <span class="overline">Played</span>
          <span class={styles.agentName}>{props.view.agent_name ?? "Unknown agent"}</span>
        </span>
      </div>
      <div class={styles.tiles} data-part="stat-tiles">
        <Tile label="K / D / A" index={0} accent>
          <span class="num">
            {stats().kills}/{stats().deaths}/{stats().assists}
          </span>
        </Tile>
        <Tile label="ACS" index={1}>
          <span class="num">{Math.round(stats().acs)}</span>
        </Tile>
        <Tile label="K/D" index={2}>
          <span class="num">{kd()}</span>
        </Tile>
        <Tile label="ADR" index={3}>
          <span class="num">{stats().adr === null ? "—" : Math.round(stats().adr ?? 0)}</span>
        </Tile>
        <Tile label="Headshot" index={4}>
          <span class="num">{stats().headshot_percent === null ? "—" : `${Math.round(stats().headshot_percent ?? 0)}%`}</span>
        </Tile>
        <Tile label="First bloods" index={5}>
          <span class="num">{stats().first_bloods}</span>
        </Tile>
        <Tile label="First deaths" index={6}>
          <span class="num">{stats().first_deaths}</span>
        </Tile>
      </div>
    </aside>
  );
}

function Row(props: { player: PostMatchPlayer; index: number }) {
  return (
    <li
      class={styles.row}
      data-part="scoreboard-row"
      data-self={props.player.is_self ? "" : undefined}
      data-side={props.player.is_ally ? "ally" : "enemy"}
      style={{ "--stagger": props.index, "--stack": stackColor(props.player.stack_group) }}
    >
      <span class={`${styles.place} num`}>{props.index + 1}</span>
      <span class={styles.rowAgent}>
        <Art src={props.player.agent_icon} fallback={<span>{props.player.agent_name?.slice(0, 2) ?? ""}</span>} />
      </span>
      <span class={styles.rowWho}>
        <span class={styles.rowName} data-sensitive data-hidden={props.player.game_name ? undefined : ""}>
          {playerName(props.player)}
          <Show when={props.player.tag_line}>
            <small>#{props.player.tag_line}</small>
          </Show>
        </span>
        <span class={styles.rowMeta}>
          {props.player.agent_name ?? ""}
          <Show when={partyLabel(props.player.stack_size)}>{(party) => <span class={styles.stack}>{party()}</span>}</Show>
        </span>
      </span>
      <span class={`${styles.cell} num`}>{props.player.kills}</span>
      <span class={`${styles.cell} num`}>{props.player.deaths}</span>
      <span class={`${styles.cell} num`}>{props.player.assists}</span>
      <span class={`${styles.cell} ${styles.acs} num`}>{Math.round(props.player.acs)}</span>
    </li>
  );
}

function Scoreboard(props: { players: PostMatchPlayer[] }) {
  return (
    <section class={styles.board} data-part="scoreboard">
      <div class={styles.columns} data-part="scoreboard-head">
        <span>#</span>
        <span />
        <span>Player</span>
        <span>K</span>
        <span>D</span>
        <span>A</span>
        <span>ACS</span>
      </div>
      <ol class={styles.rows} data-part="scoreboard-rows">
        <For each={props.players}>{(player, index) => <Row player={player} index={index()} />}</For>
      </ol>
    </section>
  );
}

function Banner(props: { view: PostMatchView; onContinue: () => void }) {
  return (
    <header class={styles.banner} data-part="post-match-banner">
      <span class={styles.context} data-part="match-context">
        <Show when={STYLE_CONTEXT[doc.theme.skin]}>{(heading) => <>{heading()} · </>}</Show>
        {props.view.queue_label} · {props.view.map_name}
      </span>
      <h1 class={styles.result} data-part="result-title">{(STYLE_RESULT[doc.theme.skin] ?? RESULT_LABEL)[props.view.result]}</h1>
      <div class={`${styles.score} num`} data-part="result-score">
        <b data-own>{props.view.rounds_won}</b>
        <span>:</span>
        <b>{props.view.rounds_lost}</b>
      </div>
      <Show when={props.view.rr_change !== null}>
        <span
          class={styles.rr}
          data-part="rr-chip"
          data-down={(props.view.rr_change ?? 0) < 0 ? "" : undefined}
          style={{ "--rank": rankColor(props.view.rank_after?.color ?? null) }}
        >
          <Show when={props.view.rank_after?.icon}>{(icon) => <img src={icon()} alt="" />}</Show>
          <b class="num">{signed(props.view.rr_change ?? 0)} RR</b>
          <Show when={props.view.rank_after}>{(rank) => <span>{rank().name}</span>}</Show>
        </span>
      </Show>
      <Show when={props.view.is_ranked && props.view.rr_change === null}>
        <span class={styles.rrPending}>RR update pending…</span>
      </Show>
      <button class={`${controls.button} ${styles.continue}`} data-part="play" onClick={() => props.onContinue()}>
        Continue
      </button>
    </header>
  );
}

function Summary(props: { view: PostMatchView; onContinue: () => void }) {
  return (
    <section
      class={styles.root}
      data-part="post-match"
      data-result={props.view.result}
      style={{ "--splash": props.view.map_splash ? `url("${props.view.map_splash}")` : "none" }}
    >
      <div class={styles.splash} aria-hidden="true" />
      <Banner view={props.view} onContinue={props.onContinue} />
      <div class={styles.body} data-part="post-match-body">
        <OwnPanel view={props.view} />
        <Scoreboard players={props.view.players} />
      </div>
    </section>
  );
}

/** A past match's summary, loaded by id, and the way back to where it was opened from. */
export function usePastMatch(matchId: () => string) {
  const navigate = useNavigate();
  const [view] = createResource(matchId, (id) => call("get_match_summary", { matchId: id }));
  // Opened from a row there is a page to return to; opened directly, Career is the closest.
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/career"));
  return { view, back };
}

/** A past match opened from the history; Continue goes back to where it was opened. */
function PastMatch(props: { matchId: string }) {
  const { view, back } = usePastMatch(() => props.matchId);
  return (
    <Switch>
      <Match when={view.error}>
        <Empty title="Match summary">
          {errorText(view.error)}{" "}
          <button class={controls.button} onClick={back}>
            Back
          </button>
        </Empty>
      </Match>
      <Match when={view()}>{(loaded) => <Summary view={loaded()} onContinue={back} />}</Match>
      <Match when={view.loading}>
        <Empty title="Match summary">Loading the match…</Empty>
      </Match>
    </Switch>
  );
}

export function PostMatchPiece(_props: PieceProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pastMatchId = () => new URLSearchParams(location.search).get("match");
  const close = () => {
    dismissPostMatch();
    navigate("/home");
  };
  return (
    <Show when={pastMatchId()} keyed fallback={
      <Show when={postMatch()} fallback={<Empty title="Match summary">Your result, stats and scoreboard appear here after a match.</Empty>}>
        {(view) => <Summary view={view()} onContinue={close} />}
      </Show>
    }>
      {(matchId) => <PastMatch matchId={matchId} />}
    </Show>
  );
}
