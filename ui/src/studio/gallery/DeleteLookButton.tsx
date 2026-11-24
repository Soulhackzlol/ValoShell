// Deleting a saved look removes its file, so it takes two clicks: the first arms the button
// (it says "Delete?" and is announced), the second within a few seconds deletes. Shared by the
// gallery cards and Studio's Looks list so both ask the same way.
import { Show, createSignal, onCleanup } from "solid-js";
import { Trash2 } from "lucide-solid";
import { deleteLook } from "../looks";

/** How long the button stays armed waiting for the confirming click. */
const ARM_MS = 3000;
const ICON_PX = 14;

export function DeleteLookButton(props: { name: string; class?: string | undefined }) {
  const [isArmed, setArmed] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const disarm = () => {
    clearTimeout(timer);
    setArmed(false);
  };
  onCleanup(() => clearTimeout(timer));
  const press = () => {
    if (!isArmed()) {
      setArmed(true);
      timer = setTimeout(disarm, ARM_MS);
      return;
    }
    // Disarm first, so a fast double-click on "Delete?" deletes once.
    disarm();
    void deleteLook(props.name);
  };
  return (
    <button
      class={props.class}
      data-armed={isArmed() ? "" : undefined}
      title={isArmed() ? "Click again to delete the file" : "Delete"}
      aria-label={isArmed() ? `Confirm deleting ${props.name}` : `Delete ${props.name}`}
      onClick={press}
    >
      <Trash2 size={ICON_PX} />
      <span aria-live="polite">
        <Show when={isArmed()}>Delete?</Show>
      </span>
    </button>
  );
}
