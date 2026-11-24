// One look in the gallery: its thumbnail (a screenshot when the look has one, else a sketch
// drawn from its document) and name as one big button (click shows it in the
// live preview, double-click applies it), its colours, and any extra buttons the section adds
// (show file, delete). Shared by every gallery section.
import { For, Show, createSignal, type JSX } from "solid-js";
import { playCue } from "~/menu/sound";
import type { StudioDoc } from "../types";
import { summarizeLook } from "./lookSummary";
import { LookPreview } from "./LookPreview";
import { isPicked, pickLook } from "./selection";
import styles from "./gallery.module.css";

function Swatches(props: { colours: string[] }) {
  return (
    <span class={styles.swatches} aria-hidden="true">
      <For each={props.colours}>{(colour) => <i style={{ background: colour }} />}</For>
    </span>
  );
}

export interface LookCardProps {
  name: string;
  /** One line under the name; the look's style when not given. */
  caption?: string | undefined;
  doc: StudioDoc;
  /** Screenshot URL; the sketch is drawn instead when absent or when it fails to load. */
  thumb?: string | undefined;
  onApply: (doc: StudioDoc, name: string) => void;
  children?: JSX.Element;
}

function Thumbnail(props: { src: string | undefined; doc: StudioDoc }) {
  const [hasFailed, setFailed] = createSignal(false);
  return (
    <Show when={props.src && !hasFailed()} fallback={<LookPreview summary={summarizeLook(props.doc)} />}>
      <img class={styles.preview} src={props.src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </Show>
  );
}

export function LookCard(props: LookCardProps) {
  const summary = () => summarizeLook(props.doc);
  const caption = () => props.caption ?? summary().styleLabel;
  const pick = () => {
    playCue("tab");
    pickLook({ name: props.name, caption: caption(), doc: props.doc });
  };
  return (
    <li class={styles.card} data-part="look-card" data-picked={isPicked(props.doc) ? "" : undefined}>
      <button
        class={styles.cardApply}
        title="Show it in the preview (double-click to apply)"
        aria-pressed={isPicked(props.doc)}
        onClick={pick}
        onDblClick={() => props.onApply(props.doc, props.name)}
      >
        <Thumbnail src={props.thumb} doc={props.doc} />
        <span class={styles.cardText}>
          <b>{props.name}</b>
          <span>{caption()}</span>
        </span>
      </button>
      <div class={styles.cardFoot}>
        <Swatches colours={[summary().accent, summary().play, summary().ground, summary().text]} />
        {props.children}
      </div>
    </li>
  );
}
