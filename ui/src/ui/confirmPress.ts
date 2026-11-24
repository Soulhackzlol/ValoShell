// A button that acts only on a second press: the first arms it (its label asks "sure?") and it
// disarms on its own after a few seconds. For actions that cost something and can't be undone,
// like dodging a match (RR loss and a queue ban), where a dialog would be slower than the timer.
import { createSignal, onCleanup } from "solid-js";

/** Long enough to read the armed label and press again, short enough to forget a stray click. */
const ARMED_MS = 3000;

export interface ConfirmPress {
  isArmed: () => boolean;
  press: () => void;
}

export function useConfirmPress(action: () => void, armedMs = ARMED_MS): ConfirmPress {
  const [isArmed, setArmed] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const disarm = () => {
    clearTimeout(timer);
    setArmed(false);
  };
  onCleanup(() => clearTimeout(timer));
  return {
    isArmed,
    press: () => {
      if (isArmed()) {
        disarm();
        action();
        return;
      }
      setArmed(true);
      timer = setTimeout(disarm, armedMs);
    },
  };
}
