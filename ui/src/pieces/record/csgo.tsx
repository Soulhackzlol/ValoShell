// CS:GO career, after Panorama's player profile: the Competitive Skill Group card (emblem, rank,
// wins, the act peak) beside a recent-matches table in grey boxes under dark title strips, and
// the map wins underneath as small map tiles. Rows open the match summary.
import { For, Show } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { Art } from "~/ui/Art";
import { relativeDate } from "../career";
import { cssUrl } from "../pregame";
import { type MapLine, type RecordProps, outcome, signed } from "./shared";
import styles from "./csgo.module.css";

const RESULT = { win: "Win", loss: "Loss", draw: "Tie" } as const;
const MAP_TILES = 6;
/** RR runs 0-100 inside a rank, so the bar is a share of 100. */
const RR_PER_RANK = 100;

function SkillCard(props: RecordProps) {
  const isPlaced = () => props.view.placements_left === 0;
  return (
    <section class={styles.box}>
      <h3 class={styles.strip}>Competitive skill group</h3>
      <div class={styles.skill}>
        <Art src={props.view.rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
        <b class={styles.rank}>{isPlaced() ? props.view.rank.name : "Not yet ranked"}</b>
        <span class={styles.meter} style={{ "--fill": isPlaced() ? props.view.rr / RR_PER_RANK : 0 }} />
        <dl class={styles.facts}>
          <dt>Wins</dt>
          <dd class="num">{props.view.wins}</dd>
          <dt>Win rate</dt>
          <dd class="num">{props.stats.winRate}%</dd>
          <dt>Act peak</dt>
          <dd>{props.view.peak?.name ?? "—"}</dd>
          <Show when={!isPlaced()}>
            <dt>Placements</dt>
            <dd class="num">{props.view.placements_left} left</dd>
          </Show>
        </dl>
      </div>
    </section>
  );
}

function Matches(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  return (
    <section class={styles.box}>
      <h3 class={styles.strip}>
        Recent matches <small class="num">{signed(props.stats.net)} RR</small>
      </h3>
      <ol class={styles.rows}>
        <For each={props.view.updates}>
          {(update) => (
            <li {...rowProps(update.match_id)} class={styles.row} data-result={outcome(update)}>
              <Art src={update.map_image} class={styles.thumb} fallback={<span class={styles.thumb} />} />
              <span class={styles.where}>
                <b>{update.map_name}</b>
                <small>{relativeDate(update.started_at_ms)}</small>
              </span>
              <b class={styles.result}>{RESULT[outcome(update)]}</b>
              <span class="num">{signed(update.rr_earned)}</span>
              <Art src={update.rank_after.icon} class={styles.after} fallback={null} />
            </li>
          )}
        </For>
      </ol>
    </section>
  );
}

function MapWins(props: { maps: MapLine[] }) {
  return (
    <ol class={styles.maps}>
      <For each={props.maps.slice(0, MAP_TILES)}>
        {(map) => (
          <li class={styles.map} style={{ "--map": cssUrl(map.image) }}>
            <b>{map.name}</b>
            <span class="num">
              {map.wins} / {map.games} won
            </span>
          </li>
        )}
      </For>
    </ol>
  );
}

export function CsgoRecord(props: RecordProps) {
  return (
    <section class={styles.profile} data-own-frame>
      <div class={styles.top}>
        <SkillCard {...props} />
        <Matches {...props} />
      </div>
      <Show when={props.stats.maps.length > 0}>
        <MapWins maps={props.stats.maps} />
      </Show>
    </section>
  );
}
