// Fragment shaders for the animated backdrops. Each is tinted by the theme (ground, accent,
// accent 2) and drifts on its own clock, never with the pointer (calm motion). GLSL ES 3.00
// (WebGL 2).
import type { ShaderId } from "~/studio/types";

export const VERTEX_SOURCE = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const HEADER = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uAccent2;
uniform vec3 uGround;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}
`;

/** Slow domain-warped smoke in the accent colours. */
const FLOW = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.05;
  vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 - t + 3.1));
  float f = fbm(p * 1.8 + 2.0 * q + vec2(t * 0.7, -t * 0.4));
  vec3 color = mix(uGround, uAccent, smoothstep(0.35, 0.95, f) * 0.5);
  color = mix(color, uAccent2, smoothstep(0.7, 1.0, f) * 0.2 * q.y);
  color *= 1.0 - 0.45 * length(uv - 0.5);
  outColor = vec4(color, 1.0);
}
`;

/** A perspective floor grid scrolling toward the horizon. */
const GRID = `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float horizon = -0.05;
  float below = step(p.y, horizon - 0.001);
  float depth = 0.35 / max(horizon - p.y, 0.001);
  vec2 cell = vec2(p.x * depth, depth + uTime * 0.6);
  vec2 edge = abs(fract(cell) - 0.5);
  float line = 0.5 - max(edge.x, edge.y);
  float width = fwidth(line) * 1.2;
  float stroke = 1.0 - smoothstep(0.0, width, line);
  float fade = clamp(1.0 - depth * 0.07, 0.0, 1.0);
  vec3 color = uGround;
  color = mix(color, uAccent, stroke * fade * below * 0.75);
  color = mix(color, uAccent2, 0.18 * exp(-abs(p.y - horizon) * 30.0));
  outColor = vec4(color, 1.0);
}
`;

/** Hard-edged diagonal bands sliding slowly, like the menu's slashes. */
const RIFT = `
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float angle = 0.42;
  float across = p.x * cos(angle) - p.y * sin(angle);
  vec3 color = uGround;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float speed = 0.01 + 0.012 * hash(vec2(fi, 1.0));
    float position = fract(hash(vec2(fi, 2.0)) + uTime * speed) * 3.2 - 1.6;
    float width = 0.01 + 0.12 * hash(vec2(fi, 3.0));
    float distanceToBand = abs(across - position);
    float band = 1.0 - smoothstep(width - 0.003, width, distanceToBand);
    vec3 tint = mix(uAccent, uAccent2, step(0.75, hash(vec2(fi, 4.0))));
    color = mix(color, tint, band * (0.05 + 0.2 * hash(vec2(fi, 5.0))));
  }
  color *= 1.0 - 0.35 * length(p * 0.6);
  outColor = vec4(color, 1.0);
}
`;

/** Quiet film static with faint scanlines. */
const STATIC = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float grain = hash(gl_FragCoord.xy + floor(uTime * 24.0));
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.5708);
  vec3 color = uGround + (grain - 0.5) * 0.05 + uAccent * 0.035 * scan;
  color *= 1.0 - 0.5 * length(uv - 0.5);
  outColor = vec4(color, 1.0);
}
`;

/** Bright foggy slate lit from the centre, like the CS:GO Panorama menu. */
const HAZE = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.03;
  vec2 q = vec2(fbm(p * 1.2 + t), fbm(p * 1.2 - t + 5.2));
  float f = fbm(p * 1.4 + 1.6 * q + vec2(t * 0.5, t * 0.2));
  float light = smoothstep(0.9, 0.0, length((uv - vec2(0.5, 0.62)) * vec2(1.0, 1.3)));
  vec3 base = mix(uGround, uAccent2, 0.3 + 0.45 * light);
  vec3 color = mix(base, uAccent2, smoothstep(0.45, 0.9, f) * 0.3);
  color *= 1.0 - 0.35 * length(uv - 0.5);
  outColor = vec4(color, 1.0);
}
`;

