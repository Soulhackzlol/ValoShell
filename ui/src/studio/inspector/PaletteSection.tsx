// Studio > Theme colours that belong to the active style: its PLAY button (PlayField, in the
// Colours section) and its own named roles (Style colours, from theme/palettes.ts). Each shows
// the style's colour until changed; a changed one gets its own reset back to the style's.
import { For, Show } from "solid-js";
import { RotateCcw } from "lucide-solid";
import { type PaletteEntry, paletteOf } from "~/theme/palettes";
import { ColorField, controls } from "~/ui/controls";
import { SKINS } from "../skins";
import { doc, updateTheme } from "../store";
import styles from "../studio.module.css";

/** For a saved look whose style id is no longer in SKINS. */
const DEFAULT_PLAY = "#ff4655";

function setRole(token: string, value: string | null): void {
  updateTheme((theme) => {
    if (value === null) delete theme.palette[token];
    else theme.palette[token] = value;
  }, `palette.${token}`);
}

function RoleField(props: { entry: PaletteEntry }) {
  const own = () => doc.theme.palette[props.entry.token];
  return (
    <div class={styles.colorProp}>
      <ColorField
        label={props.entry.label}
        value={own() ?? props.entry.value}
        onInput={(value) => setRole(props.entry.token, value)}
      />
      <Show when={own()}>
        <button
          class={`${controls.button} ${controls.ghost} ${controls.small}`}
          title="Back to the style's colour"
          onClick={() => setRole(props.entry.token, null)}
        >
          Reset
        </button>
      </Show>
    </div>
  );
}

/** The PLAY button colour for every style; shows the style's own until one is picked. */
export function PlayField() {
  const own = () => doc.theme.play;
  const styleOwn = () => SKINS.find((skin) => skin.id === doc.theme.skin)?.play ?? DEFAULT_PLAY;
  const set = (value: string) => updateTheme((theme) => void (theme.play = value), "theme.play");
  return (
    <div class={styles.colorProp}>
      <ColorField
        label={own() ? "Play button" : "Play button (the style's)"}
        value={own() || styleOwn()}
        onInput={set}
      />
      <Show when={own()}>
        <button
          class={`${controls.button} ${controls.ghost} ${controls.small}`}
          title="Back to the style's Play colour"
          onClick={() => set("")}
        >
          Style's
        </button>
      </Show>
    </div>
  );
}

export function PaletteSection() {
  const entries = () => paletteOf(doc.theme.skin);
  const isRecoloured = () => entries().some((entry) => doc.theme.palette[entry.token] !== undefined);
  const resetAll = () =>
    updateTheme((theme) => {
      for (const entry of entries()) delete theme.palette[entry.token];
    });
  return (
    <Show when={entries().length > 0}>
      <section class={styles.section}>
        <span class="overline">Style colours</span>
        <For each={entries()}>{(entry) => <RoleField entry={entry} />}</For>
        <Show when={isRecoloured()}>
          <button class={`${controls.button} ${controls.ghost}`} onClick={resetAll}>
            <RotateCcw size={14} /> Reset style colours
          </button>
        </Show>
      </section>
    </Show>
  );
}
