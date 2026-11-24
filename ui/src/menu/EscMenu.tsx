// The Esc menu: the settings (sections in escSections.tsx) plus Studio and Quit. Opens with Esc
// or the cog; closes with Esc or Resume. The VALORANT style shows its client-like screen instead.
import { Show, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { LogOut, Play } from "lucide-solid";
import type { Settings } from "~/bindings/Settings";
import { quitApp } from "./quit";
import { isTauri } from "~/ipc/runtime";
import { settings } from "~/state/settings";
import { doc, isEditing, setEditMode } from "~/studio/store";
import { controls } from "~/ui/controls";
import {
  AccessibilitySection,
  InterfaceSection,
  MatchFlowSection,
  UpdatesSection,
} from "./escSections";
import { playCue } from "./sound";
import { ValSettings } from "./ValSettings";
import { openTour } from "~/state/onboarding";
import styles from "./EscMenu.module.css";

const [isOpen, setOpen] = createSignal(false);
/** The VALORANT style shows the client's settings screen; its ValoShell tab comes back here. */
const [isClassic, setClassic] = createSignal(false);

export function openEscMenu(): void {
  playCue("confirm");
  setOpen(true);
}

export function closeEscMenu(): void {
  playCue("back");
  setOpen(false);
  setClassic(false);
}

function openStudio(): void {
  setOpen(false);
  setEditMode(true);
}

/** The tour is a dialog of its own; settings close so they do not sit under it. */
function openWelcomeTour(): void {
  setOpen(false);
  openTour();
}

/** ValoShell's own settings dialog: three columns of sections, Resume and Quit. */
function SettingsDialog(props: { now: Settings }) {
  return (
    <Portal>
      <div class={styles.scrim} onPointerDown={(event) => event.target === event.currentTarget && closeEscMenu()}>
        <div class={styles.menu} role="dialog" aria-label="Settings">
          <header class={styles.header}>
            <h1 class={styles.title}>Settings</h1>
            <span class="overline">Esc to resume</span>
          </header>
          <div class={styles.columns}>
            <div class={styles.stack}>
              <MatchFlowSection now={props.now} />
              <AccessibilitySection now={props.now} />
            </div>
            <div class={styles.stack}>
              <UpdatesSection now={props.now} />
            </div>
            <InterfaceSection now={props.now} onOpenStudio={openStudio} onOpenTour={openWelcomeTour} />
          </div>
          <footer class={styles.footer}>
            <button class={controls.button} onClick={closeEscMenu}>
              <Play size={15} /> Resume
            </button>
            <Show when={isTauri}>
              <button class={`${controls.button} ${controls.danger}`} onClick={() => void quitApp()}>
                <LogOut size={15} /> Quit ValoShell
              </button>
            </Show>
          </footer>
        </div>
      </div>
    </Portal>
  );
}

export function EscMenu() {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || isEditing()) return;
    event.preventDefault();
    if (isOpen()) closeEscMenu();
    else openEscMenu();
  };
  onMount(() => window.addEventListener("keydown", onKeyDown));
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  const isValorantScreen = () => doc.theme.skin === "current" && !isClassic();
  const toClassic = () => {
    playCue("tab");
    setClassic(true);
  };
  return (
    <Show when={isValorantScreen()} fallback={<Show when={isOpen() && settings()}>{(now) => <SettingsDialog now={now()} />}</Show>}>
      <Show when={isOpen()}>
        <ValSettings onClose={closeEscMenu} onClassic={toClassic} />
      </Show>
    </Show>
  );
}