/** A bright radial lobby glow with slow-turning rays, like the Fortnite lobby. */
const BURST = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - vec2(0.5, 0.42) * uRes) / uRes.y;
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float rays = 0.5 + 0.5 * sin(angle * 18.0 + uTime * 0.12);
  rays = smoothstep(0.6, 1.0, rays) * smoothstep(1.1, 0.1, radius);
  vec3 center = mix(uAccent2, uGround, 0.3);
  vec3 color = mix(center, uGround, smoothstep(0.0, 0.95, radius));
  color += uAccent2 * rays * 0.09;
  color *= 1.0 - 0.3 * length(uv - 0.5);
  outColor = vec4(color, 1.0);
}
`;

/** Nested slate and crimson diamonds folded like paper, with stray red squares: the VALORANT
 *  client's home screen. Each facet catches the light a little differently. */
const DIAMONDS = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - vec2(0.485, 0.47) * uRes) / uRes.y;
  float d = abs(p.x) * 0.92 + abs(p.y);
  float rings = d * 2.3 - 0.38 + sin(uTime * 0.05) * 0.01;
  float ring = floor(rings);
  float edge = fract(rings);
  vec3 slate = mix(uGround, vec3(0.16, 0.2, 0.25), 0.65) * (0.9 + 0.2 * uv.y);
  float facet = (p.x < 0.0 ? 1.0 : 0.82) * (p.y < 0.0 ? 0.9 : 1.06);
  vec3 crimson = mix(uAccent * 0.26, uAccent * 0.46, smoothstep(0.2, 1.1, d)) * facet;
  bool isRed = mod(ring, 2.0) > 0.5 && ring > 0.5;
  vec3 color = isRed ? crimson : slate * mix(1.0, facet, 0.6);
  float line = smoothstep(0.012, 0.0, min(edge, 1.0 - edge) / 2.3);
  color += line * (isRed ? 0.05 : 0.03);
  vec2 cell = floor(gl_FragCoord.xy / 90.0);
  vec2 local = fract(gl_FragCoord.xy / 90.0);
  float spot = step(hash(cell + 7.0), 0.018) * step(max(abs(local.x - 0.5), abs(local.y - 0.5)), 0.055);
  color = mix(color, uAccent * 0.85, spot);
  color *= 1.0 - 0.32 * length((uv - 0.5) * vec2(1.1, 1.0));
  outColor = vec4(color, 1.0);
}
`;

/** A powered phosphor screen: dark green with a soft centre glow, fine grain, scanlines and the
 *  slow bright band of a CRT's refresh rolling down, like a Pip-Boy's display. */
const CRT = `
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 c = uv - 0.5;
  float glow = smoothstep(0.85, 0.0, length(c * vec2(1.0, 1.25)));
  vec3 color = uGround + uAccent * (0.025 + 0.06 * glow);
  float grain = hash(gl_FragCoord.xy + floor(uTime * 18.0)) - 0.5;
  color += uAccent * grain * 0.025;
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 2.0944);
  color *= 0.9 + 0.1 * scan;
  float band = fract(uv.y + uTime * 0.07);
  color += uAccent * 0.035 * smoothstep(0.0, 0.08, band) * smoothstep(0.16, 0.08, band);
  color *= 1.0 - 0.55 * pow(length(c * vec2(1.05, 1.2)), 1.6);
  outColor = vec4(color, 1.0);
}
`;

const BODIES: Record<ShaderId, string> = { flow: FLOW, grid: GRID, rift: RIFT, static: STATIC, haze: HAZE, burst: BURST, diamonds: DIAMONDS, crt: CRT };

export function fragmentSource(id: ShaderId): string {
  return HEADER + BODIES[id];
}

export const SHADER_OPTIONS: readonly { value: ShaderId; label: string }[] = [
  { value: "flow", label: "Smoke" },
  { value: "rift", label: "Rift" },
  { value: "grid", label: "Grid" },
  { value: "static", label: "Static" },
  { value: "haze", label: "Haze" },
  { value: "burst", label: "Burst" },
  { value: "diamonds", label: "Diamonds" },
  { value: "crt", label: "Phosphor CRT" },
];
