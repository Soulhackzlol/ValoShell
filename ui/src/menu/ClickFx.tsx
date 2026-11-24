// A small burst where the player clicks, in the style's own idiom: block-break crumbs in
// Minecraft, stars in Fortnite, falling characters in the terminal, sparks in Counter-Strike,
// a shield ripple in Halo, shards and a ring in VALORANT. Plain elements animated with the
// Web Animations API, removed when done; off with reduced motion or in the Studio.
import { onCleanup, onMount } from "solid-js";
import { doc, isEditing } from "~/studio/store";
import { isMotionReduced } from "~/studio/spring";
import type { Skin } from "~/studio/types";
import styles from "./ClickFx.module.css";

/** At most this many bursts on screen, so mashing a button never piles up work. */
const MAX_LIVE = 6;

interface Burst {
  layer: HTMLElement;
  x: number;
  y: number;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

function spawn(burst: Burst, className: string, keyframes: Keyframe[], options: KeyframeAnimationOptions, text = ""): void {
  const element = document.createElement("span");
  element.className = className;
  element.textContent = text;
  element.style.left = `${burst.x}px`;
  element.style.top = `${burst.y}px`;
  burst.layer.append(element);
  element.animate(keyframes, { fill: "forwards", easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", ...options }).finished.then(
    () => element.remove(),
    () => element.remove(),
  );
}

/** Shards flung outward and fading, `count` of them. */
function shards(burst: Burst, className: string, count: number, reach: [number, number], durationMs: number, spin = 0): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + random(-0.3, 0.3);
    const distance = random(reach[0], reach[1]);
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const turn = spin ? random(-spin, spin) : 0;
    spawn(
      burst,
      className,
      [
        { transform: "translate(-50%, -50%) scale(1) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.4) rotate(${turn}deg)`, opacity: 0 },
      ],
      { duration: durationMs * random(0.8, 1.15) },
    );
  }
}

function ring(burst: Burst, className: string, size: number, durationMs: number): void {
  spawn(
    burst,
    className,
    [
      { transform: "translate(-50%, -50%) scale(0.2)", opacity: 1 },
      { transform: `translate(-50%, -50%) scale(${size / 10})`, opacity: 0 },
    ],
    { duration: durationMs },
  );
}

/** Crumbs that hop up and fall with gravity, like a block breaking. */
function crumbs(burst: Burst, className: string, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const dx = random(-46, 46);
    const rise = random(18, 42);
    const fall = random(40, 80);
    spawn(
      burst,
      className,
      [
        { transform: "translate(-50%, -50%)", opacity: 1, offset: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% - ${rise}px))`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${fall}px))`, opacity: 0, offset: 1 },
      ],
      { duration: random(520, 760), easing: "linear" },
    );
  }
}

/** Characters that drop and fade, phosphor style. */
function glyphs(burst: Burst, className: string, count: number): void {
  const chars = "01#$%&*+<>/\\=;:";
  for (let index = 0; index < count; index += 1) {
    const dx = random(-40, 40);
    const dy = random(20, 70);
    spawn(
      burst,
      className,
      [
        { transform: "translate(-50%, -50%)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`, opacity: 0 },
      ],
      { duration: random(500, 800), easing: "steps(6, end)" },
      chars[Math.floor(Math.random() * chars.length)] ?? "#",
    );
  }
}

const BURSTS: Record<Skin, (burst: Burst) => void> = {
  modern: (burst) => {
    ring(burst, styles.ring ?? "", 54, 420);
    shards(burst, styles.shard ?? "", 6, [26, 52], 460, 180);
  },
  glass: (burst) => {
    // A soft droplet of light under the finger with one hairline ring around it.
    spawn(
      burst,
      styles.drop ?? "",
      [
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.55 },
        { transform: "translate(-50%, -50%) scale(1.6)", opacity: 0 },
      ],
      { duration: 520 },
    );
    ring(burst, styles.thinRing ?? "", 44, 480);
  },
  current: (burst) => {
    ring(burst, styles.thinRing ?? "", 40, 320);
  },
  valnow: (burst) => {
    ring(burst, styles.ring ?? "", 48, 380);
    shards(burst, styles.shard ?? "", 5, [24, 46], 420, 120);
  },
  beta: (burst) => {
    ring(burst, styles.thinRing ?? "", 60, 520);
    shards(burst, styles.tick ?? "", 4, [20, 34], 420);
  },
  csgo: (burst) => shards(burst, styles.spark ?? "", 9, [18, 50], 340),
  cs2: (burst) => {
    ring(burst, styles.thinRing ?? "", 40, 300);
    shards(burst, styles.spark ?? "", 7, [16, 42], 300);
  },
  cs16: (burst) => shards(burst, styles.pixelSpark ?? "", 6, [10, 30], 260),
  terminal: (burst) => glyphs(burst, styles.glyph ?? "", 7),
  fortnite: (burst) => {
    ring(burst, styles.fatRing ?? "", 56, 420);
    shards(burst, styles.star ?? "", 6, [30, 64], 560, 220);
  },
  minecraft: (burst) => crumbs(burst, styles.crumb ?? "", 10),
  halo: (burst) => {
    ring(burst, styles.shield ?? "", 70, 620);
    ring(burst, styles.thinRing ?? "", 40, 420);
  },
  pipboy: (burst) => {
    ring(burst, styles.ring ?? "", 36, 260);
    shards(burst, styles.tick ?? "", 4, [14, 26], 240);
  },
  league: (burst) => {
    // A thin gold hextech ring.
    ring(burst, styles.ring ?? "", 44, 380);
  },
  phantom: (burst) => {
    // A comic-book hit: a fat ring and sharp shards flying out.
    ring(burst, styles.fatRing ?? "", 50, 340);
    shards(burst, styles.spark ?? "", 8, [28, 60], 380, 160);
  },
  nightcity: (burst) => {
    // A data burst: a hairline ring and hex glyphs scattering.
    ring(burst, styles.thinRing ?? "", 38, 280);
    glyphs(burst, styles.glyph ?? "", 5);
  },
};

export function ClickFx() {
  let layer: HTMLDivElement | undefined;
  const onPointerDown = (event: PointerEvent) => {
    if (!layer || event.button !== 0 || !doc.theme.fx.isClickFxOn || isEditing() || isMotionReduced()) return;
    if (layer.childElementCount > MAX_LIVE * 12) return;
    layer.style.setProperty("--fx-accent", doc.theme.accent);
    BURSTS[doc.theme.skin]({ layer, x: event.clientX, y: event.clientY });
  };
  onMount(() => window.addEventListener("pointerdown", onPointerDown, { passive: true }));
  onCleanup(() => window.removeEventListener("pointerdown", onPointerDown));
  return <div ref={layer} class={styles.layer} aria-hidden="true" />;
}
