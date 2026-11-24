// Night City career, after Cyberpunk 2077's character screen: Level and Street Cred as the two
// progress bars along the top (rank with its RR, wins with the win rate), the act's numbers as
// attribute boxes, and recent ranked games as a gig log of completed and failed contracts.
import { For, Show } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { Art } from "~/ui/Art";
import { relativeDate } from "../career";
import { type MapLine, outcome, signed, type RecordProps } from "./shared";
import styles from "./nightcity.module.css";

/** Districts listed before the panel scrolls; the most played first. */
const DISTRICTS = 6;
const CONTRACT = { win: "Contract complete", loss: "Contract failed", draw: "Contract voided" } as const;

function Meter(props: { label: string; value: string; progress: number; note: string }) {
  return (
    <div class={styles.meter}>
      <span class={styles.meterLabel}>{props.label}</span>
      <b class={styles.meterValue}>{props.value}</b>
      <span class={styles.meterBar}>
        <i style={{ width: `${Math.round(Math.min(1, Math.max(0, props.progress)) * 100)}%` }} />
      </span>
      <small class={styles.meterNote}>{props.note}</small>
    </div>
  );
}

function Attribute(props: { name: string; value: string; order: number }) {
  return (
    <div class={styles.attribute} style={{ "--order": props.order }}>
      <b>{props.value}</b>
      <span>{props.name}</span>
    </div>
  );
}

/** Each map as a district: gigs won of gigs taken, as a bar, and the RR it paid. */
function Districts(props: { maps: MapLine[] }) {
  return (
    <section class={styles.districts}>
      <h3 class={styles.logTitle}>Districts</h3>
      <ul class={styles.districtList}>
        <For each={props.maps.slice(0, DISTRICTS)}>
          {(map) => (
            <li class={styles.district}>
              <span class={styles.districtName}>{map.name}</span>
              <span class={styles.districtBar}>
                <i style={{ width: `${Math.round((map.wins / Math.max(1, map.games)) * 100)}%` }} />
              </span>
              <span class={styles.districtCount}>
                {map.wins}/{map.games}
              </span>
              <span class={styles.districtNet} data-sign={map.net < 0 ? "neg" : "pos"}>
                {signed(map.net)}
              </span>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

export function NightCityRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const isPlaced = () => props.view.placements_left === 0;
  return (
    <section class={styles.sheet} data-own-frame>
      <header class={styles.head}>
        <Art src={props.view.rank.icon} class={styles.emblem} fallback={<span class={styles.emblem} />} />
        <Meter
          label="Level"
          value={props.view.rank.name}
          progress={isPlaced() ? props.view.rr / 100 : 0}
          note={isPlaced() ? `${props.view.rr} / 100 RR` : `${props.view.placements_left} placement gigs left`}
        />
        <Meter label="Street cred" value={`${props.view.wins}`} progress={props.stats.winRate / 100} note={`${props.stats.winRate}% of ${props.view.games} gigs won`} />
      </header>
      <div class={styles.attributes}>
        <Attribute name="Gigs" value={`${props.view.games}`} order={0} />
        <Attribute name="Won" value={`${props.view.wins}`} order={1} />
        <Attribute name="Best gig" value={signed(props.stats.best)} order={2} />
        <Attribute name="Worst" value={signed(props.stats.worst)} order={3} />
        <Attribute name="Streak" value={props.stats.streak ? `${props.stats.streak.isWin ? "W" : "L"}${props.stats.streak.length}` : "--"} order={4} />
      </div>
      <Districts maps={props.stats.maps} />
      <section class={styles.log}>
        <h3 class={styles.logTitle}>
          Gig log <small>{signed(props.stats.net)} RR over {props.stats.recent}</small>
        </h3>
        <ol class={styles.rows}>
          <For each={props.view.updates}>
            {(update, index) => (
              <li {...rowProps(update.match_id)} class={styles.row} data-result={outcome(update)} style={{ "--order": index() }}>
                <Art src={update.map_image} class={styles.map} fallback={<span class={styles.map} />} />
                <span class={styles.rowText}>
                  <b>{update.map_name}</b>
                  <small>{CONTRACT[outcome(update)]}</small>
                </span>
                <span class={styles.when}>
                  <Show when={update.is_promotion || update.is_demotion}>
                    <em>{update.is_promotion ? "Rank up" : "Rank down"} · </em>
                  </Show>
                  {relativeDate(update.started_at_ms)}
                </span>
                <span class={styles.delta}>{signed(update.rr_earned)}</span>
              </li>
            )}
          </For>
        </ol>
      </section>
    </section>
  );
}
