// Glass Play: the modes as an Apple detail view. The picked mode fills a big rounded card on its
// own art (glyph, name, what it is, the party's size), and every mode sits beside it in an inset
// grouped list with its glyph on a tinted tile and a checkmark on the picked one. Only the party
// owner can change the mode; for everyone else the list reads the same but doesn't respond.
import { For, Show } from "solid-js";
import { Check } from "lucide-solid";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { Art } from "~/ui/Art";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./glassModes.module.css";

const FALLBACK_BLURB = "Matchmade games with your party.";

export function GlassModes(_props: PieceProps) {
  const play = usePlay();
  const blurb = (id: string) => QUEUE_BLURBS[id] ?? FALLBACK_BLURB;
  return (
    <section class={styles.modes}>
      {/* Keyed on the mode's id, not the object: the party view is rebuilt on every poll and the
          card should only cross-fade when the mode really changes. */}
      <Show when={play.current()?.id} keyed fallback={<div class={`${styles.hero} ${styles.empty}`}>Connect to VALORANT to pick a mode.</div>}>
        {(id) => (
          <article class={styles.hero}>
            <Art src={play.current()?.art} class={styles.heroArt} fallback={<span class={styles.heroArt} />} />
            <div class={styles.heroText}>
              <Art src={play.current()?.icon} class={styles.heroGlyph} fallback={null} />
              <h2>{play.current()?.label}</h2>
              <p>{blurb(id)}</p>
              <span class={styles.chip}>
                Party {play.partySize()} of {play.maxSize()}
              </span>
            </div>
          </article>
        )}
      </Show>
      <section class={styles.list}>
        <header class={styles.listHead}>
          <h3>Modes</h3>
          <Show when={!play.isOwner()}>
            <span>The party owner picks</span>
          </Show>
        </header>
        <ul class={styles.rows}>
          <For each={play.queues()}>
            {(queue) => (
              <li>
                <button
                  class={styles.row}
                  data-on={play.current()?.id === queue.id ? "" : undefined}
                  disabled={!play.isOwner()}
                  onMouseEnter={() => play.isOwner() && playCue("hover")}
                  onClick={() => play.pickQueue(queue)}
                >
                  <span class={styles.tile}>
                    <Art src={queue.icon} class={styles.glyph} fallback={<span class={styles.initial}>{queue.label.slice(0, 1)}</span>} />
                  </span>
                  <span class={styles.rowText}>
                    <b>{queue.label}</b>
                    <small>{blurb(queue.id)}</small>
                  </span>
                  <Show when={play.current()?.id === queue.id}>
                    <Check class={styles.check ?? ""} size={18} stroke-width={2.6} />
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
    </section>
  );
}
