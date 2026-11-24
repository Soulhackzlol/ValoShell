// The three states a piece can be in before its data arrives, kept free of DOM code so it can
// be tested on its own.
import type { Loadable } from "~/state/views";

export type ViewState = "loading" | "error" | "idle";

/** The parts of a loadable a status needs; any `Loadable<T>` fits. */
export type StatusSource = Pick<Loadable<unknown>, "error" | "isLoading" | "load">;

/** Which state a loadable without a value is in: loading wins over an old error. */
export function viewStateOf(view: Pick<StatusSource, "error" | "isLoading">): ViewState {
  if (view.isLoading()) return "loading";
  return view.error() ? "error" : "idle";
}
