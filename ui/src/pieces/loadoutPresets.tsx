// Loadout presets dialog: save the whole loadout under a name, equip a saved one in one click,
// or delete it. Opened with `openLoadoutPresets` from any style; mounted once in MenuShell.
import { For, Show, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { Check, Trash2, X } from "lucide-solid";
import { playCue } from "~/menu/sound";
import { applyPreset, deletePreset, isPresetBusy, presetNames, refreshPresets, savePreset } from "~/state/presets";
import controls from "~/ui/controls.module.css";
import { useConfirmPress } from "~/ui/confirmPress";
import { focusWhenShown, useModalKeys } from "~/ui/modal";
import dialog from "./identity.module.css";
import styles from "./loadoutPresets.module.css";

/** The backend's limit on document names (store/documents.rs). */
const MAX_NAME_CHARS = 64;

const [isOpen, setOpen] = createSignal(false);

export function openLoadoutPresets(): void {
  playCue("confirm");
  void refreshPresets();
  setOpen(true);
}

function close(): void {
  playCue("back");
  setOpen(false);
}

export function LoadoutPresets() {
  const [name, setName] = createSignal("");
  const save = async (event: SubmitEvent) => {
    event.preventDefault();
    if (await savePreset(name())) setName("");
  };
  useModalKeys(isOpen, close);
  return (
    <Show when={isOpen()}>
      <Portal>
        <div class={dialog.scrim} onClick={close} />
        <div
          class={`${dialog.picker} ${styles.dialog}`}
          role="dialog"
          aria-modal="true"
          aria-label="Loadouts"
          data-busy={isPresetBusy() ? "" : undefined}
        >
          <header class={dialog.head}>
            <h2>Loadouts</h2>
            <span />
            <button class={dialog.close} aria-label="Close" onClick={close}>
              <X size={16} />
            </button>
          </header>
          <div class={styles.body}>
            <form class={styles.save} onSubmit={(event) => void save(event)}>
              <input
                class={controls.input}
                placeholder="Name this loadout (skins, buddies, card, title, sprays)"
                maxLength={MAX_NAME_CHARS}
                value={name()}
                ref={focusWhenShown}
                onInput={(event) => setName(event.currentTarget.value)}
              />
              <button class={controls.button} type="submit" disabled={!name().trim() || isPresetBusy()}>
                Save current
              </button>
            </form>
            <ul class={styles.list}>
              <For each={presetNames()} fallback={<li class={styles.none}>No saved loadouts yet. Save the one you wear to switch back to it later.</li>}>
                {(preset) => <PresetRow preset={preset} />}
              </For>
            </ul>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

/** A saved loadout: Equip at once; Delete asks for a second press, since it can't be undone. */
function PresetRow(props: { preset: string }) {
  const remove = useConfirmPress(() => void deletePreset(props.preset));
  return (
    <li class={styles.row}>
      <span class={styles.name}>{props.preset}</span>
      <button class={controls.button} disabled={isPresetBusy()} onClick={() => void applyPreset(props.preset)}>
        <Check size={14} /> Equip
      </button>
      <button
        class={styles.delete}
        aria-label={remove.isArmed() ? `Press again to delete ${props.preset}` : `Delete ${props.preset}`}
        title={remove.isArmed() ? "Press again to delete" : "Delete"}
        data-armed={remove.isArmed() ? "" : undefined}
        disabled={isPresetBusy()}
        onClick={() => remove.press()}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
