// Theme tab sections for the backdrop's framing and motion, and for the menu sounds.
import { For, Show, createMemo } from "solid-js";
import { type SoundCue, playCue, previewCue } from "~/menu/sound";
import { openSoundsFolder, reloadUiSounds, uiSounds } from "~/state/uiSounds";
import { Range, Switch, controls } from "~/ui/controls";
import { SKINS, skinLabel } from "../skins";
import { doc, updateTheme } from "../store";
import { replayIntro } from "~/menu/Intro";
import { resolveTransition } from "~/menu/SceneWipe";
import type { BackdropMotion, SceneTransitionKind, SoundPack } from "../types";
import styles from "../studio.module.css";

const MOTIONS: readonly { value: BackdropMotion; label: string }[] = [
  { value: "none", label: "Still" },
  { value: "drift", label: "Drift" },
  { value: "zoom", label: "Ken Burns" },
  { value: "pan", label: "Pan" },
  { value: "sway", label: "Sway" },
  { value: "pulse", label: "Pulse" },
  { value: "orbit", label: "Orbit" },
];

/** Furthest shift either way, in % of the screen. */
const MAX_SHIFT = 30;
/** The figure may walk further, e.g. down far enough to frame just the head and shoulders. */
const MAX_FIGURE_SHIFT = 60;

// ---- framing and motion -----------------------------------------------------------------

/** Drag the dot to move something by up to ±max %; double-click re-centres it. */
function ShiftPad(props: { label: string; x: number; y: number; max: number; onMove: (x: number, y: number) => void }) {
  let pad: HTMLDivElement | undefined;
  const moveTo = (event: PointerEvent) => {
    if (!pad) return;
    const box = pad.getBoundingClientRect();
    const toShift = (ratio: number) => Math.round((Math.min(1, Math.max(0, ratio)) * 2 - 1) * props.max);
    props.onMove(toShift((event.clientX - box.left) / box.width), toShift((event.clientY - box.top) / box.height));
  };
  const toPercent = (shift: number) => `${((shift / props.max + 1) / 2) * 100}%`;
  return (
    <div
      ref={pad}
      class={styles.shiftPad}
      role="slider"
      aria-label={props.label}
      aria-valuetext={`${props.x}% across, ${props.y}% down`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        moveTo(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
      }}
      onDblClick={() => props.onMove(0, 0)}
    >
      <span class={styles.shiftCross} />
      <span class={styles.shiftDot} style={{ left: toPercent(props.x), top: toPercent(props.y) }} />
    </div>
  );
}

