// The Add tab. The menu's jobs come first, once each (Party, Play button, Agents...): adding one
// places the current style's look of it, and the Piece tab switches looks afterwards. Then the
// style's own extras, the menu's other pieces and the free widgets; other styles' extras fold
// away underneath.
import { For, Show, createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
import { playCue } from "~/menu/sound";
import { addPieceOfKind, currentStage } from "../actions";
import { PIECES, type PieceDef, allowedOn, isKindAllowedOn, pieceDef } from "../registry";
import { JOBS, type Job, jobOf, kindForJob, lookLabel } from "../registry/jobs";
import { SKINS, pieceFamily, skinLabel } from "../skins";
import { doc, stagePieces } from "../store";
import type { Skin } from "../types";
import styles from "../studio.module.css";

const PIECE_ICON_PX = 20;

interface PaletteEntry {
  key: string;
  label: string;
  /** Which look it places, shown under a job's name. */
  note?: string;
  description: string;
  icon: PieceDef["icon"];
  kind: string;
  isPresent: boolean;
}

interface PaletteGroupData {
  title: string;
  entries: PaletteEntry[];
}

/** The menu's own pieces appear once per screen; widgets can repeat. */
function isOnStage(matches: (kind: string) => boolean): boolean {
  return stagePieces(currentStage()).some((piece) => matches(piece.kind) && pieceDef(piece.kind)?.category === "core");
}

function jobEntry(job: Job, kind: string): PaletteEntry {
  return {
    key: job.id,
    label: job.label,
    note: lookLabel(kind),
    description: pieceDef(kind)?.description ?? "",
    icon: job.icon,
    kind,
    isPresent: isOnStage((placed) => jobOf(placed) === job),
  };
}

function pieceEntry(def: PieceDef): PaletteEntry {
  const isPresent = def.category === "core" && isOnStage((placed) => placed === def.kind);
  return { key: def.kind, label: def.label, description: def.description, icon: def.icon, kind: def.kind, isPresent };
}

function PaletteGroup(props: { section: PaletteGroupData }) {
  return (
    <section class={styles.section}>
      <span class="overline">{props.section.title}</span>
      <div class={styles.palette}>
        <For each={props.section.entries}>
          {(entry, index) => (
            <button
              class={styles.paletteItem}
              style={{ "--stagger": index() }}
              disabled={entry.isPresent}
              title={entry.isPresent ? "Already on this screen: pick it and change its look in the Piece tab" : entry.description}
              onMouseEnter={() => playCue("hover")}
              onClick={() => addPieceOfKind(currentStage(), entry.kind)}
            >
              <Dynamic component={entry.icon} size={PIECE_ICON_PX} />
              <span class={styles.paletteLabel}>{entry.label}</span>
              <Show when={entry.note}>{(note) => <span class={styles.paletteNote}>{note()}</span>}</Show>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}

export function AddTab() {
  /** Pieces this screen allows that are no job's look: extras and widgets. */
  const loose = () => PIECES.filter((def) => allowedOn(def, currentStage()) && !jobOf(def.kind));
  const extrasOf = (skin: Skin) => loose().filter((def) => pieceFamily(def.kind) === skin);
  const main = createMemo<PaletteGroupData[]>(() => {
    const skin = doc.theme.skin;
    const jobs = JOBS.flatMap((job) => {
      const kind = kindForJob(job, skin, (option) => isKindAllowedOn(option, currentStage()));
      return kind ? [jobEntry(job, kind)] : [];
    });
    const menu = loose().filter((def) => pieceFamily(def.kind) === null);
    return [
      { title: "On this screen", entries: jobs },
      { title: `${skinLabel(skin)} extras`, entries: extrasOf(skin).map(pieceEntry) },
      { title: "More menu pieces", entries: menu.filter((def) => def.category === "core").map(pieceEntry) },
      { title: "Widgets", entries: menu.filter((def) => def.category === "widget").map(pieceEntry) },
    ].filter((section) => section.entries.length > 0);
  });
  const others = createMemo<PaletteGroupData[]>(() =>
    SKINS.filter((skin) => skin.id !== doc.theme.skin)
      .map((skin) => ({ title: skin.label, entries: extrasOf(skin.id).map(pieceEntry) }))
      .filter((section) => section.entries.length > 0),
  );
  return (
    <div class={styles.stack}>
      <For each={main()}>{(section) => <PaletteGroup section={section} />}</For>
      <Show when={others().length > 0}>
        <details class={styles.fold}>
          <summary class="overline">Extras from other styles</summary>
          <div class={styles.stack}>
            <For each={others()}>{(section) => <PaletteGroup section={section} />}</For>
          </div>
        </details>
      </Show>
      <p class={styles.hint}>Tip: paste a link (Ctrl+V) or drop an image anywhere on the stage.</p>
    </div>
  );
}
