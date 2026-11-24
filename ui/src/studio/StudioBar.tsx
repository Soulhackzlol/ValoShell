// Bottom bar in edit mode: which stage you are editing, undo/redo, reset, the in-game overlay
// stage and its on-screen preview, and Done.
import { Show, createSignal } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { Check, MonitorPlay, Redo2, RotateCcw, Undo2 } from "lucide-solid";
import { call } from "~/ipc/commands";
import { isTauri } from "~/ipc/runtime";
import { playCue } from "~/menu/sound";
import { controls } from "~/ui/controls";
import { currentStage } from "./actions";
import { historySize, redo, resetStage, setEditMode, undo } from "./store";
import styles from "./studio.module.css";

const STAGE_LABELS: Record<string, string> = {
  home: "Home",
  play: "Play",
  agents: "Agents",
  collection: "Collection",
  career: "Career",
  store: "Store",
  "agent-select": "Agent select",
  live: "Live match",
  "post-match": "Match summary",
  ingame: "In-game overlay",
};

export function StudioBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPreviewing, setPreviewing] = createSignal(false);
  const [returnTo, setReturnTo] = createSignal("/home");

  const togglePreview = () => {
    const next = !isPreviewing();
    setPreviewing(next);
    void call("set_overlay_preview", { isVisible: next });
  };

  const openOverlayStage = () => {
    playCue("tab");
    if (currentStage() === "ingame") {
      navigate(returnTo());
      return;
    }
    setReturnTo(location.pathname);
    navigate("/ingame");
  };

  return (
    <div
      class={`${styles.bar} ${controls.glass}`}
      data-part="studio-bar"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span class={styles.barStage}>
        <span class="overline">Editing</span>
        <b>{STAGE_LABELS[currentStage()] ?? currentStage()}</b>
      </span>
      <span class={styles.barDivider} />
      <button class={styles.barButton} title="Undo (Ctrl+Z)" disabled={historySize().past === 0} onClick={undo}>
        <Undo2 size={16} />
      </button>
      <button class={styles.barButton} title="Redo (Ctrl+Shift+Z)" disabled={historySize().future === 0} onClick={redo}>
        <Redo2 size={16} />
      </button>
      <button
        class={styles.barButton}
        title="Reset this stage to its default layout"
        onClick={() => {
          playCue("back");
          resetStage(currentStage());
        }}
      >
        <RotateCcw size={16} />
      </button>
      <span class={styles.barDivider} />
      <button class={styles.barButton} data-wide data-active={currentStage() === "ingame" ? "" : undefined} onClick={openOverlayStage}>
        <MonitorPlay size={16} />
        {currentStage() === "ingame" ? "Back to menu" : "In-game overlay"}
      </button>
      <Show when={isTauri && currentStage() === "ingame"}>
        <button class={styles.barButton} data-wide data-active={isPreviewing() ? "" : undefined} onClick={togglePreview}>
          {isPreviewing() ? "Hide on screen" : "Show on screen"}
        </button>
      </Show>
      <span class={styles.barDivider} />
      <button
        class={`${controls.button} ${controls.small}`}
        onClick={() => {
          playCue("confirm");
          if (isPreviewing()) togglePreview();
          setEditMode(false);
        }}
      >
        <Check size={15} /> Done
      </button>
    </div>
  );
}
