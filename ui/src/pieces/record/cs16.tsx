// CS 1.6 "Statistics": an olive VGUI dialog with a title bar, Ranked / Maps tabs, labelled
// sunken fields, the segmented progress bar and a list view of matches with raised column
// headers and a yellow selection.
import { For, Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { playCue } from "~/menu/sound";
import { careerView } from "~/state/views";
import { relativeDate } from "../career";
import { nextRankName, outcome, signed, useCountUp, type RecordProps } from "./shared";
import styles from "./cs16.module.css";
import { useOpenMatch } from "~/menu/openMatch";

type Tab = "ranked" | "maps";

export function Cs16Record(props: RecordProps) {
  const { open, rowProps } = useOpenMatch();
  const navigate = useNavigate();
  const [tab, setTab] = createSignal<Tab>("ranked");
  const [picked, setPicked] = createSignal(0);
  const rr = useCountUp(() => props.view.rr, 250, 800);
  const segments = 20;
  const lit = () => Math.round((Math.min(100, props.view.rr) / 100) * segments);
  const pickTab = (next: Tab) => {
    playCue("tab");
    setTab(next);
    setPicked(0);
  };
  return (
    <section class={styles.window}>
      <header class={styles.titleBar}>
        <span>Statistics</span>
        <button class={styles.close} title="Close" disabled={props.isEditing} onClick={() => navigate("/home")}>
          x
        </button>
      </header>

      <div class={styles.tabs} role="tablist">
        <button class={styles.tab} role="tab" aria-selected={tab() === "ranked"} onClick={() => pickTab("ranked")}>
          Competitive
        </button>
        <button class={styles.tab} role="tab" aria-selected={tab() === "maps"} onClick={() => pickTab("maps")}>
          Maps
        </button>
      </div>

      <div class={styles.sheet}>
        <Show when={tab() === "ranked"}>
          <div class={styles.groups}>
            <fieldset class={styles.group}>
              <legend>Rank</legend>
              <Field label="Current rank" value={props.view.rank.name} />
              <Field label="Act peak" value={props.view.peak?.name ?? "None"} />
              <Show
                when={props.view.placements_left === 0}
                fallback={<Field label="Placements left" value={`${props.view.placements_left}`} />}
              >
                <div class={styles.field}>
                  <span>Rank rating</span>
                  <div class={styles.progress} aria-label={`${props.view.rr} of 100 RR`}>
                    <For each={Array.from({ length: segments }, (_, index) => index)}>
                      {(index) => <i data-lit={index < lit() ? "" : undefined} style={{ "--stagger": index }} />}
                    </For>
                  </div>
                </div>
                <span class={styles.hint}>
                  <b>{rr()}</b> / 100 RR, {Math.max(0, 100 - props.view.rr)} to {nextRankName(props.view.rank.tier)}
                </span>
              </Show>
            </fieldset>
            <fieldset class={styles.group}>
              <legend>This act</legend>
              <Field label="Matches played" value={`${props.view.games}`} />
              <Field label="Matches won" value={`${props.view.wins}`} />
              <Field label="Matches lost" value={`${props.stats.losses}`} />
              <Field label="Win ratio" value={`${props.stats.winRate}%`} />
              <Field label="Last 10 RR" value={signed(props.stats.net)} />
            </fieldset>
          </div>
        </Show>

        <div class={styles.listView}>
          <Show
            when={tab() === "ranked"}
            fallback={
              <>
                <div class={`${styles.columns} ${styles.mapColumns}`}>
                  <span>Map</span>
                  <span>Played</span>
                  <span>Won</span>
                  <span>Win %</span>
                  <span>Net RR</span>
                </div>
                <ol class={styles.rows}>
                  <For each={props.stats.maps}>
                    {(map, index) => (
                      <li
                        class={`${styles.rowItem} ${styles.mapColumns}`}
                        data-picked={picked() === index() ? "" : undefined}
                        onClick={() => setPicked(index())}
                      >
                        <span>{map.name}</span>
                        <span>{map.games}</span>
                        <span>{map.wins}</span>
                        <span>{Math.round((map.wins / map.games) * 100)}%</span>
                        <span>{signed(map.net)}</span>
                      </li>
                    )}
                  </For>
                </ol>
              </>
            }
          >
            <div class={`${styles.columns} ${styles.matchColumns}`}>
              <span>Map</span>
              <span>Played</span>
              <span>Result</span>
              <span>RR</span>
              <span>Rank after</span>
            </div>
            <ol class={styles.rows}>
              <For each={props.view.updates}>
                {(update, index) => (
                  <li
                    {...rowProps(update.match_id)}
                    class={`${styles.rowItem} ${styles.matchColumns}`}
                    style={{ "--stagger": index() }}
                    data-picked={picked() === index() ? "" : undefined}
                    title="Double-click to open the match summary"
                    onClick={() => setPicked(index())}
                    onDblClick={() => open(update.match_id)}
                  >
                    <span>{update.map_name}</span>
                    <span>{relativeDate(update.started_at_ms)}</span>
                    <span>{{ win: "Won", loss: "Lost", draw: "Draw" }[outcome(update)]}</span>
                    <span>{signed(update.rr_earned)}</span>
                    <span>
                      {update.rank_after.name}
                      {update.is_promotion ? " (promoted)" : update.is_demotion ? " (demoted)" : ""}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </Show>
        </div>
      </div>

      <footer class={styles.footer}>
        <button class={styles.button} disabled={careerView.isLoading()} onClick={() => void careerView.load(true)}>
          Refresh
        </button>
        <button class={styles.button} disabled={props.isEditing} onClick={() => navigate("/home")}>
          Close
        </button>
      </footer>
    </section>
  );
}

function Field(props: { label: string; value: string }) {
  return (
    <div class={styles.field}>
      <span>{props.label}</span>
      <span class={styles.box}>{props.value}</span>
    </div>
  );
}
