// The Inspector's "Look" for one piece: its layout (for pieces that offer several), its frame
// (surface, opacity, corners, outline) and its own size, density and accent on top of the menu
// style. Every change is one undo step; "Reset look" puts the piece back as its kind is drawn
// untouched (the shared defaults plus the definition's own look).
import { type JSX, Show } from "solid-js";
import { RotateCcw } from "lucide-solid";
import { ColorField, Range, Segmented, Switch, controls } from "~/ui/controls";
import { currentStage } from "../actions";
import { fitPieceToLayout } from "../fit";
import { LAYOUT_PROP, isAutoLayout, layoutOf } from "../pieceLayout";
import { PIECE_SCALE, accentOf, baseStyleOf } from "../pieceLook";
import { drawnDef, pieceDef } from "../registry";
import { doc, updatePiece } from "../store";
import type { Density, Piece, PieceStyle, Surface } from "../types";
import styles from "../studio.module.css";

const PERCENT = 100;
const OPACITY = { min: 0.1, max: 1, step: 0.01 } as const;
const CORNERS_PX = { min: 0, max: 48, step: 1 } as const;
const SURFACES = [
  { value: "none", label: "Bare" },
  { value: "glass", label: "Panel" },
  { value: "solid", label: "Solid" },
] as const;
const DENSITIES = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
] as const;

const asPercent = (value: number) => `${Math.round(value * PERCENT)}%`;

/** Pieces whose Look offers layouts; others may keep their own `layout` content setting. */
const hasLookLayouts = (piece: Piece) => (pieceDef(piece.kind)?.layouts?.length ?? 0) > 0;
const baseOf = (piece: Piece) => baseStyleOf(pieceDef(piece.kind)?.style);

/** Anything to reset: the frame or look differs from the kind's own, or a layout was picked. */
function isStyled(piece: Piece): boolean {
  const base = baseOf(piece);
  const hasLayout = hasLookLayouts(piece) && piece.props[LAYOUT_PROP] !== undefined;
  return hasLayout || (Object.keys(base) as (keyof PieceStyle)[]).some((key) => piece.style[key] !== base[key]);
}

function setStyle<K extends keyof PieceStyle>(piece: Piece, key: K, value: PieceStyle[K]): void {
  updatePiece(currentStage(), piece.id, (draft) => void (draft.style[key] = value), `style.${piece.id}.${key}`);
}

function resetLook(piece: Piece): void {
  updatePiece(currentStage(), piece.id, (draft) => {
    draft.style = baseOf(draft);
    if (hasLookLayouts(draft)) delete draft.props[LAYOUT_PROP];
  });
}

/** A labelled row for the choices that have no label of their own. */
function Labelled(props: { label: string; children: JSX.Element }) {
  return (
    <div class={styles.lookRow}>
      <span class="overline">{props.label}</span>
      {props.children}
    </div>
  );
}

/** Value of the Auto choice: no layout saved, so the piece follows its size. */
const AUTO = "";

/** The piece's arrangement, for pieces whose definition offers several; pieces that change
 *  form with their size also offer Auto, which is what they start on. */
function LayoutField(props: { piece: Piece }) {
  const def = () => pieceDef(props.piece.kind);
  const setLayout = (value: string) => {
    const pick = (draft: Piece) => {
      if (value === AUTO) delete draft.props[LAYOUT_PROP];
      else draft.props[LAYOUT_PROP] = value;
      // A shared arrangement is drawn by the job's standard piece: give it its settings.
      const current = def();
      const drawn = current ? drawnDef(current, value) : undefined;
      if (drawn && drawn !== current) draft.props = { ...drawn.defaults, ...draft.props };
    };
    updatePiece(currentStage(), props.piece.id, pick, `layout.${props.piece.id}`);
    fitPieceToLayout(props.piece.id);
  };
  const options = () => {
    const own = def()?.layouts ?? [];
    return def()?.autoLayouts ? [{ value: AUTO, label: "Auto" }, ...own] : own;
  };
  const value = () => {
    const current = def();
    if (!current) return AUTO;
    return isAutoLayout(current, props.piece) ? AUTO : (layoutOf(current, props.piece) ?? AUTO);
  };
  return (
    <Show when={def()?.layouts}>
      <Labelled label="Layout">
        <Segmented<string> value={value()} options={options()} onChange={setLayout} />
      </Labelled>
    </Show>
  );
}

/** Spacing, only for pieces whose CSS spaces itself with the tokens it retunes. */
function DensityField(props: { piece: Piece }) {
  return (
    <Show when={pieceDef(props.piece.kind)?.hasDensity}>
      <Labelled label="Spacing">
        <Segmented<Density>
          value={props.piece.style.density}
          options={DENSITIES}
          onChange={(value) => setStyle(props.piece, "density", value)}
        />
      </Labelled>
    </Show>
  );
}

/** The piece's own accent; empty means the style's (shown from the theme until one is picked). */
function AccentField(props: { piece: Piece }) {
  const own = () => accentOf(props.piece.style);
  const set = (value: string) => setStyle(props.piece, "accent", value);
  return (
    <div class={styles.colorProp}>
      <ColorField label={own() ? "Accent" : "Accent (the style's)"} value={own() ?? doc.theme.accent} onInput={set} />
      <Show when={own()}>
        <button
          class={`${controls.button} ${controls.ghost} ${controls.small}`}
          title="Back to the style's accent"
          onClick={() => set("")}
        >
          Style's
        </button>
      </Show>
    </div>
  );
}

/** Surface, opacity, corners and the accent outline: the piece's frame. */
function FrameFields(props: { piece: Piece }) {
  const style = () => props.piece.style;
  return (
    <>
      <Segmented<Surface>
        value={style().surface}
        options={SURFACES}
        onChange={(value) => setStyle(props.piece, "surface", value)}
      />
      <Range
        label="Opacity"
        value={style().opacity}
        {...OPACITY}
        format={asPercent}
        onInput={(value) => setStyle(props.piece, "opacity", value)}
      />
      <Range
        label="Corners"
        value={style().radius}
        {...CORNERS_PX}
        format={(value) => `${value}px`}
        onInput={(value) => setStyle(props.piece, "radius", value)}
      />
      <Switch
        title="Accent outline"
        isOn={style().isGlowing}
        onChange={(value) => setStyle(props.piece, "isGlowing", value)}
      />
    </>
  );
}

export function PieceLookSection(props: { piece: Piece }) {
  return (
    <section class={styles.section}>
      <span class="overline">Look</span>
      <LayoutField piece={props.piece} />
      <Range
        label="Size"
        value={props.piece.style.scale}
        {...PIECE_SCALE}
        format={asPercent}
        onInput={(value) => setStyle(props.piece, "scale", value)}
      />
      <DensityField piece={props.piece} />
      <AccentField piece={props.piece} />
      <FrameFields piece={props.piece} />
      <Show when={isStyled(props.piece)}>
        <button class={`${controls.button} ${controls.ghost}`} onClick={() => resetLook(props.piece)}>
          <RotateCcw size={14} /> Reset look
        </button>
      </Show>
    </section>
  );
}
