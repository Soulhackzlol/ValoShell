// Halo 3 Service Record: the player's emblem and gamertag over frosted panels, the rank
// insignia, an EXP-style rank bar, a grid of career totals and the classic recent-games list.
import { For, Show } from "solid-js";
import { Art } from "~/ui/Art";
import { rankColor } from "../home";
import { relativeDate } from "../career";
import { division, groupIndex, identity, nextRankName, outcome, signed, useCountUp, type RecordProps } from "./shared";
import styles from "./halo.module.css";
import { useOpenMatch } from "~/menu/openMatch";

/** A Halo-style emblem: a dark tile, a hexagon in the rank colour and a white chevron. */
function Emblem(props: { color: string }) {
  return (
    <svg class={styles.emblem} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" fill="#0b2340" />
      <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" fill={props.color} opacity="0.9" />
      <polygon points="32,12 49,22 49,42 32,52 15,42 15,22" fill="none" stroke="#0b2340" stroke-width="2" />
      <path d="M19 24 L32 40 L45 24 L39 24 L32 33 L25 24 Z" fill="#ffffff" />
    </svg>
  );
}

/** Rank insignia in the Halo 3 manner: a shield with one chevron per division, stars above. */
function Insignia(props: { tier: number; color: string }) {
  const group = () => groupIndex(props.tier);
  const chevrons = () => Math.max(1, division(props.tier));
  const stars = () => Math.max(0, group() - 5);
  // Bottom chevron's tip, so the stack sits in the middle of the shield.
  const base = () => 28 + ((chevrons() - 1) * 11) / 2 + (stars() > 0 ? 4 : 0);
  const chevron = (tip: number) => `M16 ${tip + 10} L32 ${tip} L48 ${tip + 10} L48 ${tip + 17} L32 ${tip + 7} L16 ${tip + 17} Z`;
  return (
    <svg class={styles.insignia} viewBox="0 0 64 72" aria-hidden="true">
      <path d="M32 4 L58 14 L58 38 C58 54 46 64 32 69 C18 64 6 54 6 38 L6 14 Z" fill="#081a30" stroke={props.color} stroke-width="3" />
      <For each={Array.from({ length: chevrons() }, (_, index) => index)}>
        {(index) => (
          <path
            d={chevron(base() - index * 11)}
            fill={props.color}
          />
        )}
      </For>
      <For each={Array.from({ length: stars() }, (_, index) => index)}>
        {(index) => (
          <polygon
            transform={`translate(${32 + (index - (stars() - 1) / 2) * 12} 14) scale(0.5)`}
            points="0,-10 3,-3 10,-3 4,2 6,10 0,5 -6,10 -4,2 -10,-3 -3,-3"
            fill="#ffffff"
          />
        )}
      </For>
    </svg>
  );
}

export function HaloRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const me = identity;
  const color = () => rankColor(props.view.rank.color);
  const rr = useCountUp(() => props.view.rr, 300);
  const games = useCountUp(() => props.view.games, 200);
  const wins = useCountUp(() => props.view.wins, 260);
  const losses = useCountUp(() => props.stats.losses, 320);
  const winRate = useCountUp(() => props.stats.winRate, 380);
  const net = useCountUp(() => props.stats.net, 440);
  const serviceTag = () => (me().tag || me().name).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "VL";
  return (
    <section class={styles.record} style={{ "--rank": color() }}>
      <header class={`${styles.panel} ${styles.head}`} style={{ "--stagger": 0 }}>
        <Emblem color={color()} />
        <div class={styles.identity}>
          <span class={styles.overline}>Service Record</span>
          <span class={styles.gamertag} data-sensitive>
            {me().name}
          </span>
          <span class={styles.tagline}>
            Service Tag <b>{serviceTag()}</b>
            <Show when={me().level !== null}>
              <span class={styles.dot} />
              Level <b>{me().level}</b>
            </Show>
          </span>
        </div>
        <div class={styles.rankBlock}>
          <span class={styles.insigniaWrap}>
            <Art src={props.view.rank.icon} class={styles.rankIcon} fallback={<Insignia tier={props.view.rank.tier} color={color()} />} />
          </span>
          <span class={styles.rankText}>
            <span class={styles.overline}>Rank</span>
            <span class={styles.rankName}>{props.view.rank.name}</span>
            <Show when={props.view.peak}>{(peak) => <span class={styles.peak}>Highest skill {peak().name}</span>}</Show>
          </span>
        </div>
      </header>

      <div class={styles.body}>
        <div class={styles.column}>
          <section class={styles.panel} style={{ "--stagger": 1 }}>
            <h3 class={styles.section}>Ranked Progress</h3>
            <Show
              when={props.view.placements_left === 0}
              fallback={<p class={styles.note}>{props.view.placements_left} placement games until your rank is shown.</p>}
            >
              <div class={styles.expRow}>
                <span class={styles.expLabel}>Rank rating</span>
                <span class={styles.expValue}>
                  {rr()}
                  <small>/100</small>
                </span>
              </div>
              <div class={styles.exp}>
                <span class={styles.expFill} style={{ width: `${Math.min(100, props.view.rr)}%` }} />
                <span class={styles.expTicks} />
              </div>
              <span class={styles.note}>
                {Math.max(0, 100 - props.view.rr)} RR to <b>{nextRankName(props.view.rank.tier)}</b>
              </span>
            </Show>
          </section>
          <section class={`${styles.panel} ${styles.grow}`} style={{ "--stagger": 2 }}>
            <h3 class={styles.section}>Career Totals</h3>
            <div class={styles.grid}>
              <Stat label="Ranked games" value={games()} index={0} />
              <Stat label="Victories" value={wins()} index={1} />
              <Stat label="Defeats" value={losses()} index={2} />
              <Stat label="Win percent" value={`${winRate()}%`} index={3} />
              <Stat label="Recent RR" value={signed(net())} index={4} />
              <Stat
                label={props.stats.streak?.isWin === false ? "Losing streak" : "Win streak"}
                value={props.stats.streak?.length ?? 0}
                index={5}
              />
            </div>
          </section>
        </div>

        <section class={`${styles.panel} ${styles.games}`} style={{ "--stagger": 3 }}>
          <h3 class={styles.section}>Recent Games</h3>
          <div class={`${styles.row} ${styles.rowHead}`}>
            <span>Map</span>
            <span>Date</span>
            <span>Result</span>
            <span class={styles.right}>RR</span>
          </div>
          <ol class={styles.list}>
            <For each={props.view.updates}>
              {(update, index) => (
                <li {...rowProps(update.match_id)} class={styles.row} data-result={outcome(update)} style={{ "--stagger": index() }}>
                  <span class={styles.map}>
                    {update.map_name}
                    <Show when={update.is_promotion || update.is_demotion}>
                      <em>{update.is_promotion ? "Promoted" : "Demoted"}</em>
                    </Show>
                  </span>
                  <span class={styles.dim}>{relativeDate(update.started_at_ms)}</span>
                  <span class={styles.result}>{{ win: "Victory", loss: "Defeat", draw: "Draw" }[outcome(update)]}</span>
                  <span class={`${styles.delta} ${styles.right}`}>{signed(update.rr_earned)}</span>
                </li>
              )}
            </For>
          </ol>
        </section>
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: string | number; index: number }) {
  return (
    <div class={styles.stat} style={{ "--stagger": props.index }}>
      <span class={styles.statLabel}>{props.label}</span>
      <span class={styles.statValue}>{props.value}</span>
    </div>
  );
}
