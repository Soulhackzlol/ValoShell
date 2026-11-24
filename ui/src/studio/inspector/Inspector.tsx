// The floating inspector: edit the selected piece, add pieces, restyle the theme, manage
// layers. The panel itself can be thrown around: it springs to the nearest side. Each tab is
// its own file in this folder.
import { For, Match, Show, Switch as Branch, createMemo, createSignal, onCleanup } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Layers, Palette, Plus, SlidersHorizontal } from "lucide-solid";
import { playCue } from "~/menu/sound";
import { controls } from "~/ui/controls";
import { currentStage } from "../actions";
import { GENTLE, type SpringHandle, VelocityTracker, project, runSpring } from "../spring";
import { selectedId, stagePieces } from "../store";
import styles from "../studio.module.css";
import { AddTab } from "./AddTab";
import { LayersTab } from "./LayersTab";
import { PieceTab } from "./PieceTab";
import { ThemeTab } from "./ThemeTab";

type Tab = "piece" | "add" | "theme" | "layers";

const PANEL_WIDTH = 330;
const PANEL_MARGIN = 16;
const PANEL_TOP = 88;
/** Highest and lowest the panel may land after a throw (it keeps its tabs reachable). */
const PANEL_MIN_Y = 80;
const PANEL_BOTTOM_ROOM = 240;
/** How far a throw carries: the spring's deceleration rate per millisecond. */
const THROW_DECELERATION = 0.995;
const TAB_ICON_PX = 14;

const TABS: readonly { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: "piece", label: "Piece", icon: SlidersHorizontal },
  { id: "add", label: "Add", icon: Plus },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "layers", label: "Layers", icon: Layers },
];

/** The panel's position and the drag that throws it to whichever side the throw points at. */
function usePanelThrow() {
  const [position, setPosition] = createSignal({ x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN, y: PANEL_TOP });
  let spring: SpringHandle | undefined;
  onCleanup(() => spring?.stop());
  const land = (tracker: VelocityTracker) => {
    const velocity = tracker.velocity();
    const from = position();
    const isRight = from.x + project(velocity.x, THROW_DECELERATION) + PANEL_WIDTH / 2 > window.innerWidth / 2;
    const x = isRight ? window.innerWidth - PANEL_WIDTH - PANEL_MARGIN : PANEL_MARGIN;
    const thrownY = from.y + project(velocity.y, THROW_DECELERATION);
    const y = Math.min(Math.max(thrownY, PANEL_MIN_Y), window.innerHeight - PANEL_BOTTOM_ROOM);
    spring = runSpring([from.x, from.y], [x, y], [velocity.x, velocity.y], GENTLE, ([nx = x, ny = y]) => setPosition({ x: nx, y: ny }));
  };
  const startDrag = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    spring?.stop();
    const origin = { x: event.clientX - position().x, y: event.clientY - position().y };
    const tracker = new VelocityTracker();
    const onMove = (move: PointerEvent) => {
      tracker.add(move.clientX, move.clientY);
      setPosition({ x: move.clientX - origin.x, y: move.clientY - origin.y });
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      land(tracker);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };
  return { position, startDrag };
}

function TabBar(props: { tab: Tab; onPick: (tab: Tab) => void }) {
  return (
    <nav class={styles.tabs}>
      <For each={TABS}>
        {(entry) => (
          <button
            class={styles.tab}
            data-active={props.tab === entry.id ? "" : undefined}
            onClick={() => {
              playCue("tab");
              props.onPick(entry.id);
            }}
          >
            <Dynamic component={entry.icon} size={TAB_ICON_PX} />
            {entry.label}
          </button>
        )}
      </For>
    </nav>
  );
}

function SelectedPiece() {
  const selected = createMemo(() => stagePieces(currentStage()).find((piece) => piece.id === selectedId()));
  return (
    <Show
      when={selected()}
      fallback={
        <p class={styles.hint}>
          Click a piece on the stage to edit it, or open <b>Add</b>. Paste any TikTok, YouTube or image link to drop it
          straight in.
        </p>
      }
    >
      {(piece) => <PieceTab piece={piece()} />}
    </Show>
  );
}

export function Inspector() {
  const [tab, setTab] = createSignal<Tab>("piece");
  const panel = usePanelThrow();
  return (
    <aside
      class={`${styles.inspector} ${controls.glass}`}
      data-part="studio-panel"
      style={{ transform: `translate3d(${panel.position().x}px, ${panel.position().y}px, 0)`, width: `${PANEL_WIDTH}px` }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <header class={styles.inspectorHead} onPointerDown={panel.startDrag}>
        <span class={styles.grip} />
        <TabBar tab={tab()} onPick={setTab} />
      </header>
      <div class={styles.inspectorBody}>
        <Branch>
          <Match when={tab() === "piece"}>
            <SelectedPiece />
          </Match>
          <Match when={tab() === "add"}>
            <AddTab />
          </Match>
          <Match when={tab() === "theme"}>
            <ThemeTab />
          </Match>
          <Match when={tab() === "layers"}>
            <LayersTab />
          </Match>
        </Branch>
      </div>
    </aside>
  );
}
