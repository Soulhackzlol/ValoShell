// VALORANT 2022 career: navy and red, tall condensed caps. A tall rank column (big emblem,
// rank rating bar, the act-rank triangle filled with this act's wins) beside the match-history
// strip of VICTORY / DEFEAT rows.
import { For, Show, createMemo } from "solid-js";
import { Art } from "~/ui/Art";
import { rankColor } from "../home";
import { relativeDate } from "../career";
import { outcome, signed, useCountUp, type RecordProps } from "./shared";
import styles from "./valnow.module.css";
import { useOpenMatch } from "~/menu/openMatch";

const ROWS = 7;
const SIDE = 10;
const HEIGHT = (SIDE * Math.sqrt(3)) / 2;

interface Pip {
  points: string;
  order: number;
}

/** The act-rank triangle: ROWS rows of small triangles, filled bottom row first. */
function actPips(): Pip[] {
  const pips: Pip[] = [];
  let order = 0;
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    const x0 = ((ROWS - 1 - row) * SIDE) / 2;
    const top = row * HEIGHT;
    const bottom = top + HEIGHT;
    for (let k = 0; k < row * 2 + 1; k += 1) {
      const j = Math.floor(k / 2);
      const left = x0 + j * SIDE;
      const points =
        k % 2 === 0
          ? `${left},${bottom} ${left + SIDE},${bottom} ${left + SIDE / 2},${top}`
          : `${left + SIDE / 2},${top} ${left + SIDE * 1.5},${top} ${left + SIDE},${bottom}`;
      pips.push({ points, order: order++ });
    }
  }
  return pips;
}

const PIPS = actPips();

function RankEmblem(props: { color: string }) {
  return (
    <svg class={styles.emblemSvg} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="valnow-gem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.9" />
          <stop offset="0.45" stop-color={props.color} />
          <stop offset="1" stop-color={props.color} stop-opacity="0.35" />
        </linearGradient>
      </defs>
      <polygon points="50,6 88,36 74,90 26,90 12,36" fill="url(#valnow-gem)" />
      <polygon points="50,6 64,40 50,90 36,40" fill="#ffffff" opacity="0.18" />
      <polyline points="12,36 36,40 50,6 64,40 88,36" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.2" />
      <polyline points="26,90 36,40 64,40 74,90" fill="none" stroke="#0f1923" stroke-opacity="0.4" stroke-width="1.2" />
    </svg>
  );
}

export function ValnowRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const color = () => rankColor(props.view.rank.color);
  const rr = useCountUp(() => props.view.rr, 300, 900);
  const filled = createMemo(() => Math.min(PIPS.length, props.view.wins));
  return (
    <section class={styles.career} style={{ "--rank": color() }}>
      <aside class={styles.rankColumn}>
        <span class={styles.kicker}>Competitive</span>
        <div class={styles.emblem}>
          <span class={styles.glow} />
          <Art src={props.view.rank.icon} fallback={<RankEmblem color={color()} />} />
        </div>
        <span class={styles.rankName}>{props.view.rank.name}</span>
        <Show
          when={props.view.placements_left === 0}
          fallback={<span class={styles.label}>{props.view.placements_left} placement matches remaining</span>}
        >
          <div class={styles.ratingRow}>
            <span class={styles.label}>Rank rating</span>
            <span class={styles.rating}>
              {rr()}
              <small>/100</small>
            </span>
          </div>
          <div class={styles.ratingBar}>
            <span class={styles.ratingFill} style={{ width: `${Math.min(100, props.view.rr)}%` }} />
          </div>
        </Show>

        <div class={styles.facts}>
          <span class={styles.fact} style={{ "--stagger": 0 }}>
            <span class={styles.label}>Matches</span>
            <b>{props.view.games}</b>
          </span>
          <span class={styles.fact} style={{ "--stagger": 1 }}>
            <span class={styles.label}>Win rate</span>
            <b>{props.stats.winRate}%</b>
          </span>
          <span class={styles.fact} style={{ "--stagger": 2 }}>
            <span class={styles.label}>Best game</span>
            <b data-sign="pos">{signed(props.stats.best)}</b>
          </span>
          <span class={styles.fact} style={{ "--stagger": 3 }}>
            <span class={styles.label}>Worst game</span>
            <b data-sign="neg">{signed(props.stats.worst)}</b>
          </span>
        </div>

        <div class={styles.act}>
          <svg class={styles.triangle} viewBox={`-1 -1 ${ROWS * SIDE + 2} ${ROWS * HEIGHT + 2}`} aria-label={`${props.view.wins} wins this act`}>
            <For each={PIPS}>
              {(pip) => (
                <polygon
                  points={pip.points}
                  class={styles.pip}
                  data-on={pip.order < filled() ? "" : undefined}
                  style={{ "--stagger": pip.order }}
                />
              )}
            </For>
          </svg>
          <div class={styles.actText}>
            <span class={styles.label}>Act rank</span>
            <span class={styles.actName}>{props.view.peak?.name ?? props.view.rank.name}</span>
            <span class={styles.actWins}>
              <b>{props.view.wins}</b> wins this act
              <Show when={props.view.leaderboard_rank > 0}>
                {" "}· leaderboard <b>#{props.view.leaderboard_rank}</b>
              </Show>
            </span>
          </div>
        </div>
      </aside>

      <div class={styles.historyColumn}>
        <nav class={styles.tabs}>
          <span data-active>Match history</span>
          <span>Overview</span>
          <span>Agents</span>
        </nav>
        <div class={styles.summary}>
          <span>
            Last {props.stats.recent}
            <b>
              {props.stats.recentWins}W {props.stats.recent - props.stats.recentWins}L
            </b>
          </span>
          <span>
            Net RR <b data-sign={props.stats.net < 0 ? "neg" : "pos"}>{signed(props.stats.net)}</b>
          </span>
          <Show when={props.stats.streak}>
            {(streak) => (
              <span>
                Streak <b>{streak().isWin ? `W${streak().length}` : `L${streak().length}`}</b>
              </span>
            )}
          </Show>
        </div>
        <ol class={styles.matches}>
          <For each={props.view.updates}>
            {(update, index) => (
              <li {...rowProps(update.match_id)} class={styles.match} data-result={outcome(update)} style={{ "--stagger": index() }}>
                <span class={styles.mapArt}>
                  <Art src={update.map_image} fallback={<span class={styles.mapInitial}>{update.map_name.slice(0, 2)}</span>} />
                </span>
                <span class={styles.result}>{{ win: "Victory", loss: "Defeat", draw: "Draw" }[outcome(update)]}</span>
                <span class={styles.mapText}>
                  <span class={styles.mapName}>{update.map_name}</span>
                  <span class={styles.when}>{relativeDate(update.started_at_ms)}</span>
                </span>
                <span class={styles.after}>
                  <Show when={update.is_promotion || update.is_demotion}>
                    <em data-up={update.is_promotion ? "" : undefined} title={update.is_promotion ? "Rank up" : "Rank down"}>
                      {update.is_promotion ? "▲" : "▼"}
                    </em>
                  </Show>
                  {update.rank_after.name}
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
