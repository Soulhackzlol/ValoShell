// The Inspector's "Motion" for one piece: how it enters (with a replay on the canvas), what it
// does while idle, how it answers the pointer, how long it waits before entering, and at which
// game moments it is on screen at all. "Style's own" follows the menu style (motion.ts).
import { type JSX } from "solid-js";
import { Play } from "lucide-solid";
import { SHOW_WHEN_OPTIONS, type ShowWhen } from "~/state/momentRules";
import { Range, Segmented, controls } from "~/ui/controls";
import { currentStage } from "../actions";
import {
  ENTER_OPTIONS,
  type EnterMotion,
  HOVER_OPTIONS,
  type HoverMotion,
  IDLE_OPTIONS,
  type IdleMotion,
  MAX_DELAY_MS,
} from "../motion";
import { updatePiece } from "../store";
import { pieceTransitionName } from "../transitions";
import type { Piece, PieceStyle } from "../types";
import styles from "../studio.module.css";

const DELAY_STEP_MS = 50;
/** Long enough for the slowest entrance (blur) at its longest delay to finish. */
const REPLAY_MS = 2200;
const ENTER_COLUMNS = 2;
const IDLE_COLUMNS = 4;
const HOVER_COLUMNS = 3;
const SHOW_COLUMNS = 2;

function setStyle<K extends keyof PieceStyle>(piece: Piece, key: K, value: PieceStyle[K]): void {
  updatePiece(currentStage(), piece.id, (draft) => void (draft.style[key] = value), `style.${piece.id}.${key}`);
}

function setShowWhen(piece: Piece, value: ShowWhen): void {
  updatePiece(currentStage(), piece.id, (draft) => void (draft.showWhen = value), `show.${piece.id}`);
}

/** Play the piece's entrance once on the canvas, where editing otherwise holds it still. */
function replayEntrance(piece: Piece): void {
  const body = document.querySelector<HTMLElement>(`[data-vt="${pieceTransitionName(piece.id)}"] > [data-part="piece"]`);
  if (!body) return;
  body.removeAttribute("data-replay");
  // Reading layout here restarts the animation when the attribute comes back.
  void body.offsetWidth;
  body.setAttribute("data-replay", "");
  window.setTimeout(() => body.removeAttribute("data-replay"), REPLAY_MS);
}

function Labelled(props: { label: string; children: JSX.Element }) {
  return (
    <div class={styles.lookRow}>
      <span class="overline">{props.label}</span>
      {props.children}
    </div>
  );
}

export function PieceMotionSection(props: { piece: Piece }) {
  const style = () => props.piece.style;
  return (
    <section class={styles.section}>
      <span class="overline">Motion</span>
      <Labelled label="Enters">
        <Segmented<EnterMotion>
          value={style().enter}
          options={ENTER_OPTIONS}
          columns={ENTER_COLUMNS}
          onChange={(value) => {
            setStyle(props.piece, "enter", value);
            requestAnimationFrame(() => replayEntrance(props.piece));
          }}
        />
      </Labelled>
      <Range
        label="Waits"
        value={style().delay}
        min={0}
        max={MAX_DELAY_MS}
        step={DELAY_STEP_MS}
        format={(value) => `${value} ms`}
        onInput={(value) => setStyle(props.piece, "delay", value)}
      />
      <button class={`${controls.button} ${controls.ghost}`} onClick={() => replayEntrance(props.piece)}>
        <Play size={14} /> Replay entrance
      </button>
      <Labelled label="While idle">
        <Segmented<IdleMotion> value={style().idle} options={IDLE_OPTIONS} columns={IDLE_COLUMNS} onChange={(value) => setStyle(props.piece, "idle", value)} />
      </Labelled>
      <Labelled label="On hover">
        <Segmented<HoverMotion> value={style().hover} options={HOVER_OPTIONS} columns={HOVER_COLUMNS} onChange={(value) => setStyle(props.piece, "hover", value)} />
      </Labelled>
      <Labelled label="Shows">
        <Segmented<ShowWhen>
          value={props.piece.showWhen}
          options={SHOW_WHEN_OPTIONS}
          columns={SHOW_COLUMNS}
          onChange={(value) => setShowWhen(props.piece, value)}
        />
      </Labelled>
    </section>
  );
}
