// The VALORANT client's settings controls (on/off pair, slider with a number box, dropdown,
// key bind), shared by its own rows and ValoShell's app rows.
import { Index, Show, createSignal } from "solid-js";
import { ChevronDown } from "lucide-solid";
import { valLang } from "~/pieces/styled/valText";
import { playCue } from "./sound";
import type { Words } from "./valSettingsData";
import styles from "./ValSettings.module.css";

/** The words in the style's language. */
export const say = (words: Words) => words[valLang() === "es" ? 1 : 0];

export function OnOff(props: { value: boolean; onChange: (isOn: boolean) => void }) {
  const pick = (isOn: boolean) => {
    playCue("tab");
    props.onChange(isOn);
  };
  return (
    <span class={styles.onOff}>
      <button data-active={props.value ? "" : undefined} onClick={() => pick(true)}>
        {say(["On", "Activado"])}
      </button>
      <button data-active={props.value ? undefined : ""} onClick={() => pick(false)}>
        {say(["Off", "Desactivado"])}
      </button>
    </span>
  );
}

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Every step of a drag. */
  onChange: (value: number) => void;
  /** Once the value is settled (drag released, number typed); defaults to `onChange`. */
  onCommit?: (value: number) => void;
}

export function Slider(props: SliderProps) {
  const commit = (value: number) => (props.onCommit ?? props.onChange)(value);
  const digits = () => (props.step >= 1 ? 0 : props.step >= 0.01 ? 2 : 3);
  const fill = () => ((props.value - props.min) / (props.max - props.min)) * 100;
  return (
    <span class={styles.slider}>
      <input
        class={styles.number}
        value={props.value.toFixed(digits())}
        onChange={(event) => {
          const next = Number(event.currentTarget.value.replace(",", "."));
          if (Number.isFinite(next)) commit(Math.min(props.max, Math.max(props.min, next)));
        }}
      />
      <input
        class={styles.track}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        style={{ "--fill": `${fill()}%` }}
        onInput={(event) => props.onChange(Number(event.currentTarget.value))}
        onChange={(event) => props.onCommit?.(Number(event.currentTarget.value))}
      />
    </span>
  );
}

export function Dropdown(props: { value: number; options: readonly Words[]; onChange: (index: number) => void }) {
  const [isOpen, setOpen] = createSignal(false);
  return (
    <span class={styles.dropdown} onFocusOut={() => setOpen(false)}>
      <button
        class={styles.dropButton}
        data-open={isOpen() ? "" : undefined}
        onClick={() => {
          playCue("tab");
          setOpen(!isOpen());
        }}
      >
        <span>{say(props.options[props.value] ?? props.options[0] ?? ["", ""])}</span>
        <ChevronDown size={16} />
      </button>
      <Show when={isOpen()}>
        <span class={styles.dropList}>
          <Index each={props.options}>
            {(option, index) => (
              <button
                data-active={index === props.value ? "" : undefined}
                onMouseEnter={() => playCue("hover")}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  playCue("confirm");
                  props.onChange(index);
                  setOpen(false);
                }}
              >
                {say(option())}
              </button>
            )}
          </Index>
        </span>
      </Show>
    </span>
  );
}

export function Bind(props: { value: string; onChange: (key: string) => void }) {
  const [isListening, setListening] = createSignal(false);
  const keyName = (event: KeyboardEvent) => {
    if (event.code === "Space") return "Space";
    if (event.key === "Shift" || event.key === "Control" || event.key === "Alt") return `${event.location === 2 ? "R" : "L"}-${event.key === "Control" ? "Ctrl" : event.key}`;
    return event.key.length === 1 ? event.key.toUpperCase() : event.key;
  };
  return (
    <span class={styles.binds}>
      <button
        class={styles.bind}
        data-listening={isListening() ? "" : undefined}
        onClick={() => setListening(true)}
        onBlur={() => setListening(false)}
        onKeyDown={(event) => {
          if (!isListening()) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.key !== "Escape") props.onChange(keyName(event));
          playCue("confirm");
          setListening(false);
        }}
      >
        {isListening() ? "…" : props.value}
      </button>
      <button class={styles.bind} data-empty="" disabled aria-label="No second key">
        -
      </button>
    </span>
  );
}
