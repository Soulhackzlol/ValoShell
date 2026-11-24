// Fortnite career: a chunky italic CAREER header, the big level badge beside a battle-pass
// style RR bar, the rank as a rarity tile, stat blocks, and the latest games as item-shop
// tiles coloured by rarity (a promotion is Legendary, a big win Epic, a loss Common).
import { For, Show } from "solid-js";
import type { RrUpdate } from "~/bindings/RrUpdate";
import { Art } from "~/ui/Art";
import { rankColor } from "../home";
import { relativeDate } from "../career";
import { identity, nextRankName, signed, useCountUp, type RecordProps } from "./shared";
import styles from "./fortnite.module.css";
import { useOpenMatch } from "~/menu/openMatch";

type Rarity = "legendary" | "epic" | "rare" | "uncommon" | "common";

function rarity(update: RrUpdate): Rarity {
  if (update.is_promotion) return "legendary";
  if (update.rr_earned >= 20) return "epic";
  if (update.rr_earned >= 10) return "rare";
  if (update.rr_earned > 0) return "uncommon";
  return "common";
}

export function FortniteRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const level = () => identity().level ?? props.view.rank.tier;
  const shownLevel = useCountUp(level, 150, 1100);
  const rr = useCountUp(() => props.view.rr, 400, 900);
  const wins = useCountUp(() => props.view.wins, 500);
  const games = useCountUp(() => props.view.games, 560);
  const winRate = useCountUp(() => props.stats.winRate, 620);
  const color = () => rankColor(props.view.rank.color);
  return (
    <section class={styles.career}>
      <header class={styles.head}>
        <span class={styles.kicker}>Competitive · This act</span>
        <h2 class={styles.title}>Career</h2>
      </header>

      <div class={styles.top}>
        <div class={styles.pass}>
          <div class={styles.badge}>
            <span>Level</span>
            <b>{shownLevel()}</b>
          </div>
          <div class={styles.progress}>
            <div class={styles.progressText}>
              <span class={styles.progressRank}>{props.view.rank.name}</span>
              <span>
                <b>{rr()}</b> / 100 RR
              </span>
            </div>
            <div class={styles.bar}>
              <span class={styles.fill} style={{ width: `${Math.min(100, props.view.rr)}%` }} />
            </div>
            <span class={styles.next}>
              <Show when={props.view.placements_left === 0} fallback={`${props.view.placements_left} placement matches left`}>
                Next reward: <b>{nextRankName(props.view.rank.tier)}</b> in {Math.max(0, 100 - props.view.rr)} RR
              </Show>
            </span>
          </div>
        </div>

        <div class={styles.rankTile} style={{ "--rank": color() }}>
          <span class={styles.rays} />
          <span class={styles.rankArt}>
            <Art src={props.view.rank.icon} fallback={<span class={styles.rankGem} />} />
          </span>
          <span class={styles.rankStrip}>
            <span class={styles.rankLabel}>{props.view.rank.name}</span>
            <span class={styles.rankRarity}>Current rank</span>
          </span>
        </div>
      </div>

      <div class={styles.stats}>
        <Stat label="Wins" value={`${wins()}`} index={0} />
        <Stat label="Matches" value={`${games()}`} index={1} />
        <Stat label="Win rate" value={`${winRate()}%`} index={2} />
        <Stat label="Act peak" value={props.view.peak?.name ?? "—"} index={3} isText />
      </div>

      <h3 class={styles.section}>
        Recent matches <span>{signed(props.stats.net)} RR</span>
      </h3>
      <div class={styles.tiles}>
        <For each={props.view.updates}>
          {(update, index) => (
            <div {...rowProps(update.match_id)} class={styles.tile} data-rarity={rarity(update)} style={{ "--stagger": index() }}>
              <span class={styles.rays} />
              <span class={styles.tileDelta}>{signed(update.rr_earned)}</span>
              <span class={styles.tileStrip}>
                <span class={styles.tileMap}>{update.map_name}</span>
                <span class={styles.tileRarity}>
                  {rarity(update)} · {relativeDate(update.started_at_ms)}
                </span>
              </span>
            </div>
          )}
        </For>
      </div>
    </section>
  );
}

function Stat(props: { label: string; value: string; index: number; isText?: boolean }) {
  return (
    <div class={styles.stat} style={{ "--stagger": props.index }}>
      <span class={styles.statLabel}>{props.label}</span>
      <span class={styles.statValue} data-text={props.isText ? "" : undefined}>
        {props.value}
      </span>
    </div>
  );
}
