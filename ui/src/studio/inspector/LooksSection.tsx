// The Theme tab's Looks section: save the current setup by name, apply or delete saved ones,
// open the gallery, and copy the look to share.
import { For, Show, createSignal, onMount } from "solid-js";
import { Copy, LayoutGrid } from "lucide-solid";
import { playCue } from "~/menu/sound";
import { controls } from "~/ui/controls";
import { DeleteLookButton } from "../gallery/DeleteLookButton";
import { LookGallery, openGallery } from "../gallery/LookGallery";
import { applyLook, copyLook, lookNames, refreshLooks, saveLook } from "../looks";
import styles from "../studio.module.css";

const BUTTON_ICON_PX = 13;

/** The saved looks by name: click to apply, two clicks to delete. */
function SavedLookList() {
  return (
    <Show when={lookNames().length > 0}>
      <ul class={styles.lookList}>
        <For each={lookNames()}>
          {(look) => (
            <li class={styles.look}>
              <button
                class={styles.lookApply}
                title="Apply (Ctrl+Z undoes it)"
                onClick={() => {
                  playCue("confirm");
                  void applyLook(look);
                }}
              >
                {look}
              </button>
              <DeleteLookButton name={look} class={styles.layerToggle} />
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

export function LooksSection() {
  const [name, setName] = createSignal("");
  onMount(() => void refreshLooks());
  const save = (event: SubmitEvent) => {
    event.preventDefault();
    void saveLook(name()).then((isSaved) => isSaved && setName(""));
  };
  return (
    <section class={styles.looks}>
      <span class="overline">Looks</span>
      <form class={styles.lookForm} onSubmit={save}>
        <input class={controls.input} placeholder="Save this setup as…" value={name()} onInput={(event) => setName(event.currentTarget.value)} />
        <button class={`${controls.button} ${controls.small}`} type="submit" disabled={!name().trim()}>
          Save
        </button>
      </form>
      <SavedLookList />
      <button class={`${controls.button} ${controls.small}`} onClick={openGallery}>
        <LayoutGrid size={BUTTON_ICON_PX} /> Browse looks
      </button>
      <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={() => void copyLook()}>
        <Copy size={BUTTON_ICON_PX} /> Copy this look to share
      </button>
      <p class={styles.hint}>Paste a copied look (Ctrl+V) or drop a look file anywhere while editing to apply it.</p>
      <LookGallery />
    </section>
  );
}
