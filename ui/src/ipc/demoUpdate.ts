// Demo answers for the update commands. Up to date by default, so previews and filming never
// show an update notice; `?update=1` in the URL offers a made-up release to preview the flow.
import type { ReleaseView } from "~/bindings/ReleaseView";
import type { UpdateStage } from "~/bindings/UpdateStage";
import type { UpdateView } from "~/bindings/UpdateView";
import { dispatchAppEvent } from "./events";

const DEMO_VERSION = "0.1.0";
/** One simulated download step: 10% every so often. */
const DOWNLOAD_STEP_MS = 180;
const DOWNLOAD_STEP_PERCENT = 10;
const FULL_PERCENT = 100;

const DEMO_RELEASE: ReleaseView = {
  version: "0.2.0",
  notes: [
    "Battle pass, missions and your stats on Career.",
    "Chat with your party from Home.",
    "Saved loadouts, wishlist and identity editing in Collection.",
  ].join("\n"),
  page_url: "https://github.com/Soulhackzlol/ValoShell/releases",
  published_at: "2026-10-24T10:00:00Z",
};

const isOffered = (): boolean => new URLSearchParams(location.search).get("update") === "1";

let view: UpdateView = {
  current_version: DEMO_VERSION,
  latest: null,
  stage: { stage: "idle" },
  can_install: false,
};

function publish(stage: UpdateStage): UpdateView {
  view = { ...view, stage };
  dispatchAppEvent({ type: "update", data: view });
  return view;
}

export function demoUpdate(): UpdateView {
  if (view.stage.stage === "idle") demoCheckForUpdate();
  return view;
}

export function demoCheckForUpdate(): UpdateView {
  const latest = isOffered() ? DEMO_RELEASE : null;
  view = { ...view, latest, can_install: latest !== null };
  return publish(latest ? { stage: "available" } : { stage: "up_to_date" });
}

/** Plays the download out, then stops at "restarting" (a browser cannot restart into an exe). */
export function demoInstallUpdate(): null {
  if (!view.latest) throw new Error("Could not install the update: there is none.");
  let percent = 0;
  const step = () => {
    percent += DOWNLOAD_STEP_PERCENT;
    if (percent < FULL_PERCENT) {
      publish({ stage: "downloading", percent });
      window.setTimeout(step, DOWNLOAD_STEP_MS);
    } else {
      publish({ stage: "restarting" });
    }
  };
  publish({ stage: "downloading", percent });
  window.setTimeout(step, DOWNLOAD_STEP_MS);
  return null;
}
