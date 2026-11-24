// Phantom career, after Persona 5: the rank as a ransom note, the act as the Social Stats star
// (five stats as levels on a red radar, a ring of white paper behind it), and recent ranked games
// as the calendar's days, each a slanted date with its weekday tag and a WIN or LOSS stamp.
import { For, Index } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { RansomText } from "../styled/phantom";
import { outcome, signed, type RecordProps, type RecordStats } from "./shared";
import { calendarDay, radarPoints } from "./trend";
import styles from "./phantom.module.css";

const LEVELS = 5;
const RADAR = { radius: 38, center: 50 };
/** What fills a stat: a 30 RR game is a perfect "best", five straight wins a perfect streak. */
const BEST_GAME_RR = 30;
const FULL_STREAK = 5;
const FULL_GAMES = 100;

interface Stat {
  name: string;
  /** 0..1 of the way to the top level. */
  share: number;
}

function socialStats(view: RecordProps["view"], stats: RecordStats): Stat[] {
  const streak = stats.streak?.isWin ? stats.streak.length : 0;
  return [
    { name: "Rank rating", share: view.rr / 100 },
    { name: "Win rate", share: stats.winRate / 100 },
    { name: "Best game", share: stats.best / BEST_GAME_RR },
    { name: "Streak", share: streak / FULL_STREAK },
    { name: "Games", share: view.games / FULL_GAMES },
  ];
}

/** Level 1..5, as the game counts social stats; never 0, everyone starts somewhere. */
function levelOf(share: number): number {
  return Math.max(1, Math.min(LEVELS, Math.ceil(share * LEVELS)));
}

function Star(props: { stats: Stat[] }) {
  const full = () => props.stats.map(() => 1);
  return (
    <div class={styles.starBox}>
      <svg class={styles.star} viewBox="0 0 100 100" aria-hidden="true">
        <circle class={styles.paper} cx={RADAR.center} cy={RADAR.center} r={RADAR.radius + 8} />
        <polygon class={styles.frame} points={radarPoints(full(), RADAR.radius, RADAR.center)} />
        <polygon class={styles.fill} points={radarPoints(props.stats.map((stat) => levelOf(stat.share) / LEVELS), RADAR.radius, RADAR.center)} />
      </svg>
      <Index each={props.stats}>
        {(stat, index) => (
          <span class={styles.statLabel} data-at={index}>
            {stat().name}
            <b>Lv {levelOf(stat().share)}</b>
          </span>
        )}
      </Index>
    </div>
  );
}

export function PhantomRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  return (
    <section class={styles.record} data-own-frame>
      <header class={styles.head}>
        <span class={styles.kicker}>Social stats</span>
        <RansomText text={props.view.rank.name} class={styles.rank} />
        <span class={styles.facts}>
          {props.view.wins} wins · {props.view.games} games · {props.view.rr} RR
        </span>
      </header>
      <Star stats={socialStats(props.view, props.stats)} />
      <ol class={styles.calendar}>
        <For each={props.view.updates}>
          {(update) => {
            const day = calendarDay(update.started_at_ms);
            return (
              <li {...rowProps(update.match_id)} class={styles.day} data-result={outcome(update)}>
                <span class={styles.date}>
                  {day.month}/{day.day}
                </span>
                <span class={styles.weekday}>{day.weekday}</span>
                <span class={styles.map}>{update.map_name}</span>
                <span class={styles.stamp}>{{ win: "Win", loss: "Loss", draw: "Draw" }[outcome(update)]}</span>
                <span class={styles.delta}>{signed(update.rr_earned)}</span>
              </li>
            );
          }}
        </For>
      </ol>
    </section>
  );
}
