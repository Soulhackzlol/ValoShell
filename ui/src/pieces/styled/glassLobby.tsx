// Glass lobby: both teams as frosted columns of rounded player rows (agent, name, rank, RR, win
// rate, party stacks). It reads the standard live lobby (state/lobby) and keeps its rules: an
// incognito player stays "Hidden", a hidden rank stays hidden, and the enemy column only shows
// what the backend sends.
import { Index, Show } from "solid-js";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";
import type { RankBadge } from "~/bindings/RankBadge";
import type { PieceProps } from "~/studio/registry";
import { rankColor } from "~/pieces/home";
import { lobby } from "~/state/lobby";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { partyLabel, stackColor } from "~/ui/stacks";
import styles from "./glassLobby.module.css";

/** Tiers 0-2 are Unranked and two unused ones, so they carry no RR. */
const FIRST_RATED_TIER = 3;

function rankLabel(player: LobbyPlayerView, rank: RankBadge): string {
  if (player.is_rank_hidden) return "Hidden";
  return player.is_loaded ? rank.name : "…";
}

function RankChip(props: { player: LobbyPlayerView; rank: RankBadge; showRr: boolean }) {
  const hasRr = () => props.showRr && props.player.is_loaded && props.rank.tier >= FIRST_RATED_TIER;
  return (
    <span class={styles.rank} style={{ "--rank": rankColor(props.rank.color) }}>
      <Art src={props.rank.icon} fallback={<span class={styles.rankDot} />} />
      <span class={styles.rankName}>{rankLabel(props.player, props.rank)}</span>
      <Show when={hasRr()}>
        <small class="num">{props.player.rr} RR</small>
      </Show>
    </span>
  );
}

function PlayerRow(props: { player: LobbyPlayerView; index: number; isCompact: boolean }) {
  const player = () => props.player;
  return (
    <li
      class={styles.row}
      data-self={player().is_self ? "" : undefined}
      style={{ "--stack": stackColor(player().stack_group), "--i": props.index }}
    >
      <Art
        src={player().agent_icon}
        class={styles.agent}
        fallback={<span class={styles.agent}>{player().agent_name?.slice(0, 2) ?? ""}</span>}
      />
      <span class={styles.who}>
        <b data-sensitive>{player().game_name || (player().is_incognito ? "Hidden" : "—")}</b>
        <Show when={!props.isCompact}>
          <small>
            {player().agent_name ?? ""}
            <Show when={player().account_level !== null}> · LV {player().account_level}</Show>
            <Show when={player().stack_size > 1}> · {partyLabel(player().stack_size)}</Show>
          </small>
        </Show>
      </span>
      <RankChip player={player()} rank={player().rank} showRr />
      <Show when={!props.isCompact}>
        <span class={`${styles.win} num`}>
          {player().win_rate === null ? "—" : `${Math.round(player().win_rate ?? 0)}%`}
        </span>
      </Show>
    </li>
  );
}

interface TeamProps {
  title: string;
  players: LobbyPlayerView[];
  average: RankBadge | null;
  isCompact: boolean;
}

function TeamColumn(props: TeamProps) {
  return (
    <section class={styles.team}>
      <header class={styles.teamHead}>
        <b>{props.title}</b>
        <Show when={props.average}>
          {(average) => (
            <span style={{ "--rank": rankColor(average().color) }}>
              avg <b>{average().name}</b>
            </span>
          )}
        </Show>
      </header>
      <ol class={styles.rows}>
        <Index each={props.players}>
          {(player, index) => <PlayerRow player={player()} index={index} isCompact={props.isCompact} />}
        </Index>
      </ol>
    </section>
  );
}

export function GlassLobby(props: PieceProps) {
  const isCompact = () => props.piece.props["isCompact"] === true;
  return (
    <Show when={lobby()} fallback={<Empty title="Lobby">Everyone in your match appears here once one starts.</Empty>}>
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
            <TeamColumn
              title="Your team"
              players={view().allies}
              average={view().ally_average}
              isCompact={isCompact()}
            />
            <Show when={view().enemies.length > 0}>
              <TeamColumn
                title="Enemies"
                players={view().enemies}
                average={view().enemy_average}
                isCompact={isCompact()}
              />
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
