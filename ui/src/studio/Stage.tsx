// A stage: renders its pieces, and in edit mode lets you grab them. Dragging tracks the
// pointer 1:1 (rubber-banding past the stage edge); letting go projects the flick's
// momentum, snaps to nearby guides, and a spring settles the piece there.
import { Dynamic } from "solid-js/web";
import { For, Show, createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { playCue } from "~/menu/sound";
import { appliedUiScale } from "~/state/uiScale";
import {
  type Edge,
  EDGES,
  type Guides,
  type PxRect,
  type StageSize,
  clampRect,
  collectGuides,
  resizeFromEdge,
  snapMove,
  snapResize,
  toFraction,
  toPx,
  touchingGuides,
} from "./geometry";
import { PieceContextProvider, frameAttributes, frameContextOf, isShownNow } from "./pieceFrame";
import { registerFitter } from "./fit";
import { layoutOf, minPxOf } from "./pieceLayout";
import { accentOf, clampScale, pieceLookVars } from "./pieceLook";
import { type PieceDef, drawnDef, pieceDef } from "./registry";
import { pieceFamily } from "./skins";
import { SNAPPY, type SpringHandle, VelocityTracker, project, rubberClamp, runSpring } from "./spring";
import { isEditing, materializeStage, selectedId, setSelectedId, stagePieces, updatePiece } from "./store";
import { pieceTransitionName } from "./transitions";
import type { Piece, StageId } from "./types";
import styles from "./stage.module.css";

const SNAP_PX = 10;
const GUIDE_TOLERANCE_PX = 1.5;
const RUBBER_DIMENSION_PX = 180;
const CLICK_SLOP_PX = 3;
/** Lower than scrolling's 0.998: a flicked piece should glide, not fly across the screen. */
const DECELERATION = 0.993;

interface StageContext {
  id: StageId;
  size: () => StageSize;
  setGuides: (guides: Guides | null) => void;
}

export function Stage(props: { id: StageId; class?: string; children?: JSX.Element }) {
  let root: HTMLDivElement | undefined;
  const [size, setSize] = createSignal<StageSize>({ w: 1, h: 1 });
  const [guides, setGuides] = createSignal<Guides | null>(null);

  onMount(() => {
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(root);
    onCleanup(() => observer.disconnect());
  });

  const context: StageContext = { id: props.id, size, setGuides };
  createEffect(() => {
    if (isEditing()) materializeStage(props.id);
  });

  return (
    <div
      ref={root}
      class={`${styles.stage} ${props.class ?? ""}`}
      data-editing={isEditing() ? "" : undefined}
      onPointerDown={(event) => {
        if (event.target === root && isEditing()) setSelectedId(null);
      }}
    >
      {props.children}
      <For each={stagePieces(props.id)}>{(piece, index) => <PieceView piece={piece} order={index()} context={context} />}</For>
      <Show when={isEditing() && guides()}>
        {(current) => (
          <>
            <For each={current().xs}>{(x) => <div class={styles.guideX} style={{ left: `${x}px` }} />}</For>
            <For each={current().ys}>{(y) => <div class={styles.guideY} style={{ top: `${y}px` }} />}</For>
          </>
        )}
      </Show>
    </div>
  );
}

// Minimums are what the content needs at 100%: under a bigger Interface size the stage has
// fewer CSS px, so they shrink with it, or editing at 125% would save pieces that stay too
// big at 100%. A piece drawn at its own bigger Size needs that much more room.
function scaledMinSize(def: PieceDef | undefined, piece: Piece): { w: number; h: number } {
  const min = def ? minPxOf(def, piece) : { w: 40, h: 30 };
  const factor = clampScale(piece.style.scale) / appliedUiScale();
  return { w: min.w * factor, h: min.h * factor };
}

// A layout or look picked in the inspector that needs more room than the piece has (a look's
// small rank piece switched to the shared card) grows it just enough, kept on the stage, in
// the same undo step as the pick (studio/fit.ts).
function fitPiece(piece: Piece, current: PxRect, min: { w: number; h: number }, context: StageContext): void {
  const stage = context.size();
  const fitted = clampRect(current, stage, min);
  if (fitted.w === current.w && fitted.h === current.h) return;
  const next = toFraction(fitted, stage);
  updatePiece(context.id, piece.id, (draft) => void (draft.rect = next), `layout.${piece.id}`);
}

function PieceView(props: { piece: Piece; order: number; context: StageContext }) {
  const def = () => pieceDef(props.piece.kind);
  const [live, setLive] = createSignal<PxRect | null>(null);
  const [isLifted, setLifted] = createSignal(false);
  let spring: SpringHandle | undefined;
  onCleanup(() => spring?.stop());

  const rect = () => live() ?? toPx(props.piece.rect, props.context.size());
  const isSelected = () => selectedId() === props.piece.id;
  const frame = () => frameContextOf(props.piece, rect());
  const layout = () => {
    const current = def();
    return current ? layoutOf(current, props.piece, frame().size) : null;
  };
  /** A shared arrangement is drawn by the job's standard piece in this look's materials. */
  const drawn = () => {
    const current = def();
    return current ? drawnDef(current, layout()) : undefined;
  };
  const sharedLook = () => (drawn() !== def() ? (pieceFamily(props.piece.kind) ?? undefined) : undefined);
  // While editing every piece stays on the canvas, whatever moment its rule waits for.
  const isShown = () => isEditing() || isShownNow(props.piece);
  const minSize = () => scaledMinSize(def(), props.piece);
  onCleanup(registerFitter(props.piece.id, () => fitPiece(props.piece, rect(), minSize(), props.context)));

  const otherRects = () =>
    stagePieces(props.context.id)
      .filter((other) => other.id !== props.piece.id && !other.isHidden)
      .map((other) => toPx(other.rect, props.context.size()));

  /** Animate from where the piece is now to `target`, then hand back to the store's rect. */
  const settle = (from: PxRect, target: PxRect, velocity: { x: number; y: number }) => {
    spring?.stop();
    spring = runSpring(
      [from.x, from.y, from.w, from.h],
      [target.x, target.y, target.w, target.h],
      [velocity.x, velocity.y, 0, 0],
      SNAPPY,
      ([x = 0, y = 0, w = 0, h = 0]) => setLive({ x, y, w, h }),
      () => setLive(null),
    );
  };

  const commit = (target: PxRect) => {
    const fraction = toFraction(target, props.context.size());
    updatePiece(props.context.id, props.piece.id, (piece) => {
      piece.rect = fraction;
    });
  };

  const startGesture = (event: PointerEvent, edge: Edge | null) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(props.piece.id);
    if (props.piece.isLocked) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    spring?.stop();
    const start = rect();
    const origin = { x: event.clientX, y: event.clientY };
    const stage = props.context.size();
    const guides = collectGuides(stage, otherRects());
    const tracker = new VelocityTracker();
    tracker.add(event.clientX, event.clientY);
    let hasMoved = false;
    setLifted(edge === null);
    playCue("hover");

    const onMove = (move: PointerEvent) => {
      const dx = move.clientX - origin.x;
      const dy = move.clientY - origin.y;
      if (!hasMoved && Math.hypot(dx, dy) < CLICK_SLOP_PX) return;
      hasMoved = true;
      tracker.add(move.clientX, move.clientY);
      const next = edge ? resizeLive(start, edge, dx, dy, move.shiftKey) : moveLive(start, dx, dy);
      setLive(next);
      props.context.setGuides(move.altKey ? null : touchingGuides(next, guides, GUIDE_TOLERANCE_PX + 4));
    };

    const moveLive = (from: PxRect, dx: number, dy: number): PxRect => ({
      ...from,
      x: rubberClamp(from.x + dx, 0, stage.w - from.w, RUBBER_DIMENSION_PX),
      y: rubberClamp(from.y + dy, 0, stage.h - from.h, RUBBER_DIMENSION_PX),
    });

    const resizeLive = (from: PxRect, which: Edge, dx: number, dy: number, isProportional: boolean): PxRect => {
      const raw = resizeFromEdge(from, which, dx, dy, isProportional);
      const min = minSize();
      const w = raw.w < min.w ? rubberClamp(raw.w, min.w, Infinity, RUBBER_DIMENSION_PX) : raw.w;
      const h = raw.h < min.h ? rubberClamp(raw.h, min.h, Infinity, RUBBER_DIMENSION_PX) : raw.h;
      return {
        x: which.includes("w") ? from.x + from.w - w : raw.x,
        y: which.includes("n") ? from.y + from.h - h : raw.y,
        w,
        h,
      };
    };

    const onUp = (up: PointerEvent) => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      setLifted(false);
      props.context.setGuides(null);
      const current = live();
      if (!hasMoved || !current) {
        setLive(null);
        return;
      }
      const isSnapping = !up.altKey;
      const velocity = edge ? { x: 0, y: 0 } : tracker.velocity();
      let goal: PxRect;
      if (edge) {
        const clamped = clampRect(current, stage, minSize());
        goal = isSnapping ? clampRect(snapResize(clamped, edge, guides, SNAP_PX), stage, minSize()) : clamped;
      } else {
        const projected = {
          ...current,
          x: current.x + project(velocity.x, DECELERATION),
          y: current.y + project(velocity.y, DECELERATION),
        };
        const clamped = clampRect(projected, stage, minSize());
        goal = isSnapping ? clampRect(snapMove(clamped, guides, SNAP_PX), stage, minSize()) : clamped;
      }
      playCue("tab");
      commit(goal);
      settle(current, goal, velocity);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  const surfaceClass = () => {
    const surface = props.piece.style.surface;
    return surface === "glass" ? styles.glass : surface === "solid" ? styles.solid : "";
  };

  return (
    <Show when={def()}>
      {(definition) => (
        <div
          class={styles.piece}
          data-hidden={props.piece.isHidden ? "" : undefined}
          data-selected={isEditing() && isSelected() ? "" : undefined}
          data-lifted={isLifted() ? "" : undefined}
          data-vt={pieceTransitionName(props.piece.id)}
          data-live={live() ? "" : undefined}
          style={{
            transform: `translate3d(${rect().x}px, ${rect().y}px, 0)`,
            width: `${rect().w}px`,
            height: `${rect().h}px`,
            "z-index": isLifted() ? 9999 : props.piece.z,
            "view-transition-name": pieceTransitionName(props.piece.id),
            "--order": props.order,
          }}
        >
          <div
            class={`${styles.body} ${surfaceClass()}`}
            {...frameAttributes(props.piece, frame(), isShown())}
            data-waiting={isEditing() && !isShownNow(props.piece) ? "" : undefined}
            onAnimationEnd={(event) => {
              // An entrance plays once, when the piece appears; closing Studio must not replay it.
              if (event.target === event.currentTarget && !isEditing()) event.currentTarget.setAttribute("data-entered", "");
            }}
            data-part="piece"
            data-kind={props.piece.kind}
            data-glow={props.piece.style.isGlowing ? "" : undefined}
            data-accent={accentOf(props.piece.style) ? "" : undefined}
            data-layout={layout() ?? undefined}
            data-look={sharedLook()}
            style={{
              opacity: props.piece.style.opacity,
              "border-radius": `${props.piece.style.radius}px`,
              "--enter-delay": `${props.piece.style.delay}ms`,
              ...pieceLookVars(props.piece.style),
            }}
          >
            {/* Content size zooms this layer; the piece keeps its box (stage.module.css). */}
            <div class={styles.content} data-part="piece-content">
              <PieceContextProvider value={frame}>
                <Dynamic
                  component={(drawn() ?? definition()).component}
                  piece={props.piece}
                  stage={props.context.id}
                  isEditing={isEditing()}
                />
              </PieceContextProvider>
            </div>
          </div>
          <Show when={isEditing()}>
            <div
              class={styles.frame}
              data-locked={props.piece.isLocked ? "" : undefined}
              onPointerDown={(event) => startGesture(event, null)}
            >
              <span class={styles.tag}>
                {definition().label}
                <Show when={props.piece.isLocked}> · locked</Show>
              </span>
              <Show when={isSelected() && !props.piece.isLocked}>
                <For each={EDGES}>
                  {(edge) => (
                    <span class={styles.handle} data-edge={edge} onPointerDown={(event) => startGesture(event, edge)} />
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
}
