// What a piece shows until its data is there, the same way everywhere: loading (with a
// shimmer), the error with "Try again", or why there is nothing yet (not connected). Styles
// redesign it through `data-part` hooks (view-status, -title, -bar, -text, -retry) and
// `data-state`, like every other part of the menu. Small pieces get a compact version.
import { Match, Show, Switch } from "solid-js";
import { CircleAlert, PlugZap, RefreshCw } from "lucide-solid";
import styles from "./ViewStatus.module.css";
import { type StatusSource, viewStateOf } from "./viewState";

export interface ViewStatusProps {
  view: StatusSource;
  /** The piece's name, as its heading. */
  title: string;
  /** "Loading your career…" */
  loading: string;
  /** Why there is nothing without an error, usually "Connect to VALORANT to see …". */
  idle: string;
}

export function ViewStatus(props: ViewStatusProps) {
  const state = () => viewStateOf(props.view);
  const isError = () => state() === "error";
  return (
    <div class={styles.status} data-part="view-status" data-state={state()}>
      <span class={styles.title} data-part="view-status-title">
        {props.title}
      </span>
      <Show when={state() === "loading"}>
        <span class={styles.shimmer} data-part="view-status-bar" aria-hidden="true" />
      </Show>
      {/* One live region that stays while its sentence changes, so each change is announced;
          an error interrupts, the rest waits its turn. The button stays out of it. */}
      <span
        class={styles.text}
        data-part="view-status-text"
        role={isError() ? "alert" : "status"}
        aria-live={isError() ? "assertive" : "polite"}
      >
        <Switch>
          <Match when={state() === "loading"}>{props.loading}</Match>
          <Match when={isError()}>
            <CircleAlert size={14} /> {props.view.error()}
          </Match>
          <Match when={state() === "idle"}>
            <PlugZap size={14} /> {props.idle}
          </Match>
        </Switch>
      </span>
      <Show when={isError()}>
        <button class={styles.retry} data-part="view-status-retry" onClick={() => void props.view.load(true)}>
          <RefreshCw size={13} /> Try again
        </button>
      </Show>
    </div>
  );
}
