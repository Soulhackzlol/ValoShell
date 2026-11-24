// The welcome tour's steps. Every choice applies at once and is the same setting the Esc menu
// shows (the sections are shared), so nothing here needs saving or undoing separately.
import { type Component, For } from "solid-js";
import { EyeOff, Hand, ShieldCheck, ShoppingCart } from "lucide-solid";
import { SKINS } from "~/studio/skins";
import { switchSkin } from "~/studio/shortcuts";
import { doc } from "~/studio/store";
import { AccessibilitySection, MotionField, type SectionProps, StreamerSwitch } from "../escSections";
import styles from "./welcomeTour.module.css";

export interface TourStep {
  id: string;
  title: string;
  lead: string;
  /** A component, so a settings change re-renders its controls in place (focus stays). */
  body: Component<SectionProps>;
}

/** What ValoShell never does; the product's promises, said up front. */
const PROMISES = [
  { icon: ShieldCheck, text: "Reads what the Riot Client shows you; anything more is your choice" },
  { icon: Hand, text: "Never touches the game: no memory reading, no automated input" },
  { icon: EyeOff, text: "Names the game hides stay hidden, and other players' details are opt-in" },
  { icon: ShoppingCart, text: "Never buys anything for you" },
] as const;

const SHORTCUTS = [
  { keys: ["Esc"], text: "Settings" },
  { keys: ["Ctrl", "K"], text: "Go anywhere, invite or message a friend" },
  { keys: ["Q", "E"], text: "Previous / next screen" },
  { keys: ["F8"], text: "Next style (Shift+F8 goes back)" },
  { keys: ["Ctrl", "E"], text: "Studio: move, resize and restyle any piece" },
  { keys: ["Ctrl", "Alt", "V"], text: "Show or hide ValoShell" },
] as const;

function Promises() {
  return (
    <ul class={styles.promises}>
      <For each={PROMISES}>
        {(promise) => (
          <li>
            <promise.icon size={18} aria-hidden="true" />
            <span>{promise.text}</span>
          </li>
        )}
      </For>
    </ul>
  );
}

/** Each style as a small swatch of its own colours; picking one restyles the menu behind. */
function StylePicker() {
  return (
    <div class={styles.styles} role="group" aria-label="Style">
      <For each={SKINS}>
        {(skin) => (
          <button
            class={styles.style}
            data-part="tour-style"
            aria-pressed={doc.theme.skin === skin.id}
            style={{ "--swatch-ground": skin.ground, "--swatch-accent": skin.accent, "--swatch-text": skin.text }}
            onClick={() => switchSkin(skin.id)}
          >
            <span class={styles.swatch} aria-hidden="true">
              <i />
            </span>
            <b>{skin.label}</b>
            <small>{skin.caption}</small>
          </button>
        )}
      </For>
    </div>
  );
}

function Shortcuts() {
  return (
    <dl class={styles.shortcuts}>
      <For each={SHORTCUTS}>
        {(shortcut) => (
          <div>
            <dt>
              <For each={shortcut.keys}>{(key) => <kbd>{key}</kbd>}</For>
            </dt>
            <dd>{shortcut.text}</dd>
          </div>
        )}
      </For>
    </dl>
  );
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to ValoShell",
    lead: "VALORANT's menus, your way: party, store, collection and career in the style you pick, laid out how you like.",
    body: () => <Promises />,
  },
  {
    id: "style",
    title: "Pick a style",
    lead: "The menu behind changes as you choose. Every style can be reshaped later in Studio.",
    body: () => <StylePicker />,
  },
  {
    id: "comfort",
    title: "Make it comfortable",
    lead: "Size, contrast, colours and motion follow you into every style.",
    body: (props) => (
      <>
        <AccessibilitySection now={props.now} />
        <MotionField now={props.now} />
      </>
    ),
  },
  {
    id: "privacy",
    title: "Privacy",
    lead: "Off by default; turn on what you want.",
    body: (props) => (
      <>
        <StreamerSwitch now={props.now} />
      </>
    ),
  },
  {
    id: "keys",
    title: "Handy keys",
    lead: "Everything is also a click away; these are faster.",
    body: () => <Shortcuts />,
  },
];
