// Pip-Boy career, after DATA > STATS: GENERAL lists the act as the game lists its counts (a
// dotted leader to each number) and LOG lists recent ranked games. RR and level are already on
// the Pip-Boy bar under it. The two sub-tabs are real; arrow keys are left to the INV.
import { For, Show, createSignal } from "solid-js";
import { useOpenMatch } from "~/menu/openMatch";
import { playCue } from "~/menu/sound";
import { relativeDate } from "../career";
import { outcome, signed, type RecordProps } from "./shared";
import styles from "./pipboy.module.css";

type Tab = "general" | "log";

function generalLines(props: RecordProps): [string, string][] {
  const streak = props.stats.streak;
  return [
    ["Rank", props.view.rank.name],
    ["Ranked games played", `${props.view.games}`],
    ["Ranked games won", `${props.view.wins}`],
    ["Win rate", `${props.stats.winRate}%`],
    ["Best game", `${signed(props.stats.best)} RR`],
    ["Worst game", `${signed(props.stats.worst)} RR`],
    ["Rank ups (recent)", `${props.stats.promotions}`],
    ["Current streak", streak ? `${streak.length} ${streak.isWin ? "won" : "lost"}` : "--"],
    ["Act peak", props.view.peak?.name ?? "--"],
  ];
}

export function PipboyRecord(props: RecordProps) {
  const { rowProps } = useOpenMatch();
  const [tab, setTab] = createSignal<Tab>("general");
  const pick = (next: Tab) => {
    playCue("tab");
    setTab(next);
  };
  return (
    <section class={styles.screen}>
      <nav class={styles.subTabs}>
        <button data-on={tab() === "general" ? "" : undefined} onClick={() => pick("general")}>
          General
        </button>
        <button data-on={tab() === "log" ? "" : undefined} onClick={() => pick("log")}>
          Log
        </button>
      </nav>
      <Show
        when={tab() === "log"}
        fallback={
          <dl class={styles.lines}>
            <For each={generalLines(props)}>
              {([name, value]) => (
                <div class={styles.line}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              )}
            </For>
          </dl>
        }
      >
        <ol class={styles.lines}>
          <For each={props.view.updates}>
            {(update) => (
              <li {...rowProps(update.match_id)} class={styles.line} data-result={outcome(update)}>
                <span>
                  {update.map_name} <small>{relativeDate(update.started_at_ms)}</small>
                </span>
                <span>{signed(update.rr_earned)}</span>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </section>
  );
}
