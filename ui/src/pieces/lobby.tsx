// The live lobby table: both teams with agent, rank, RR, peak, win rate, level and party
// stacks. Rows fill in as ranks arrive; after the match it stays as "last match".
import { Index, Show, type JSX } from "solid-js";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";
import type { RankBadge } from "~/bindings/RankBadge";
import type { PieceProps } from "~/studio/registry";
import { lobby } from "~/state/lobby";
import { Art } from "~/ui/Art";
import { partyLabel, stackColor } from "~/ui/stacks";
import { Empty } from "~/ui/controls";
import { rankColor } from "./home";
import styles from "./lobby.module.css";


function Rank(props: { rank: RankBadge; rr?: number; isLoaded: boolean; isHidden: boolean }) {
  const isPending = () => !props.isLoaded && !props.isHidden;
  return (
    <span class={styles.rank} style={{ "--rank": rankColor(props.rank.color) }} data-loading={isPending() ? "" : undefined}>
      <Art src={props.rank.icon} fallback={<span class={styles.rankDot} />} />
      <span class={styles.rankName}>{props.isHidden ? "Hidden" : props.isLoaded ? props.rank.name : "…"}</span>
      <Show when={props.rr !== undefined && props.isLoaded && props.rank.tier > 2}>
        <span class={`${styles.rr} num`}>{props.rr}</span>
      </Show>
    </span>
  );
}

function Row(props: { player: LobbyPlayerView; index: number; isCompact: boolean }): JSX.Element {
  return (
    <li
      class={styles.row}
      data-self={props.player.is_self ? "" : undefined}
      style={{ "--stack": stackColor(props.player.stack_group), "--stagger": props.index }}
    >
      <span class={styles.agent}>
        <Art src={props.player.agent_icon} fallback={<span>{props.player.agent_name?.slice(0, 2) ?? ""}</span>} />
      </span>
      <span class={styles.who}>
        <span class={styles.name} data-sensitive>
          {props.player.game_name || (props.player.is_incognito ? "Hidden" : "—")}
          <Show when={props.player.stack_size > 1}>
            <span class={styles.stack}>{partyLabel(props.player.stack_size)}</span>
          </Show>
        </span>
        <Show when={!props.isCompact}>
          <span class={styles.meta}>
            <Show when={props.player.agent_name}>{(agent) => <span>{agent()}</span>}</Show>
            <Show when={props.player.account_level !== null}>
              <span class="num">LV {props.player.account_level}</span>
            </Show>
          </span>
        </Show>
      </span>
      <Rank rank={props.player.rank} rr={props.player.rr} isLoaded={props.player.is_loaded} isHidden={props.player.is_rank_hidden} />
      <Show when={!props.isCompact}>
        <Rank rank={props.player.peak} isLoaded={props.player.is_loaded} isHidden={props.player.is_rank_hidden} />
        <span class={`${styles.stat} num`}>
          {props.player.win_rate === null ? "—" : `${Math.round(props.player.win_rate)}%`}
          <small>{props.player.games > 0 ? `${props.player.games}g` : ""}</small>
        </span>
      </Show>
    </li>
  );
}

function Team(props: { title: string; players: LobbyPlayerView[]; average: RankBadge | null; side: "ally" | "enemy"; isCompact: boolean }) {
  return (
    <section class={styles.team} data-side={props.side}>
      <header class={styles.teamHead}>
        <span class={styles.teamTitle}>{props.title}</span>
        <Show when={props.average}>
          {(average) => (
            <span class={styles.average} style={{ "--rank": rankColor(average().color) }}>
              avg <b>{average().name}</b>
            </span>
          )}
        </Show>
      </header>
      <Show when={!props.isCompact}>
        <div class={styles.columns}>
          <span />
          <span>Player</span>
          <span>Rank</span>
          <span>Peak</span>
          <span>Win</span>
        </div>
      </Show>
      <ol class={styles.rows} data-compact={props.isCompact ? "" : undefined}>
        <Index each={props.players}>
          {(player, index) => <Row player={player()} index={index} isCompact={props.isCompact} />}
        </Index>
      </ol>
    </section>
  );
}

export function LobbyTable(props: PieceProps) {
  const isCompact = () => props.piece.props["isCompact"] === true;
  return (
    <Show when={lobby()} fallback={<Empty title="Live lobby">Ranks of everyone in your match appear here during agent select and in game.</Empty>}>
      {(view) => (
        <div class={styles.lobby}>
          <header class={styles.header}>
            <span class={styles.live} data-live={view().is_live ? "" : undefined}>
              {view().is_live ? (view().is_pregame ? "Agent select" : "Live") : "Last match"}
            </span>
            <span class={styles.title}>
              {view().map_name} · {view().queue_label}
            </span>
            <Show when={!view().is_complete}>
              <span class={styles.loading}>Loading ranks…</span>
            </Show>
          </header>
          <div class={styles.teams}>
            <Team title="Your team" players={view().allies} average={view().ally_average} side="ally" isCompact={isCompact()} />
            <Show when={view().enemies.length > 0}>
              <Team title="Enemies" players={view().enemies} average={view().enemy_average} side="enemy" isCompact={isCompact()} />
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
