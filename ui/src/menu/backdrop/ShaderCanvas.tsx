// WebGL 2 backdrop: one full-screen triangle and a theme-tinted fragment shader. Rendered at
// half resolution and at most 30 fps; it stops while the window is hidden, while a match
// is live, or when motion is reduced (one still frame). Without WebGL 2 nothing renders and
// the plain backdrop shows through.
import { createEffect, on, onCleanup, onMount, untrack } from "solid-js";
import { isLiteEffects } from "~/state/performance";
import { isMotionReduced } from "~/studio/spring";
import type { ShaderId } from "~/studio/types";
import { hexToRgbTriplet } from "~/studio/theme";
import { VERTEX_SOURCE, fragmentSource } from "./shaders";

const FRAME_MS = 1000 / 30;
const RESOLUTION_SCALE = 0.5;

export interface ShaderColors {
  accent: string;
  accent2: string;
  ground: string;
}

function rgb(hex: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = hexToRgbTriplet(hex).split(" ").map(Number);
  return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("backdrop shader failed to compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, id: ShaderId): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource(id));
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("backdrop shader failed to link", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** One frame: the theme colours and the time in seconds, on the full-screen triangle. */
function drawFrame(gl: WebGL2RenderingContext, program: WebGLProgram, colors: ShaderColors, seconds: number): void {
  const canvas = gl.canvas;
  gl.useProgram(program);
  gl.uniform2f(gl.getUniformLocation(program, "uRes"), canvas.width, canvas.height);
  gl.uniform1f(gl.getUniformLocation(program, "uTime"), seconds);
  gl.uniform3f(gl.getUniformLocation(program, "uAccent"), ...rgb(colors.accent));
  gl.uniform3f(gl.getUniformLocation(program, "uAccent2"), ...rgb(colors.accent2));
  gl.uniform3f(gl.getUniformLocation(program, "uGround"), ...rgb(colors.ground));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** The context with the one triangle that covers the screen, or null without WebGL 2. */
function createContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return gl;
}

/** Links `id` and points its position attribute at the triangle. */
function linkOnTriangle(gl: WebGL2RenderingContext, id: ShaderId): WebGLProgram | null {
  const program = link(gl, id);
  if (!program) return null;
  const position = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  return program;
}

interface ShaderCanvasProps {
  shader: ShaderId;
  colors: ShaderColors;
  isPaused: () => boolean;
  class?: string | undefined;
  onCanvas?: (canvas: HTMLCanvasElement) => void;
}

export function ShaderCanvas(props: ShaderCanvasProps) {
  let canvas: HTMLCanvasElement | undefined;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let frame = 0;
  let last = 0;
  const started = performance.now();

  const draw = (now: number) => {
    if (gl && program) drawFrame(gl, program, props.colors, (now - started) / 1000);
  };

  // Resizing a canvas wipes it. With motion reduced the loop has already stopped after its one
  // frame, so the frame is drawn again here or the backdrop would turn black.
  const resize = () => {
    if (!canvas) return;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * RESOLUTION_SCALE));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * RESOLUTION_SCALE));
    gl?.viewport(0, 0, canvas.width, canvas.height);
    draw(performance.now());
  };

  // Paused, the loop stops asking for frames at all (a waiting loop would keep the page drawing
  // at the screen's rate); restart() starts it again. Reduced motion and Lite effects draw one
  // still frame.
  const loop = (now: number) => {
    if (document.hidden || props.isPaused()) {
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
    if (isMotionReduced() || isLiteEffects()) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    last = 0;
    frame = requestAnimationFrame(loop);
  };

  createEffect(on([props.isPaused, isLiteEffects], ([isPaused]) => !isPaused && restart(), { defer: true }));

  onMount(() => {
    if (!canvas) return;
    gl = createContext(canvas);
    if (!gl) return;
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    props.onCanvas?.(canvas);
    onCleanup(() => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
  });

  // A new shader recompiles; the loop keeps running. Untracked: the first frame reads the
  // colours, and a colour change must only redraw (below), never relink the program.
  createEffect(() => {
    const id = props.shader;
    if (!gl) return;
    if (program) gl.deleteProgram(program);
    program = linkOnTriangle(gl, id);
    if (!program) return;
    untrack(() => {
      resize();
      restart();
    });
  });

  // New colours (another style or palette) need a frame of their own once the loop has stopped.
  const colorKey = () => [props.colors.accent, props.colors.accent2, props.colors.ground];
  createEffect(on(colorKey, () => draw(performance.now()), { defer: true }));

  return <canvas ref={canvas} class={props.class} aria-hidden="true" />;
}
