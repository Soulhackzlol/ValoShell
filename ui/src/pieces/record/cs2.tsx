// CS2 career, after the Premier screen: the rating badge (the CS2 Rank look's number, made from
// rank and RR) with your record, the rating graph across recent ranked games with each game a
// green or red dot, and a maps table with win-rate bars. Dots open the match summary.
import { For, Show, createMemo } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { UNRATED_BAND, bandColor, cs2Rating, isRated, ratingHistory, ratingParts } from "../styled/cs2Rating";
import { type RecordProps, outcome, signed } from "./shared";
import { chartPath, chartPoints } from "./trend";
import styles from "./cs2.module.css";

const CHART = { width: 600, height: 140, pad: 14 };
const MAP_ROWS = 6;

function Badge(props: RecordProps) {
  const rating = () => cs2Rating(props.view.rank.tier, props.view.rr);
  const isOn = () => isRated(props.view);
  return (
    <section class={styles.hero} style={{ "--band": isOn() ? bandColor(rating()) : UNRATED_BAND }}>
      <span class={styles.kicker}>Premier rating</span>
      <div class={styles.badge}>
        <span class={styles.stripes} />
        <span class={`${styles.value} num`}>
          <Show when={isOn()} fallback={<b>---</b>}>
            <b>{ratingParts(rating())[0]}</b>
            <small>{ratingParts(rating())[1]}</small>
          </Show>
        </span>
      </div>
      <dl class={styles.record}>
        <dt>Wins</dt>
        <dd class="num">{props.view.wins}</dd>
        <dt>Losses</dt>
        <dd class="num">{props.stats.losses}</dd>
        <dt>Win rate</dt>
        <dd class="num">{props.stats.winRate}%</dd>
      </dl>
    </section>
  );
}

function RatingGraph(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const points = createMemo(() => chartPoints(ratingHistory(props.view.updates), CHART));
  /** Each dot with its game: the graph runs oldest first, the history newest first. */
  const marks = createMemo(() => {
    const games = [...props.view.updates].reverse();
    return points().flatMap((point, index) => {
      const game = games[index];
      return game ? [{ point, game }] : [];
    });
  });
  return (
    <section class={`${styles.panel} ${styles.graphPanel}`}>
      <h3 class={styles.heading}>
        Rating history{" "}
        <small class="num">
          {signed(props.stats.net)} RR over {props.stats.recent} games
        </small>
      </h3>
      <svg class={styles.graph} viewBox={`0 0 ${CHART.width} ${CHART.height}`} preserveAspectRatio="none">
        <path class={styles.area} d={chartPath(points(), CHART.height, true)} />
        <path class={styles.line} d={chartPath(points(), CHART.height)} vector-effect="non-scaling-stroke" />
      </svg>
      <div class={styles.dots}>
        <For each={marks()}>
          {(mark) => (
            <span
              {...rowProps(mark.game.match_id)}
              class={styles.dot}
              data-result={outcome(mark.game)}
              title={`${mark.game.map_name} ${signed(mark.game.rr_earned)} RR`}
              style={{ left: `${(mark.point.x / CHART.width) * 100}%`, top: `${(mark.point.y / CHART.height) * 100}%` }}
            />
          )}
        </For>
      </div>
    </section>
  );
}

function Maps(props: RecordProps) {
  return (
    <section class={`${styles.panel} ${styles.mapsPanel}`}>
      <h3 class={styles.heading}>Maps</h3>
      <ol class={styles.maps}>
        <For each={props.stats.maps.slice(0, MAP_ROWS)}>
          {(map) => (
            <li class={styles.mapRow} style={{ "--rate": map.games > 0 ? map.wins / map.games : 0 }}>
              <b>{map.name}</b>
              <span class={styles.rateBar} />
              <span class="num">
                {map.wins}–{map.games - map.wins}
              </span>
              <span class="num">{signed(map.net)}</span>
            </li>
          )}
        </For>
      </ol>
    </section>
  );
}

export function Cs2Record(props: RecordProps) {
  return (
    <section class={styles.premier} data-own-frame>
      <Badge {...props} />
      <RatingGraph {...props} />
      <Maps {...props} />
    </section>
  );
}
