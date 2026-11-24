// A look's thumbnail, drawn from its document: its background, Home pieces as panels in its
// panel colour (or a wash of its text colour for styles without one) edged in its accent, and
// a strip in its Play colour along the pieces that hold PLAY. Vector, so it is crisp at any
// card size and costs no screenshot files.
import { For, Show } from "solid-js";
import type { LookSummary, PreviewBox } from "./lookSummary";
import styles from "./gallery.module.css";

/** 16:9 like the window, in arbitrary units the boxes' stage fractions scale to. */
const VIEW_W = 160;
const VIEW_H = 90;
const NAV_H = 7;
const STAGE_H = VIEW_H - NAV_H;
const NAV_MARK_W = 16;
const BOX_RADIUS = 1.5;
const SURFACE_OPACITY = 0.92;
const WASH_OPACITY = 0.14;
const EDGE_OPACITY = 0.45;
const EDGE_WIDTH = 0.6;
/** The Play strip: at most this tall, and never taller than its piece. */
const PLAY_STRIP_H = 6;

function Box(props: { box: PreviewBox; look: LookSummary }) {
  const x = () => props.box.rect.x * VIEW_W;
  const y = () => NAV_H + props.box.rect.y * STAGE_H;
  const width = () => props.box.rect.w * VIEW_W;
  const height = () => props.box.rect.h * STAGE_H;
  const strip = () => Math.min(PLAY_STRIP_H, height());
  return (
    <>
      <rect
        x={x()}
        y={y()}
        width={width()}
        height={height()}
        rx={BOX_RADIUS}
        fill={props.look.surface ?? props.look.text}
        fill-opacity={props.look.surface ? SURFACE_OPACITY : WASH_OPACITY}
        stroke={props.look.accent}
        stroke-opacity={EDGE_OPACITY}
        stroke-width={EDGE_WIDTH}
      />
      <Show when={props.box.playEdge}>
        <rect
          x={x()}
          y={props.box.playEdge === "top" ? y() : y() + height() - strip()}
          width={width()}
          height={strip()}
          rx={BOX_RADIUS}
          fill={props.look.play}
        />
      </Show>
    </>
  );
}

/** Decorative: it sits inside the card's button, which already names the look. */
export function LookPreview(props: { summary: LookSummary }) {
  const look = () => props.summary;
  return (
    <svg class={styles.preview} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
      <rect width={VIEW_W} height={VIEW_H} fill={look().ground} />
      <rect width={VIEW_W} height={NAV_H} fill={look().text} fill-opacity={0.06} />
      <rect x={(VIEW_W - NAV_MARK_W) / 2} y={NAV_H - 1} width={NAV_MARK_W} height={1} fill={look().accent} />
      <For each={look().boxes}>{(box) => <Box box={box} look={look()} />}</For>
    </svg>
  );
}
