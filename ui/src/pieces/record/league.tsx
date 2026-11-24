// League career, after the client's profile Ranked tab: the rank in a gold-framed panel (emblem,
// tier in roman numerals, LP, wins and losses, the last games as blue and red squares) beside a
// match history of Victory and Defeat rows with a coloured edge.
import { For } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { Art } from "~/ui/Art";
import { relativeDate } from "../career";
import { outcome, signed, type RecordProps } from "./shared";
import { romanRank } from "./trend";
import styles from "./league.module.css";

const RESULT = { win: "Victory", loss: "Defeat", draw: "Remake" } as const;

export function LeagueRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const isPlaced = () => props.view.placements_left === 0;
  return (
    <section class={styles.profile} data-own-frame>
      <section class={styles.ranked}>
        <h3 class={styles.queue}>Ranked Solo/Duo</h3>
        <Art src={props.view.rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
        <span class={styles.tier}>{romanRank(props.view.rank.name)}</span>
        <span class={styles.lp}>{isPlaced() ? `${props.view.rr} LP` : `${props.view.placements_left} placement games left`}</span>
        <span class={styles.record}>
          {props.view.wins}W {props.stats.losses}L<small>{props.stats.winRate}% win rate</small>
        </span>
        <div class={styles.recent} aria-label={`Last ${props.stats.recent} games`}>
          <For each={props.view.updates}>{(update) => <i data-result={outcome(update)} />}</For>
        </div>
        <span class={styles.peak}>Act peak: {props.view.peak ? romanRank(props.view.peak.name) : "—"}</span>
      </section>
      <section class={styles.history}>
        <h3 class={styles.heading}>
          Match history <small>{signed(props.stats.net)} LP over {props.stats.recent} games</small>
        </h3>
        <ol class={styles.rows}>
          <For each={props.view.updates}>
            {(update) => (
              <li {...rowProps(update.match_id)} class={styles.row} data-result={outcome(update)}>
                <span class={styles.result}>
                  <b>{RESULT[outcome(update)]}</b>
                  <small>Ranked Solo/Duo</small>
                </span>
                <Art src={update.map_image} class={styles.map} fallback={<span class={styles.map} />} />
                <span class={styles.where}>
                  <b>{update.map_name}</b>
                  <small>{relativeDate(update.started_at_ms)}</small>
                </span>
                <span class={styles.after}>{romanRank(update.rank_after.name)}</span>
                <span class={styles.delta}>{signed(update.rr_earned)} LP</span>
              </li>
            )}
          </For>
        </ol>
      </section>
    </section>
  );
}
