// ValoShell's own settings inside the VALORANT style's settings screen, drawn with the client's
// controls. One entry per setting key, so a new app setting is one more line here.
import { Show, type JSX } from "solid-js";
import type { ColorVision } from "~/bindings/ColorVision";
import type { EffectsQuality } from "~/bindings/EffectsQuality";
import type { MotionPreference } from "~/bindings/MotionPreference";
import type { Settings } from "~/bindings/Settings";
import { settings, updateSettings } from "~/state/settings";
import { UI_SCALE } from "~/state/uiScale";
import { commitScale, previewScale, shownScale } from "./scaleControl";
import type { AppSettingKey } from "./valSettingsData";
import { Dropdown, OnOff, Slider } from "./valControls";

const MOTIONS: readonly MotionPreference[] = ["system", "full", "reduced"];
const EFFECTS: readonly EffectsQuality[] = ["auto", "full", "lite"];
const VISIONS: readonly ColorVision[] = ["default", "red_green", "blue_yellow"];
/** The client shows these as whole percentages. */
const PERCENT = 100;

type Control = (now: () => Settings) => JSX.Element;

const APP_CONTROLS: Record<AppSettingKey, Control> = {
  uiVolume: (now) => (
    <Slider
      value={Math.round(now().interface.ui_volume * PERCENT)}
      min={0}
      max={PERCENT}
      step={1}
      onChange={(value) => updateSettings((draft) => void (draft.interface.ui_volume = value / PERCENT))}
    />
  ),
  uiScale: () => (
    <Slider
      value={Math.round(shownScale() * PERCENT)}
      min={UI_SCALE.min * PERCENT}
      max={UI_SCALE.max * PERCENT}
      step={UI_SCALE.step * PERCENT}
      onChange={(value) => previewScale(value / PERCENT)}
      onCommit={(value) => commitScale(value / PERCENT)}
    />
  ),
  streamer: (now) => (
    <OnOff value={now().streamer.is_enabled} onChange={(isOn) => updateSettings((draft) => void (draft.streamer.is_enabled = isOn))} />
  ),
  contrast: (now) => (
    <OnOff
      value={now().interface.is_high_contrast}
      onChange={(isOn) => updateSettings((draft) => void (draft.interface.is_high_contrast = isOn))}
    />
  ),
  updates: (now) => (
    <OnOff
      value={now().updates.should_check_for_updates}
      onChange={(isOn) => updateSettings((draft) => void (draft.updates.should_check_for_updates = isOn))}
    />
  ),
  motion: (now) => (
    <Dropdown
      value={MOTIONS.indexOf(now().interface.motion)}
      options={[
        ["System", "Sistema"],
        ["Full", "Completas"],
        ["Reduced", "Reducidas"],
      ]}
      onChange={(index) => updateSettings((draft) => void (draft.interface.motion = MOTIONS[index] ?? "system"))}
    />
  ),
  effects: (now) => (
    <Dropdown
      value={EFFECTS.indexOf(now().interface.effects)}
      options={[
        ["Auto", "Automático"],
        ["Full", "Completos"],
        ["Lite", "Ligeros"],
      ]}
      onChange={(index) => updateSettings((draft) => void (draft.interface.effects = EFFECTS[index] ?? "auto"))}
    />
  ),
  colorVision: (now) => (
    <Dropdown
      value={VISIONS.indexOf(now().interface.color_vision)}
      options={[
        ["Default", "Predeterminado"],
        ["Red-green", "Rojo-verde"],
        ["Blue-yellow", "Azul-amarillo"],
      ]}
      onChange={(index) => updateSettings((draft) => void (draft.interface.color_vision = VISIONS[index] ?? "default"))}
    />
  ),
};

/** The control for one ValoShell setting; it follows the settings live. */
export function AppControl(props: { which: AppSettingKey }) {
  return <Show when={settings()}>{(now) => APP_CONTROLS[props.which](now)}</Show>;
}
