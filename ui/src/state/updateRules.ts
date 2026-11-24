// When the update notice shows, kept free of IPC so it can be tested on its own.
import type { UpdateView } from "~/bindings/UpdateView";

/**
 * Shown while there is a newer release the player has not dismissed, and always once an
 * install is under way (progress, or why it failed). A background check that failed with
 * nothing to offer stays quiet; the settings show it.
 */
export function isUpdateNoticeShown(view: UpdateView | null, dismissedVersion: string | null): boolean {
  if (!view?.latest) return false;
  const stage = view.stage.stage;
  if (stage === "downloading" || stage === "restarting") return true;
  return view.latest.version !== dismissedVersion;
}

/** One line for the settings: where the update stands. */
export function updateStatusText(view: UpdateView | null): string {
  if (!view) return "Not checked yet";
  const stage = view.stage;
  switch (stage.stage) {
    case "idle":
      return "Not checked yet";
    case "checking":
      return "Checking…";
    case "up_to_date":
      return "Up to date";
    case "available":
      return `Version ${view.latest?.version ?? ""} is out`;
    case "downloading":
      return `Downloading… ${stage.percent}%`;
    case "restarting":
      return "Restarting…";
    case "failed":
      return stage.message;
  }
}
