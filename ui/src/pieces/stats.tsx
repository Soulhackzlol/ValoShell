// Stats piece: the player's own numbers over their recent matches (K/D, ACS, headshot %, ADR,
// win rate) and the same broken down by agent or by map. Deathmatch and customs don't count.
import { For, Show, createSignal, onMount } from "solid-js";
import { RefreshCw } from "lucide-solid";
import type { StatLine } from "~/bindings/StatLine";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { statsView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { ViewStatus } from "~/ui/ViewStatus";
import styles from "./stats.module.css";

type Breakdown = "agents" | "maps";

const percent = (value: number | null) => (value === null ? "—" : `${value}%`);
const decimal = (value: number | null) => (value === null ? "—" : value.toFixed(1));

function Tile(props: { label: string; value: string }) {
  return (
    <div class={styles.tile}>
      <span class={`${styles.tileValue} num`}>{props.value}</span>
      <span class={styles.tileLabel}>{props.label}</span>
    </div>
  );
}

function Row(props: { line: StatLine; isMap: boolean }) {
  return (
    <tr>
      <td class={styles.nameCell}>
        <Art src={props.line.icon} class={props.isMap ? styles.mapIcon : styles.agentIcon} fallback={<span class={styles.iconEmpty} />} />
        <span>{props.line.name}</span>
      </td>
      <td class="num">{props.line.matches}</td>
      <td class="num">{percent(props.line.win_rate)}</td>
      <td class="num">{props.line.kd.toFixed(1)}</td>
      <td class="num">{Math.round(props.line.acs)}</td>
      <td class="num">{percent(props.line.headshot_percent)}</td>
    </tr>
  );
}

function Status() {
  return <ViewStatus view={statsView} title={"Stats"} loading="Reading your recent matches…" idle="Connect to VALORANT to see your stats." />;
}

export function StatsPiece(_props: PieceProps) {
  const [breakdown, setBreakdown] = createSignal<Breakdown>("agents");
  onMount(() => {
    if (!statsView.value() && !statsView.isLoading()) void statsView.load();
  });
  const pick = (next: Breakdown) => {
    playCue("tab");
    setBreakdown(next);
  };
  return (
    <Show when={statsView.value()} fallback={<Status />}>
      {(view) => (
        <section class={styles.stats}>
          <header class={styles.header}>
            <div>
              <h2 class={styles.title}>Your stats</h2>
              <span class={styles.subtitle}>{view().overall.matches} recent matches · deathmatch, arcade modes and customs left out</span>
            </div>
            <button class={styles.refresh} title="Refresh" aria-label="Refresh your stats" disabled={statsView.isLoading()} onClick={() => void statsView.load(true)}>
              <RefreshCw size={15} />
            </button>
          </header>
          <Show when={view().overall.matches > 0} fallback={<Empty title="No matches yet">Play a standard match and your numbers show up here.</Empty>}>
            <div class={styles.tiles}>
              <Tile label="K/D" value={view().overall.kd.toFixed(1)} />
              <Tile label="ACS" value={String(Math.round(view().overall.acs))} />
              <Tile label="Headshot" value={percent(view().overall.headshot_percent)} />
              <Tile label="ADR" value={decimal(view().overall.adr)} />
              <Tile label="Win rate" value={percent(view().overall.win_rate)} />
            </div>
            <div class={styles.switch} role="tablist" aria-label="Break down by">
              <button role="tab" aria-selected={breakdown() === "agents"} onClick={() => pick("agents")}>
                By agent
              </button>
              <button role="tab" aria-selected={breakdown() === "maps"} onClick={() => pick("maps")}>
                By map
              </button>
            </div>
            <div class={styles.tableWrap}>
              <table class={styles.table}>
                <thead>
                  <tr>
                    <th>{breakdown() === "agents" ? "Agent" : "Map"}</th>
                    <th>Played</th>
                    <th>Win</th>
                    <th>K/D</th>
                    <th>ACS</th>
                    <th>HS</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={breakdown() === "agents" ? view().by_agent : view().by_map}>
                    {(line) => <Row line={line} isMap={breakdown() === "maps"} />}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </section>
      )}
    </Show>
  );
}
