// The Piece tab: the selected piece's name, its actions (duplicate, restack, lock, hide,
// delete), the props its registry entry lists, and its look.
import { For, Match, Show, Switch as Branch, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { ArrowDownToLine, ArrowUpToLine, Copy, Eye, EyeOff, Lock, LockOpen, Trash2 } from "lucide-solid";
import { playCue } from "~/menu/sound";
import { ColorField, Range, Segmented, Switch, TextField, controls } from "~/ui/controls";
import { changePieceKind, currentStage, duplicatePiece } from "../actions";
import { type PropField, drawnDef, isKindAllowedOn, pieceDef } from "../registry";
import { layoutOf } from "../pieceLayout";
import { jobOf, lookLabel, looksOf } from "../registry/jobs";
import { removePiece, restack, updatePiece } from "../store";
import type { Piece, PropValue } from "../types";
import styles from "../studio.module.css";
import { PieceLookSection } from "./PieceLookSection";
import { PieceMotionSection } from "./PieceMotionSection";

const ACTION_ICON_PX = 15;
const TITLE_ICON_PX = 18;

function IconAction(props: { title: string; isDanger?: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class={styles.iconAction}
      data-danger={props.isDanger ? "" : undefined}
      title={props.title}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}

function PieceActions(props: { piece: Piece }) {
  const stage = () => currentStage();
  const toggle = (key: "isHidden" | "isLocked") => updatePiece(stage(), props.piece.id, (piece) => void (piece[key] = !piece[key]));
  const remove = () => {
    playCue("back");
    removePiece(stage(), props.piece.id);
  };
  return (
    <div class={styles.actionRow}>
      <IconAction title="Duplicate (Ctrl+D)" onClick={() => duplicatePiece(stage(), props.piece.id)}>
        <Copy size={ACTION_ICON_PX} />
      </IconAction>
      <IconAction title="Bring forward ( ] )" onClick={() => restack(stage(), props.piece.id, 1)}>
        <ArrowUpToLine size={ACTION_ICON_PX} />
      </IconAction>
      <IconAction title="Send backward ( [ )" onClick={() => restack(stage(), props.piece.id, -1)}>
        <ArrowDownToLine size={ACTION_ICON_PX} />
      </IconAction>
      <IconAction title={props.piece.isLocked ? "Unlock" : "Lock in place"} onClick={() => toggle("isLocked")}>
        <Show when={props.piece.isLocked} fallback={<LockOpen size={ACTION_ICON_PX} />}>
          <Lock size={ACTION_ICON_PX} />
        </Show>
      </IconAction>
      <IconAction title={props.piece.isHidden ? "Show" : "Hide"} onClick={() => toggle("isHidden")}>
        <Show when={props.piece.isHidden} fallback={<Eye size={ACTION_ICON_PX} />}>
          <EyeOff size={ACTION_ICON_PX} />
        </Show>
      </IconAction>
      <IconAction title="Delete (Del)" isDanger onClick={remove}>
        <Trash2 size={ACTION_ICON_PX} />
      </IconAction>
    </div>
  );
}

/** A colour prop: empty means the style's own colour, which Reset puts back. */
function ColorProp(props: { label: string; value: string; onChange: (value: PropValue) => void }) {
  return (
    <div class={styles.colorProp}>
      <ColorField label={props.label} value={props.value} placeholder="Style's colour" onInput={(value) => props.onChange(value)} />
      <Show when={props.value}>
        <button class={`${controls.button} ${controls.ghost} ${controls.small}`} title="Back to the style's colour" onClick={() => props.onChange("")}>
          Reset
        </button>
      </Show>
    </div>
  );
}

function PropEditor(props: { field: PropField; value: PropValue | undefined; onChange: (value: PropValue) => void }) {
  const asText = () => (typeof props.value === "string" ? props.value : "");
  const asNumber = () => (typeof props.value === "number" ? props.value : (props.field.min ?? 0));
  return (
    <Branch fallback={<TextField label={props.field.label} value={asText()} placeholder={props.field.placeholder ?? ""} onInput={props.onChange} />}>
      <Match when={props.field.type === "toggle"}>
        <Switch title={props.field.label} isOn={props.value === true} onChange={(value) => props.onChange(value)} />
      </Match>
      <Match when={props.field.type === "range"}>
        <Range
          label={props.field.label}
          value={asNumber()}
          min={props.field.min ?? 0}
          max={props.field.max ?? 100}
          step={props.field.step ?? 1}
          onInput={(value) => props.onChange(value)}
        />
      </Match>
      <Match when={props.field.type === "select"}>
        <div class={styles.selectField}>
          <span class="overline">{props.field.label}</span>
          <Segmented value={asText()} options={props.field.options ?? []} onChange={(value) => props.onChange(value)} />
        </div>
      </Match>
      <Match when={props.field.type === "color"}>
        <ColorProp label={props.field.label} value={asText()} onChange={props.onChange} />
      </Match>
      <Match when={props.field.type === "textarea"}>
        <TextField label={props.field.label} value={asText()} isMultiline onInput={(value) => props.onChange(value)} />
      </Match>
    </Branch>
  );
}

/** For a piece that does one of the menu's jobs: switch to another style's look of it in place. */
function JobLook(props: { piece: Piece }) {
  const job = () => jobOf(props.piece.kind);
  const options = () => {
    const current = job();
    return current ? looksOf(current, (kind) => isKindAllowedOn(kind, currentStage())).map((kind) => ({ value: kind, label: lookLabel(kind) })) : [];
  };
  return (
    <Show when={options().length > 1}>
      <section class={styles.section}>
        <span class="overline">{job()?.label} look</span>
        <Segmented value={props.piece.kind} options={options()} columns={3} onChange={(kind) => changePieceKind(currentStage(), props.piece.id, kind)} />
      </section>
    </Show>
  );
}

export function PieceTab(props: { piece: Piece }) {
  const def = () => pieceDef(props.piece.kind);
  /** Content settings come from the piece drawing the current layout (a shared one's own). */
  const fields = () => {
    const current = def();
    return current ? drawnDef(current, layoutOf(current, props.piece)).fields : [];
  };
  const setProp = (key: string, value: PropValue) =>
    updatePiece(currentStage(), props.piece.id, (piece) => void (piece.props[key] = value), `prop.${props.piece.id}.${key}`);
  return (
    <div class={styles.stack}>
      <div class={styles.pieceTitle}>
        <Show when={def()}>{(current) => <Dynamic component={current().icon} size={TITLE_ICON_PX} />}</Show>
        <div>
          <div class={controls.heading}>{def()?.label ?? props.piece.kind}</div>
          <div class={styles.muted}>{def()?.description}</div>
        </div>
      </div>
      <PieceActions piece={props.piece} />
      <JobLook piece={props.piece} />
      <Show when={fields().length > 0}>
        <section class={styles.section}>
          <span class="overline">Content</span>
          <For each={fields()}>
            {(field) => <PropEditor field={field} value={props.piece.props[field.key]} onChange={(value) => setProp(field.key, value)} />}
          </For>
        </section>
      </Show>
      <PieceLookSection piece={props.piece} />
      <PieceMotionSection piece={props.piece} />
    </div>
  );
}
