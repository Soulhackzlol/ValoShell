// The Layers tab: the screen's pieces from front to back; click one to select it, and lock or
// hide it in place.
import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Eye, EyeOff, Lock, LockOpen } from "lucide-solid";
import { currentStage } from "../actions";
import { pieceDef } from "../registry";
import { selectedId, setSelectedId, stagePieces, updatePiece } from "../store";
import type { Piece } from "../types";
import styles from "../studio.module.css";

const LAYER_ICON_PX = 14;
const TOGGLE_ICON_PX = 13;

function LayerRow(props: { piece: Piece }) {
  const def = () => pieceDef(props.piece.kind);
  /** A toggle inside the row must not also select the piece. */
  const flip = (event: MouseEvent, key: "isLocked" | "isHidden") => {
    event.stopPropagation();
    updatePiece(currentStage(), props.piece.id, (draft) => void (draft[key] = !draft[key]));
  };
  return (
    <li
      class={styles.layer}
      data-selected={selectedId() === props.piece.id ? "" : undefined}
      onClick={() => setSelectedId(props.piece.id)}
    >
      <Show when={def()}>{(current) => <Dynamic component={current().icon} size={LAYER_ICON_PX} />}</Show>
      <span class={styles.layerName}>{def()?.label ?? props.piece.kind}</span>
      <button class={styles.layerToggle} title={props.piece.isLocked ? "Unlock" : "Lock"} onClick={(event) => flip(event, "isLocked")}>
        <Show when={props.piece.isLocked} fallback={<LockOpen size={TOGGLE_ICON_PX} />}>
          <Lock size={TOGGLE_ICON_PX} />
        </Show>
      </button>
      <button class={styles.layerToggle} title={props.piece.isHidden ? "Show" : "Hide"} onClick={(event) => flip(event, "isHidden")}>
        <Show when={props.piece.isHidden} fallback={<Eye size={TOGGLE_ICON_PX} />}>
          <EyeOff size={TOGGLE_ICON_PX} />
        </Show>
      </button>
    </li>
  );
}

export function LayersTab() {
  const ordered = () => [...stagePieces(currentStage())].sort((a, b) => b.z - a.z);
  return (
    <ol class={styles.layers}>
      <For each={ordered()}>{(piece) => <LayerRow piece={piece} />}</For>
    </ol>
  );
}
