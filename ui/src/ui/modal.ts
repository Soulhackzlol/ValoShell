// Keyboard ownership for modal dialogs. While one is open the menu's global shortcuts (the Esc
// menu, Q/E tabs, the command palette, the Studio keys) must not act underneath it, and Esc
// must close it wherever focus is: a dialog's own onKeyDown only sees keys while focus is
// inside it, and clicking the opener leaves focus on the opener. A window capture listener runs
// before all of those bubbling listeners. Stopping propagation keeps default actions, so
// typing, Tab and Enter still work inside the dialog.
//
// Other window capture listeners still run (stopPropagation does not stop listeners on the
// same target), so the two that matter coordinate through the signals here: the Studio keys
// stand down while `isModalOpen()`, and dialogs leave keys to the style's intro while it plays
// (one Esc that skips the intro must not also skip the welcome tour).
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";

const [openModals, setOpenModals] = createSignal(0);
const [isIntroPlaying, setIntroPlaying] = createSignal(false);

/** A dialog owns the keyboard. */
export const isModalOpen = () => openModals() > 0;

export { isIntroPlaying, setIntroPlaying };

/**
 * Route keys to the open dialog: Esc calls `close`, nothing reaches the menu underneath.
 * `onKey` sees every other key first, since the dialog's own key handlers never get them.
 */
export function useModalKeys(isOpen: () => boolean, close: () => void, onKey?: (event: KeyboardEvent) => void): void {
  const route = (event: KeyboardEvent) => {
    if (!isOpen() || isIntroPlaying()) return;
    event.stopPropagation();
    if (event.key === "Escape") close();
    else onKey?.(event);
  };
  createEffect(
    on(isOpen, (isNowOpen) => {
      if (!isNowOpen) return;
      setOpenModals((count) => count + 1);
      onCleanup(() => setOpenModals((count) => count - 1));
    }),
  );
  onMount(() => window.addEventListener("keydown", route, true));
  onCleanup(() => window.removeEventListener("keydown", route, true));
}

/**
 * While `isOpen`, the app behind a portalled dialog is inert (no Tab, click or Enter reaches
 * it) and focus returns to where it was when the dialog closes. Only for dialogs rendered in a
 * Portal: the dialog itself must be outside the app root.
 */
export function useInertBackground(isOpen: () => boolean): void {
  createEffect(
    on(isOpen, (isNowOpen) => {
      if (!isNowOpen) return;
      const root = document.getElementById("root");
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root?.setAttribute("inert", "");
      onCleanup(() => {
        root?.removeAttribute("inert");
        opener?.focus();
      });
    }),
  );
}

/**
 * Ref callback that focuses the element once it is in the page. `autofocus` is ignored on
 * inserted elements while something else (the opener) already has focus.
 */
export function focusWhenShown(element: HTMLElement): void {
  queueMicrotask(() => element.focus());
}
