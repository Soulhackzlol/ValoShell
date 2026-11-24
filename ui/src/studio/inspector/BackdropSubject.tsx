// Theme tab controls for map and agent backdrops: which one shows (the picked one, your last
// match's, or a new one each launch), the giant name behind it, and how the agent figure looks.
import { Show } from "solid-js";
import { Segmented, Switch } from "~/ui/controls";
import { doc, updateTheme } from "../store";
import type { BackdropPick, FigureLook } from "../types";
import styles from "../studio.module.css";

const PICKS: readonly { value: BackdropPick; label: string }[] = [
  { value: "fixed", label: "This one" },
  { value: "recent", label: "Last match" },
  { value: "shuffle", label: "Shuffle" },
];

const FIGURE_LOOKS: readonly { value: FigureLook; label: string }[] = [
  { value: "plain", label: "Plain" },
  { value: "silhouette", label: "Silhouette" },
  { value: "colours", label: "Agent colours" },
  { value: "glow", label: "Glow" },
];

/** What the pick means for this backdrop, under the switch. */
function pickHint(pick: BackdropPick, what: "map" | "agent"): string {
  if (pick === "recent") {
    return `Shows the ${what} of your last match; the one picked below stands in until you have played one.`;
  }
  if (pick === "shuffle") return `A different ${what} each time ValoShell opens.`;
  return `Always the ${what} picked below.`;
}

/** Which map or agent shows, and its name behind everything. */
export function SubjectControls(props: { what: "map" | "agent" }) {
  const backdrop = () => doc.theme.backdrop;
  return (
    <>
      <Segmented<BackdropPick>
        value={backdrop().pick}
        options={PICKS}
        onChange={(value) => updateTheme((draft) => void (draft.backdrop.pick = value))}
      />
      <p class={styles.hint}>{pickHint(backdrop().pick, props.what)}</p>
      <Switch
        title={props.what === "map" ? "Map name" : "Agent name"}
        hint="Huge and outlined, behind everything"
        isOn={backdrop().isNameOn}
        onChange={(value) => updateTheme((draft) => void (draft.backdrop.isNameOn = value))}
      />
    </>
  );
}

/** The agent figure: its look and which way it faces. */
export function FigureLookControls() {
  const backdrop = () => doc.theme.backdrop;
  return (
    <>
      <Segmented<FigureLook>
        value={backdrop().figureLook}
        options={FIGURE_LOOKS}
        onChange={(value) => updateTheme((draft) => void (draft.backdrop.figureLook = value))}
      />
      <Switch
        title="Mirror"
        hint="Face the other way, from the left side"
        isOn={backdrop().isFigureMirrored}
        onChange={(value) => updateTheme((draft) => void (draft.backdrop.isFigureMirrored = value))}
      />
      <Show when={backdrop().isAscii}>
        <p class={styles.hint}>ASCII redraws the figure as characters, so its look and mirroring do not show.</p>
      </Show>
    </>
  );
}
