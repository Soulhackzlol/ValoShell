// Update notice (bottom-left stack, every scene): a newer ValoShell with its notes, and the
// install's progress once the player starts it. Installing restarts the app, so it only ever
// happens on the player's click; dismissing hides it until the next release.
import { Match, Show, Switch } from "solid-js";
import { Download, ExternalLink, X } from "lucide-solid";
import type { UpdateView } from "~/bindings/UpdateView";
import { openExternal } from "~/pieces/widgets";
import { dismissUpdateNotice, dismissedVersion, installUpdate, isInstallPending, update } from "~/state/update";
import { isUpdateNoticeShown } from "~/state/updateRules";
import controls from "~/ui/controls.module.css";
import styles from "./UpdateNotice.module.css";

const FULL_PERCENT = 100;

function isInstalling(view: UpdateView): boolean {
  return view.stage.stage === "downloading" || view.stage.stage === "restarting";
}

/** Why the last install (or check) failed, to show above the notes. */
function failureOf(view: UpdateView): string | null {
  return view.stage.stage === "failed" ? view.stage.message : null;
}

function Progress(props: { view: UpdateView }) {
  const percent = () => (props.view.stage.stage === "downloading" ? props.view.stage.percent : FULL_PERCENT);
  return (
    <div
      class={styles.progress}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={FULL_PERCENT}
      aria-valuenow={percent()}
    >
      <span style={{ "--progress": percent() / FULL_PERCENT }} />
    </div>
  );
}

function Actions(props: { view: UpdateView }) {
  const page = () => props.view.latest?.page_url ?? "";
  return (
    <div class={styles.actions}>
      <Show
        when={props.view.can_install}
        fallback={
          <button class={`${controls.button} ${controls.small}`} onClick={() => void openExternal(page())}>
            <ExternalLink size={14} /> Get it
          </button>
        }
      >
        <button
          class={`${controls.button} ${controls.small}`}
          disabled={isInstallPending()}
          onClick={() => void installUpdate()}
        >
          <Download size={14} /> Update and restart
        </button>
      </Show>
      <button
        class={`${controls.button} ${controls.ghost} ${controls.small}`}
        onClick={() => void openExternal(page())}
      >
        What's new
      </button>
    </div>
  );
}

export function UpdateNotice() {
  return (
    <Show when={isUpdateNoticeShown(update(), dismissedVersion()) && update()}>
      {(view) => (
        <div class={styles.notice} role="status" data-stage={view().stage.stage}>
          <span class={styles.bar} />
          <div class={styles.body}>
            <Switch fallback={<span class={styles.title}>ValoShell {view().latest?.version} is out</span>}>
              <Match when={view().stage.stage === "downloading"}>
                <span class={styles.title}>Downloading {view().latest?.version}</span>
              </Match>
              <Match when={view().stage.stage === "restarting"}>
                <span class={styles.title}>Restarting into {view().latest?.version}</span>
              </Match>
            </Switch>
            <Show
              when={isInstalling(view())}
              fallback={
                <>
                  <Show when={failureOf(view())}>{(message) => <span class={styles.error}>{message()}</span>}</Show>
                  <p class={styles.notes}>{view().latest?.notes}</p>
                  <Actions view={view()} />
                </>
              }
            >
              <Progress view={view()} />
            </Show>
          </div>
          <Show when={!isInstalling(view())}>
            <button class={styles.close} aria-label="Dismiss until the next version" onClick={dismissUpdateNotice}>
              <X size={14} />
            </button>
          </Show>
        </div>
      )}
    </Show>
  );
}