/** Where the agent stands on the agent backdrop (also what the ASCII redraw follows). */
export function FigureControls() {
  const backdrop = () => doc.theme.backdrop;
  return (
    <div class={styles.framingRow}>
      <ShiftPad
        label="Agent position"
        x={backdrop().figureX}
        y={backdrop().figureY}
        max={MAX_FIGURE_SHIFT}
        onMove={(x, y) =>
          updateTheme((draft) => {
            draft.backdrop.figureX = x;
            draft.backdrop.figureY = y;
          }, "theme.backdrop.figure")
        }
      />
      <div class={styles.framingRanges}>
        <Range
          label="Agent size"
          value={backdrop().figureScale}
          min={0.4}
          max={2.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onInput={(value) => updateTheme((draft) => void (draft.backdrop.figureScale = value), "theme.backdrop.figureScale")}
        />
        <button
          class={`${controls.button} ${controls.ghost} ${controls.small}`}
          onClick={() => updateTheme((draft) => void Object.assign(draft.backdrop, { figureX: 0, figureY: 0, figureScale: 1 }))}
        >
          Reset agent
        </button>
      </div>
    </div>
  );
}

export function FramingSection() {
  const backdrop = () => doc.theme.backdrop;
  return (
    <section class={styles.section}>
      <span class="overline">Framing and motion</span>
      <div class={styles.framingRow}>
        <ShiftPad
          label="Picture position"
          x={backdrop().offsetX}
          y={backdrop().offsetY}
          max={MAX_SHIFT}
          onMove={(x, y) =>
            updateTheme((draft) => {
              draft.backdrop.offsetX = x;
              draft.backdrop.offsetY = y;
            }, "theme.backdrop.shift")
          }
        />
        <div class={styles.framingRanges}>
          <Range
            label="Zoom"
            value={backdrop().zoom}
            min={1}
            max={2.5}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onInput={(value) => updateTheme((draft) => void (draft.backdrop.zoom = value), "theme.backdrop.zoom")}
          />
          <Range
            label="Tilt"
            value={backdrop().rotate}
            min={-20}
            max={20}
            step={0.5}
            format={(value) => `${value}°`}
            onInput={(value) => updateTheme((draft) => void (draft.backdrop.rotate = value), "theme.backdrop.rotate")}
          />
        </div>
      </div>
      <div class={styles.kindGrid} role="radiogroup" aria-label="Motion">
        <For each={MOTIONS}>
          {(option) => (
            <button
              role="radio"
              aria-checked={backdrop().motion === option.value}
              class={styles.kind}
              data-active={backdrop().motion === option.value ? "" : undefined}
              onClick={() => {
                playCue("tab");
                updateTheme((draft) => void (draft.backdrop.motion = option.value));
              }}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
      <Show when={backdrop().motion !== "none"}>
        <Range
          label="Speed"
          value={backdrop().motionSpeed}
          min={0.25}
          max={3}
          step={0.05}
          format={(value) => `${value.toFixed(2)}×`}
          onInput={(value) => updateTheme((draft) => void (draft.backdrop.motionSpeed = value), "theme.backdrop.speed")}
        />
      </Show>
      <Range
        label="Hue"
        value={backdrop().hue}
        min={-180}
        max={180}
        step={1}
        format={(value) => `${value}°`}
        onInput={(value) => updateTheme((draft) => void (draft.backdrop.hue = value), "theme.backdrop.hue")}
      />
      <Range
        label="Saturation"
        value={backdrop().saturation}
        min={0}
        max={2}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onInput={(value) => updateTheme((draft) => void (draft.backdrop.saturation = value), "theme.backdrop.saturation")}
      />
      <button
        class={`${controls.button} ${controls.ghost} ${controls.small}`}
        onClick={() => {
          playCue("back");
          updateTheme((draft) => {
            Object.assign(draft.backdrop, { offsetX: 0, offsetY: 0, zoom: 1, rotate: 0, hue: 0, saturation: 1 });
          });
        }}
      >
        Reset framing
      </button>
    </section>
  );
}

// ---- sound ------------------------------------------------------------------------------

const PREVIEW_CUES: readonly { cue: SoundCue; label: string }[] = [
  { cue: "hover", label: "Hover" },
  { cue: "tab", label: "Tab" },
  { cue: "confirm", label: "Press" },
  { cue: "back", label: "Back" },
  { cue: "found", label: "Match" },
];

const SOURCE_NAMES: Record<string, string> = { minecraft: "Minecraft", cs16: "CS 1.6", folder: "your folder" };

export function SoundSection() {
  const sound = () => doc.theme.sound;
  const packs: readonly { value: SoundPack; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "off", label: "Off" },
    ...SKINS.map((skin) => ({ value: skin.id as SoundPack, label: skin.label })),
  ];
  const heard = () => {
    const pack = sound().pack;
    return pack === "auto" ? doc.theme.skin : pack === "off" ? null : pack;
  };
  /** "Minecraft (4), your folder (2)": what the real-files switch would use. */
  const foundText = createMemo(() => {
    const counts = new Map<string, number>();
    for (const file of uiSounds()) counts.set(file.source, (counts.get(file.source) ?? 0) + 1);
    return [...counts].map(([source, count]) => `${SOURCE_NAMES[source] ?? source} (${count})`).join(", ");
  });
  return (
    <section class={styles.section}>
      <span class="overline">Sound</span>
      <div class={styles.kindGrid} role="radiogroup" aria-label="Sound pack">
        <For each={packs}>
          {(option) => (
            <button
              role="radio"
              aria-checked={sound().pack === option.value}
              class={styles.kind}
              data-active={sound().pack === option.value ? "" : undefined}
              title={option.value === "auto" ? "Follow the menu style" : option.label}
              onClick={() => {
                updateTheme((draft) => void (draft.sound.pack = option.value));
                playCue("confirm");
              }}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
      <Show when={heard()}>
        {(pack) => (
          <div class={styles.cueRow}>
            <span class={styles.muted}>Try {skinLabel(pack())}:</span>
            <For each={PREVIEW_CUES}>
              {(entry) => (
                <button class={styles.cueButton} onClick={() => previewCue(pack(), entry.cue)}>
                  {entry.label}
                </button>
              )}
            </For>
          </div>
        )}
      </Show>
      <Range
        label="Volume"
        value={sound().volume}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onInput={(value) => updateTheme((draft) => void (draft.sound.volume = value), "theme.sound.volume")}
      />
      <Switch title="Hover sounds" isOn={sound().isHoverOn} onChange={(value) => updateTheme((draft) => void (draft.sound.isHoverOn = value))} />
      <Switch
        title="Real game sounds"
        hint={foundText() ? `Found: ${foundText()}` : "None found yet: install Minecraft or CS 1.6, or add files to the folder"}
        isOn={sound().useFiles}
        onChange={(value) => updateTheme((draft) => void (draft.sound.useFiles = value))}
      />
      <div class={styles.cueRow}>
        <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={openSoundsFolder}>
          Open sounds folder
        </button>
        <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={() => void reloadUiSounds()}>
          Reload
        </button>
      </div>
      <p class={styles.muted}>
        Name files after the cue (hover, tab, confirm, back, found) inside a folder named after the style, like csgo/confirm.wav, or all/ for
        every style.
      </p>
    </section>
  );
}

// ---- screen transitions -----------------------------------------------------------------

const TRANSITIONS: readonly { value: SceneTransitionKind; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "none", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
  { value: "blur", label: "Blur" },
  { value: "build", label: "Build" },
  { value: "glass", label: "Glass" },
  { value: "shutter", label: "Shutter" },
  { value: "pixel", label: "Stepped" },
  { value: "wipe", label: "Wipe" },
];

export function TransitionSection() {
  const transition = () => doc.theme.transition;
  const autoLabel = () => TRANSITIONS.find((option) => option.value === resolveTransition("auto", doc.theme.skin))?.label ?? "";
  return (
    <section class={styles.section}>
      <span class="overline">Screen transitions</span>
      <div class={styles.kindGrid} role="radiogroup" aria-label="Transition">
        <For each={TRANSITIONS}>
          {(option) => (
            <button
              role="radio"
              aria-checked={transition().kind === option.value}
              class={styles.kind}
              data-active={transition().kind === option.value ? "" : undefined}
              title={option.value === "auto" ? `The style's own (${autoLabel()})` : option.label}
              onClick={() => {
                playCue("tab");
                updateTheme((draft) => void (draft.transition.kind = option.value));
              }}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
      <Show when={transition().kind !== "none"}>
        <Range
          label="Duration"
          value={transition().speed}
          min={0.5}
          max={2}
          step={0.05}
          format={(value) => `${value.toFixed(2)}×`}
          onInput={(value) => updateTheme((draft) => void (draft.transition.speed = value), "theme.transition.speed")}
        />
      </Show>
      <p class={styles.muted}>Auto uses {autoLabel()} for this style. Switch tabs (Q / E) to see it.</p>
    </section>
  );
}

// ---- showpiece extras --------------------------------------------------------------------

export function FxSection() {
  const fx = () => doc.theme.fx;
  return (
    <section class={styles.section}>
      <span class="overline">Extras</span>
      <Switch
        title="Launch intro"
        hint="The style's own intro when ValoShell opens"
        isOn={fx().isIntroOn}
        onChange={(value) => updateTheme((draft) => void (draft.fx.isIntroOn = value))}
      />
      <Switch
        title="Style cursor"
        hint="The style's own mouse pointer (not while editing)"
        isOn={fx().isCursorOn}
        onChange={(value) => updateTheme((draft) => void (draft.fx.isCursorOn = value))}
      />
      <Switch
        title="Click effects"
        hint="A small burst where you click (not while editing)"
        isOn={fx().isClickFxOn}
        onChange={(value) => updateTheme((draft) => void (draft.fx.isClickFxOn = value))}
      />
      <button
        class={`${controls.button} ${controls.ghost} ${controls.small}`}
        onClick={() => {
          playCue("confirm");
          replayIntro();
        }}
      >
        Replay intro
      </button>
    </section>
  );
}
