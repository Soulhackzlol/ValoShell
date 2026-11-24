// The Theme tab: looks, the menu style, colour presets and colours, the style's own colour
// roles, the backdrop, framing, sounds, transitions, extras, shape and type, and a full reset.
import { For } from "solid-js";
import { RotateCcw } from "lucide-solid";
import { playCue } from "~/menu/sound";
import { ColorField, Range, Segmented, controls } from "~/ui/controls";
import { THEME_PRESETS } from "../defaults";
import { SKINS } from "../skins";
import { switchStyle } from "../styleSwitch";
import { doc, mutate, resetEverything, updateTheme } from "../store";
import { animateChange } from "../transitions";
import type { DisplayFont, MenuLanguage } from "../types";
import styles from "../studio.module.css";
import { BackdropSection } from "./BackdropSection";
import { LooksSection } from "./LooksSection";
import { PaletteSection, PlayField } from "./PaletteSection";
import { FramingSection, FxSection, SoundSection, TransitionSection } from "./ThemeExtras";

const RESET_ICON_PX = 14;

const LANGUAGES: readonly { value: MenuLanguage; label: string }[] = [
  { value: "auto", label: "System" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const DISPLAY_FONTS: readonly { value: DisplayFont; label: string }[] = [
  { value: "saira", label: "Saira" },
  { value: "tall", label: "Tall" },
  { value: "inter", label: "Inter" },
  { value: "mono", label: "Mono" },
  { value: "pixel", label: "Pixel" },
  { value: "classic", label: "Classic" },
  { value: "robco", label: "Pip-Boy" },
  { value: "poster", label: "Poster" },
  { value: "tech", label: "Tech" },
];

type ThemeColour = "accent" | "accent2" | "ground" | "text";

const COLOURS: readonly { key: ThemeColour; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "accent2", label: "Highlight" },
  { key: "ground", label: "Background" },
  { key: "text", label: "Text" },
];

function StyleSection() {
  return (
    <section class={styles.section}>
      <span class="overline">Style</span>
      <div class={styles.skins} role="radiogroup">
        <For each={SKINS}>
          {(skin) => (
            <button
              role="radio"
              aria-checked={doc.theme.skin === skin.id}
              class={styles.skin}
              data-active={doc.theme.skin === skin.id ? "" : undefined}
              style={{ "--g": skin.ground, "--a": skin.accent, "--p": skin.play, "--t": skin.text }}
              onClick={() => {
                playCue("confirm");
                animateChange(() => mutate((draft) => switchStyle(draft, skin)), "build");
              }}
            >
              <span class={styles.skinPreview} data-skin={skin.id}>
                <span class={styles.skinNav} />
                <span class={styles.skinPlay} />
              </span>
              <span class={styles.skinLabel}>{skin.label}</span>
              <span class={styles.skinCaption}>{skin.caption}</span>
            </button>
          )}
        </For>
      </div>
      <p class={styles.muted}>Also lays out the screens it styles (Home, Play, Career, and Store for some) with its own pieces. Ctrl+Z undoes it.</p>
      <div class={styles.selectField}>
        <span class="overline">Menu words (VALORANT styles)</span>
        <Segmented value={doc.theme.language} options={LANGUAGES} onChange={(value) => updateTheme((draft) => void (draft.language = value), "theme.language")} />
      </div>
    </section>
  );
}

function PresetsSection() {
  const applyPreset = (preset: (typeof THEME_PRESETS)[number]) => {
    playCue("confirm");
    animateChange(() =>
      updateTheme((draft) => {
        draft.preset = preset.id;
        draft.accent = preset.accent;
        draft.accent2 = preset.accent2;
        draft.ground = preset.ground;
        draft.text = preset.text;
      }),
    );
  };
  return (
    <section class={styles.section}>
      <span class="overline">Presets</span>
      <div class={styles.presets}>
        <For each={THEME_PRESETS}>
          {(preset) => (
            <button
              class={styles.preset}
              data-active={doc.theme.preset === preset.id ? "" : undefined}
              style={{ "--a": preset.accent, "--b": preset.accent2, "--g": preset.ground }}
              title={preset.label}
              onClick={() => applyPreset(preset)}
            >
              <span class={styles.presetSwatch} />
              <span class={styles.presetLabel}>{preset.label}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}

function ColoursSection() {
  /** A hand-picked colour leaves the preset behind. */
  const setColour = (key: ThemeColour, value: string) =>
    updateTheme((draft) => {
      draft[key] = value;
      draft.preset = "custom";
    }, `theme.${key}`);
  return (
    <section class={styles.section}>
      <span class="overline">Colours</span>
      <For each={COLOURS}>{(colour) => <ColorField label={colour.label} value={doc.theme[colour.key]} onInput={(value) => setColour(colour.key, value)} />}</For>
      <PlayField />
    </section>
  );
}

function ShapeSection() {
  return (
    <section class={styles.section}>
      <span class="overline">Shape and type</span>
      <Segmented<DisplayFont> value={doc.theme.displayFont} options={DISPLAY_FONTS} onChange={(value) => updateTheme((draft) => void (draft.displayFont = value))} />
      <Range
        label="Cut corners"
        value={doc.theme.cut}
        min={0}
        max={32}
        step={1}
        format={(value) => `${value}px`}
        onInput={(value) => updateTheme((draft) => void (draft.cut = value), "theme.cut")}
      />
    </section>
  );
}

export function ThemeTab() {
  const reset = () => {
    playCue("back");
    resetEverything();
  };
  return (
    <div class={styles.stack}>
      <LooksSection />
      <StyleSection />
      <PresetsSection />
      <ColoursSection />
      <PaletteSection />
      <BackdropSection />
      <FramingSection />
      <SoundSection />
      <TransitionSection />
      <FxSection />
      <ShapeSection />
      <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={reset}>
        <RotateCcw size={RESET_ICON_PX} /> Reset everything
      </button>
    </div>
  );
}
