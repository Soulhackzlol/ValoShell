// The Esc menu's settings, one component per section. Each reads the settings it shows and
// saves through `updateSettings`, so sections can be moved or reused without wiring.
import { Show } from "solid-js";
import { Compass, Paintbrush, RefreshCw } from "lucide-solid";
import type { ColorVision } from "~/bindings/ColorVision";
import type { EffectsQuality } from "~/bindings/EffectsQuality";
import type { MotionPreference } from "~/bindings/MotionPreference";
import type { Settings } from "~/bindings/Settings";
import { isTauri } from "~/ipc/runtime";
import { updateSettings } from "~/state/settings";
import { UI_SCALE } from "~/state/uiScale";
import { checkForUpdate, update } from "~/state/update";
import { updateStatusText } from "~/state/updateRules";
import { Range, Segmented, Switch, controls } from "~/ui/controls";
import { commitScale, previewScale, shownScale } from "./scaleControl";
import styles from "./EscMenu.module.css";

export interface SectionProps {
  now: Settings;
}

const PERCENT = 100;
const VOLUME = { min: 0, max: 1, step: 0.05 };

const asPercent = (value: number) => `${Math.round(value * PERCENT)}%`;

export function MatchFlowSection(props: SectionProps) {
  const flow = () => props.now.match_flow;
  return (
    <section class={styles.section}>
      <h2 class={styles.heading}>Match flow</h2>
      <Switch
        title="Hide on lock-in"
        hint="Get out of the way once your agent is locked"
        isOn={flow().should_hide_on_lock}
        onChange={(isOn) => updateSettings((draft) => void (draft.match_flow.should_hide_on_lock = isOn))}
      />
      <Switch
        title="Hide when the match starts"
        isOn={flow().should_hide_on_match_start}
        onChange={(isOn) => updateSettings((draft) => void (draft.match_flow.should_hide_on_match_start = isOn))}
      />
      <Switch
        title="Come back in the menus"
        hint="Show ValoShell again after the match"
        isOn={flow().should_return_in_menus}
        onChange={(isOn) => updateSettings((draft) => void (draft.match_flow.should_return_in_menus = isOn))}
      />
      <Switch
        title="Minimise VALORANT in the menus"
        isOn={flow().should_minimize_game_in_menus}
        onChange={(isOn) => updateSettings((draft) => void (draft.match_flow.should_minimize_game_in_menus = isOn))}
      />
    </section>
  );
}

/** Interface size, high contrast and colour-vision colours; every style follows them. */
export function AccessibilitySection(props: SectionProps) {
  return (
    <section class={styles.section}>
      <h2 class={styles.heading}>Accessibility</h2>
      <Range
        label="Interface size"
        value={shownScale()}
        min={UI_SCALE.min}
        max={UI_SCALE.max}
        step={UI_SCALE.step}
        format={asPercent}
        onInput={previewScale}
        onCommit={commitScale}
      />
      <Show when={!isTauri}>
        <p class={styles.note}>In the browser preview, use the browser's zoom (Ctrl + / −).</p>
      </Show>
      <Switch
        title="High contrast"
        hint="Stronger text and borders in every style"
        isOn={props.now.interface.is_high_contrast}
        onChange={(isOn) => updateSettings((draft) => void (draft.interface.is_high_contrast = isOn))}
      />
      <div class={styles.field}>
        <span class="overline">Colour vision</span>
        <Segmented<ColorVision>
          value={props.now.interface.color_vision}
          options={[
            { value: "default", label: "Default" },
            { value: "red_green", label: "Red-green" },
            { value: "blue_yellow", label: "Blue-yellow" },
          ]}
          onChange={(value) => updateSettings((draft) => void (draft.interface.color_vision = value))}
        />
      </div>
    </section>
  );
}

/** Version, where the update stands, the check switch and "Check now". */
export function UpdatesSection(props: SectionProps) {
  const isBusy = () => ["checking", "downloading", "restarting"].includes(update()?.stage.stage ?? "");
  return (
    <section class={styles.section}>
      <h2 class={styles.heading}>ValoShell</h2>
      <p class={styles.note}>
        Version {update()?.current_version ?? "?"} · {updateStatusText(update())}
      </p>
      <Switch
        title="Check for updates"
        hint="Looks for a new release now and then; installing always waits for you"
        isOn={props.now.updates.should_check_for_updates}
        onChange={(isOn) => updateSettings((draft) => void (draft.updates.should_check_for_updates = isOn))}
      />
      <button class={`${controls.button} ${controls.ghost}`} disabled={isBusy()} onClick={() => void checkForUpdate()}>
        <RefreshCw size={15} /> Check now
      </button>
    </section>
  );
}

/** Full motion, reduced, or whatever the system asks for. */
export function MotionField(props: SectionProps) {
  return (
    <div class={styles.field}>
      <span class="overline">Motion</span>
      <Segmented<MotionPreference>
        value={props.now.interface.motion}
        options={[
          { value: "system", label: "System" },
          { value: "full", label: "Full" },
          { value: "reduced", label: "Reduced" },
        ]}
        onChange={(value) => updateSettings((draft) => void (draft.interface.motion = value))}
      />
    </div>
  );
}

/** How much blur and moving backdrop the menu draws; Auto goes Lite on a PC that can't keep up. */
export function EffectsField(props: SectionProps) {
  return (
    <div class={styles.field}>
      <span class="overline">Effects</span>
      <Segmented<EffectsQuality>
        value={props.now.interface.effects}
        options={[
          { value: "auto", label: "Auto" },
          { value: "full", label: "Full" },
          { value: "lite", label: "Lite" },
        ]}
        onChange={(value) => updateSettings((draft) => void (draft.interface.effects = value))}
      />
    </div>
  );
}

export function StreamerSwitch(props: SectionProps) {
  return (
    <Switch
      title="Streamer mode"
      hint="Blurs names, tags, codes and balances"
      isOn={props.now.streamer.is_enabled}
      onChange={(isOn) => updateSettings((draft) => void (draft.streamer.is_enabled = isOn))}
    />
  );
}

/** Sound, motion, streamer mode and the way into Studio. */
export function InterfaceSection(props: SectionProps & { onOpenStudio: () => void; onOpenTour: () => void }) {
  return (
    <section class={styles.section}>
      <h2 class={styles.heading}>Interface</h2>
      <Range
        label="UI sounds"
        value={props.now.interface.ui_volume}
        min={VOLUME.min}
        max={VOLUME.max}
        step={VOLUME.step}
        format={(value) => (value === 0 ? "Muted" : asPercent(value))}
        onInput={(value) => updateSettings((draft) => void (draft.interface.ui_volume = value))}
      />
      <MotionField now={props.now} />
      <EffectsField now={props.now} />
      <StreamerSwitch now={props.now} />
      <button class={`${controls.button} ${controls.ghost}`} onClick={() => props.onOpenStudio()}>
        <Paintbrush size={15} /> Open Studio
      </button>
      <button class={`${controls.button} ${controls.ghost}`} onClick={() => props.onOpenTour()}>
        <Compass size={15} /> Welcome tour
      </button>
      <p class={styles.note}>
        Ctrl+E edits any screen · Ctrl+Alt+V shows/hides ValoShell · Ctrl+Alt+O toggles the in-game overlay
      </p>
    </section>
  );
}
