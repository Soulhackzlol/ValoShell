// Redraws a backdrop source as ASCII: the source is sampled into a small grid (one sample per
// character cell), each cell's brightness picks a character from a density ramp, and every
// row is drawn as one string. Images render once; video and shaders at 15 fps while
// visible. A source whose pixels cannot be read (cross-origin without CORS) is reported so
// the plain picture shows instead.
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { isLiteEffects } from "~/state/performance";
import { isMotionReduced } from "~/studio/spring";

/** Dark to bright. */
const RAMP = " .,:;-=+*#%@";
const FRAME_MS = 1000 / 15;
/** Monospace characters are about this much narrower than tall. */
const CELL_ASPECT = 0.6;
/** Below this brightness spread a source is treated as flat (no stretching noise up). */
const MIN_LEVEL_RANGE = 0.08;

export type AsciiSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

/** Where a cut-out figure sits, as fractions of the layer; it is fitted inside, bottom right. */
export interface AsciiPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

function sourceSize(source: AsciiSource): { w: number; h: number } {
  if (source instanceof HTMLVideoElement) return { w: source.videoWidth, h: source.videoHeight };
  if (source instanceof HTMLImageElement) return { w: source.naturalWidth, h: source.naturalHeight };
  return { w: source.width, h: source.height };
}

/** Draw `source` scaled to cover a cols x rows grid (like `object-fit: cover`). */
function coverInto(context: CanvasRenderingContext2D, source: AsciiSource, cols: number, rows: number): boolean {
  const size = sourceSize(source);
  if (size.w === 0 || size.h === 0) return false;
  const targetAspect = (cols * CELL_ASPECT) / rows;
  const sourceAspect = size.w / size.h;
  let sw = size.w;
  let sh = size.h;
  if (sourceAspect > targetAspect) sw = size.h * targetAspect;
  else sh = size.w / targetAspect;
  context.drawImage(source, (size.w - sw) / 2, (size.h - sh) / 2, sw, sh, 0, 0, cols, rows);
  return true;
}

/** Draw `source` fitted inside `box` (like `background-size: contain` at right bottom) on black. */
function placeInto(context: CanvasRenderingContext2D, source: AsciiSource, cols: number, rows: number, box: AsciiPlacement): boolean {
  const size = sourceSize(source);
  if (size.w === 0 || size.h === 0) return false;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, cols, rows);
  // Work in screen-shaped units (a column is CELL_ASPECT of a row) so the figure keeps its shape.
  const boxW = box.width * cols * CELL_ASPECT;
  const boxH = box.height * rows;
  const scale = Math.min(boxW / size.w, boxH / size.h);
  const drawW = size.w * scale;
  const drawH = size.h * scale;
  const x = box.left * cols + (boxW - drawW) / CELL_ASPECT;
  const y = box.top * rows + boxH - drawH;
  context.drawImage(source, 0, 0, size.w, size.h, x, y, drawW / CELL_ASPECT, drawH);
  return true;
}

export function AsciiLayer(props: {
  source: () => AsciiSource | null;
  isAnimated: boolean;
  cellPx: number;
  color: string;
  isPaused: () => boolean;
  onUnreadable: () => void;
  /** Set for a cut-out figure; otherwise the source covers the whole layer. */
  placement?: (() => AsciiPlacement | null) | undefined;
  class?: string | undefined;
}) {
  let canvas: HTMLCanvasElement | undefined;
  const sampler = document.createElement("canvas");
  const sampleContext = sampler.getContext("2d", { willReadFrequently: true });
  let frame = 0;
  let last = 0;

  const render = (): boolean => {
    const source = props.source();
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !sampleContext || !source) return false;
    const cell = Math.max(6, props.cellPx);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const cols = Math.max(1, Math.floor(width / (cell * CELL_ASPECT)));
    const rows = Math.max(1, Math.floor(height / cell));
    sampler.width = cols;
    sampler.height = rows;
    const box = props.placement?.() ?? null;
    if (!(box ? placeInto(sampleContext, source, cols, rows, box) : coverInto(sampleContext, source, cols, rows))) return false;
    let pixels: Uint8ClampedArray;
    try {
      pixels = sampleContext.getImageData(0, 0, cols, rows).data;
    } catch {
      props.onUnreadable();
      return false;
    }
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = props.color;
    context.font = `${cell}px "JetBrains Mono Variable", Consolas, monospace`;
    context.textBaseline = "top";
    const luminance = new Float32Array(cols * rows);
    let darkest = 1;
    let brightest = 0;
    for (let index = 0; index < luminance.length; index += 1) {
      const offset = index * 4;
      const value =
        (0.2126 * (pixels[offset] ?? 0) + 0.7152 * (pixels[offset + 1] ?? 0) + 0.0722 * (pixels[offset + 2] ?? 0)) / 255;
      luminance[index] = value;
      darkest = Math.min(darkest, value);
      brightest = Math.max(brightest, value);
    }
    // Auto-levels: stretch whatever range the source has over the whole ramp, so dark
    // shaders and washed-out photos both read; a flat source stays quiet.
    const range = Math.max(brightest - darkest, MIN_LEVEL_RANGE);
    for (let row = 0; row < rows; row += 1) {
      let line = "";
      for (let col = 0; col < cols; col += 1) {
        const level = ((luminance[row * cols + col] ?? 0) - darkest) / range;
        line += RAMP[Math.min(RAMP.length - 1, Math.floor(level * RAMP.length))] ?? " ";
      }
      context.fillText(line, 0, row * cell, width + cell);
    }
    return true;
  };

  // Paused, the loop stops asking for frames (the effect below starts it again); a still layer,
  // reduced motion or Lite effects draw once.
  const loop = (now: number) => {
    if (document.hidden || props.isPaused()) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    const isDrawn = render();
    if (isDrawn && (!props.isAnimated || isMotionReduced() || isLiteEffects())) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };

  const restart = () => {
    cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(loop);
  };

  onMount(() => {
    if (!canvas) return;
    const observer = new ResizeObserver(restart);
    observer.observe(canvas);
    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    });
  });

  createEffect(on([props.isPaused, isLiteEffects], ([isPaused]) => !isPaused && restart(), { defer: true }));

  // Any input change (source, size, colour, animation) draws again.
  createEffect(() => {
    props.source();
    props.placement?.();
    void props.cellPx;
    void props.color;
    void props.isAnimated;
    restart();
  });

  return <canvas ref={canvas} class={props.class} aria-hidden="true" />;
}
