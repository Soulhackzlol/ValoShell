// Small shared controls: switch, segmented picker, range with value, colour, text field.
import { For, Show, type JSX } from "solid-js";
import { playCue } from "~/menu/sound";
import styles from "./controls.module.css";

export { styles as controls };

export function Switch(props: { isOn: boolean; onChange: (isOn: boolean) => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      class={styles.switch}
      data-on={props.isOn ? "" : undefined}
      role="switch"
      aria-checked={props.isOn}
      onClick={() => {
        playCue(props.isOn ? "back" : "confirm");
        props.onChange(!props.isOn);
      }}
    >
      <span class={styles.track}>
        <span class={styles.thumb} />
      </span>
      <span class={styles.switchLabel}>
        <span class={styles.switchTitle}>{props.title}</span>
        <Show when={props.hint}>
          <span class={styles.switchHint}>{props.hint}</span>
        </Show>
      </span>
    </button>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

/** A pick of one option; `columns` wraps many options into a grid instead of one row. */
export function Segmented<T extends string>(props: {
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      class={styles.segmented}
      role="radiogroup"
      style={props.columns ? { display: "grid", "grid-template-columns": `repeat(${props.columns}, minmax(0, 1fr))` } : undefined}
    >
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            role="radio"
            aria-checked={props.value === option.value}
            class={styles.segment}
            title={option.label}
            data-active={props.value === option.value ? "" : undefined}
            onClick={() => {
              playCue("tab");
              props.onChange(option.value);
            }}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}

export function Field(props: { label: string; value?: string; children: JSX.Element }) {
  return (
    <label class={styles.field}>
      <span class={styles.fieldLabel}>
        {props.label}
        <Show when={props.value !== undefined}>
          <span class={styles.fieldValue}>{props.value}</span>
        </Show>
      </span>
      {props.children}
    </label>
  );
}

export function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  onInput: (value: number) => void;
  /** Once the value is settled (drag released, keys let go). */
  onCommit?: (value: number) => void;
}) {
  const fill = () => `${((props.value - props.min) / (props.max - props.min || 1)) * 100}%`;
  return (
    <Field label={props.label} value={props.format ? props.format(props.value) : String(props.value)}>
      <input
        class={styles.range}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        style={{ "--fill": fill() }}
        onInput={(event) => props.onInput(Number(event.currentTarget.value))}
        onChange={(event) => props.onCommit?.(Number(event.currentTarget.value))}
      />
    </Field>
  );
}

/** A colour pick; an empty value means "not set" (the style's own colour is used), shown as a
 *  dimmed swatch and the placeholder rather than a made-up colour. */
export function ColorField(props: { label: string; value: string; placeholder?: string; onInput: (value: string) => void }) {
  return (
    <Field label={props.label} value={props.value.toUpperCase()}>
      <span class={styles.color}>
        <input
          type="color"
          value={props.value || "#ffffff"}
          data-unset={props.value ? undefined : ""}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
        <input
          class={styles.input}
          value={props.value}
          placeholder={props.placeholder ?? ""}
          spellcheck={false}
          onChange={(event) => {
            const value = event.currentTarget.value.trim();
            if (/^#[0-9a-f]{6}$/i.test(value)) props.onInput(value);
          }}
        />
      </span>
    </Field>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  placeholder?: string;
  isMultiline?: boolean;
  onInput: (value: string) => void;
}) {
  return (
    <Field label={props.label}>
      <Show
        when={props.isMultiline}
        fallback={
          <input
            class={styles.input}
            value={props.value}
            placeholder={props.placeholder ?? ""}
            spellcheck={false}
            onInput={(event) => props.onInput(event.currentTarget.value)}
          />
        }
      >
        <textarea
          class={styles.input}
          value={props.value}
          placeholder={props.placeholder ?? ""}
          onInput={(event) => props.onInput(event.currentTarget.value)}
        />
      </Show>
    </Field>
  );
}

export function Empty(props: { title: string; children?: JSX.Element }) {
  return (
    <div class={styles.empty}>
      <div>
        <div class={styles.emptyTitle}>{props.title}</div>
        <Show when={props.children}>
          <div>{props.children}</div>
        </Show>
      </div>
    </div>
  );
}
