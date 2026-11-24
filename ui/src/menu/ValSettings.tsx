// The VALORANT style's settings screen, laid out like the client's: tabs across the top, rows
// of label + control in a centred column, Restore defaults and Close settings at the bottom.
// The crosshair tab draws a live preview. A last tab holds ValoShell's own settings.
import { For, Match, Show, Switch, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { useConfirmPress } from "~/ui/confirmPress";
import { playCue } from "./sound";
import { AppControl } from "./valAppControls";
import { Bind, Dropdown, OnOff, Slider, say } from "./valControls";
import { CROSSHAIR_COLORS, type Row, TABS, resetValues, setValue, values } from "./valSettingsData";
import styles from "./ValSettings.module.css";

export function ValSettings(props: { onClose: () => void; onClassic: () => void }) {
  const [tab, setTab] = createSignal(TABS[0]?.id ?? "general");
  const current = () => TABS.find((entry) => entry.id === tab());
  const keys = () => (current()?.rows ?? []).flatMap((row) => ("key" in row && row.kind !== "app" ? [row.key] : []));
  // Restoring a whole tab can't be undone, so it asks for a second press first.
  const restore = useConfirmPress(() => {
    playCue("back");
    resetValues(keys());
  });
  return (
    <Portal>
      <div class={styles.screen} role="dialog" aria-label="Settings">
        <nav class={styles.tabs}>
          <For each={TABS}>
            {(entry) => (
              <button
                class={styles.tab}
                data-active={tab() === entry.id ? "" : undefined}
                onMouseEnter={() => playCue("hover")}
                onClick={() => {
                  playCue("tab");
                  setTab(entry.id);
                }}
              >
                {say(entry.label)}
              </button>
            )}
          </For>
          <button class={styles.tab} data-app="" onMouseEnter={() => playCue("hover")} onClick={() => props.onClassic()}>
            ValoShell
          </button>
        </nav>
        <div class={styles.body}>
          <Show when={tab() === "crosshair"}>
            <CrosshairPreview />
          </Show>
          <div class={styles.rows}>
            <For each={current()?.rows ?? []}>{(row) => <SettingRow row={row} />}</For>
          </div>
        </div>
        <footer class={styles.footer}>
          <button
            class={styles.restore}
            data-armed={restore.isArmed() ? "" : undefined}
            onMouseEnter={() => playCue("hover")}
            onClick={() => restore.press()}
          >
            {restore.isArmed()
              ? say(["Click again to restore", "Pulsa otra vez para restablecer"])
              : say(["Restore defaults", "Restablecer valores predeterminados"])}
          </button>
          <button class={styles.close} onMouseEnter={() => playCue("hover")} onClick={() => props.onClose()}>
            {say(["Close settings", "Cerrar ajustes"])}
          </button>
        </footer>
      </div>
    </Portal>
  );
}

function SettingRow(props: { row: Row }) {
  return (
    <Switch>
      <Match when={props.row.kind === "section"}>
        <h3 class={styles.section}>{say(props.row.label)}</h3>
      </Match>
      <Match when={true}>
        <div class={styles.row}>
          <span class={styles.label}>{say(props.row.label)}</span>
          <span class={styles.control}>
            <Control row={props.row} />
          </span>
        </div>
      </Match>
    </Switch>
  );
}

function Control(props: { row: Row }) {
  const row = props.row;
  switch (row.kind) {
    case "toggle":
      return <OnOff value={values()[row.key] === true} onChange={(isOn) => setValue(row.key, isOn)} />;
    case "slider":
      return <Slider value={Number(values()[row.key] ?? 0)} min={row.min} max={row.max} step={row.step} onChange={(value) => setValue(row.key, value)} />;
    case "select":
      return <Dropdown value={Number(values()[row.key] ?? 0)} options={row.options} onChange={(index) => setValue(row.key, index)} />;
    case "bind":
      return <Bind value={String(values()[row.key] ?? "")} onChange={(key) => setValue(row.key, key)} />;
    case "app":
      return <AppControl which={row.key} />;
    default:
      return null;
  }
}

/** The crosshair as the settings draw it, over a slice of a range wall. */
function CrosshairPreview() {
  const value = (key: string) => values()[key];
  const color = () => CROSSHAIR_COLORS[Number(value("xColor"))] ?? "#ffffff";
  const outline = () => (value("xOutlines") === true ? `0 0 0 ${Number(value("xOutlineThickness"))}px rgb(0 0 0 / ${Number(value("xOutlineOpacity"))})` : "none");
  const line = (length: number, thickness: number, offset: number, opacity: number, side: "t" | "b" | "l" | "r") => {
    const isVertical = side === "t" || side === "b";
    const along = side === "t" || side === "l" ? -(offset + length) : offset;
    return {
      width: `${isVertical ? thickness : length}px`,
      height: `${isVertical ? length : thickness}px`,
      transform: isVertical ? `translate(${-thickness / 2}px, ${along}px)` : `translate(${along}px, ${-thickness / 2}px)`,
      background: color(),
      opacity: String(opacity),
      "box-shadow": outline(),
    };
  };
  const SIDES = ["t", "b", "l", "r"] as const;
  return (
    <div class={styles.preview}>
      <div class={styles.previewCross} style={{ transform: "scale(2)" }}>
        <Show when={value("xDot") === true}>
          <i
            style={{
              width: `${Number(value("xDotThickness"))}px`,
              height: `${Number(value("xDotThickness"))}px`,
              transform: `translate(-50%, -50%)`,
              background: color(),
              opacity: String(value("xDotOpacity")),
              "box-shadow": outline(),
            }}
          />
        </Show>
        <Show when={value("xInner") === true}>
          <For each={SIDES}>
            {(side) => <i style={line(Number(value("xInnerLength")), Number(value("xInnerThickness")), Number(value("xInnerOffset")), Number(value("xInnerOpacity")), side)} />}
          </For>
        </Show>
        <Show when={value("xOuter") === true}>
          <For each={SIDES}>{(side) => <i style={line(Number(value("xOuterLength")), 2, Number(value("xOuterOffset")), 0.35, side)} />}</For>
        </Show>
      </div>
    </div>
  );
}
