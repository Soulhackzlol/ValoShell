import { describe, expect, it } from "vitest";
import type { UpdateStage } from "~/bindings/UpdateStage";
import type { UpdateView } from "~/bindings/UpdateView";
import { isUpdateNoticeShown, updateStatusText } from "./updateRules";

function view(stage: UpdateStage, latestVersion: string | null = "0.2.0"): UpdateView {
  const latest = latestVersion === null ? null : { version: latestVersion, notes: "", page_url: "", published_at: "" };
  return { current_version: "0.1.0", latest, stage, can_install: true };
}

describe("isUpdateNoticeShown", () => {
  it("shows a newer release until it is dismissed", () => {
    expect(isUpdateNoticeShown(view({ stage: "available" }), null)).toBe(true);
    expect(isUpdateNoticeShown(view({ stage: "available" }), "0.2.0")).toBe(false);
  });

  it("comes back for the next release", () => {
    expect(isUpdateNoticeShown(view({ stage: "available" }, "0.3.0"), "0.2.0")).toBe(true);
  });

  it("keeps showing an install under way even when dismissed", () => {
    expect(isUpdateNoticeShown(view({ stage: "downloading", percent: 40 }), "0.2.0")).toBe(true);
  });

  it("stays quiet with nothing to offer", () => {
    expect(isUpdateNoticeShown(view({ stage: "failed", message: "offline" }, null), null)).toBe(false);
    expect(isUpdateNoticeShown(null, null)).toBe(false);
  });
});

describe("updateStatusText", () => {
  it("names the new version and the download progress", () => {
    expect(updateStatusText(view({ stage: "available" }))).toBe("Version 0.2.0 is out");
    expect(updateStatusText(view({ stage: "downloading", percent: 30 }))).toBe("Downloading… 30%");
  });

  it("passes failures through as written", () => {
    expect(updateStatusText(view({ stage: "failed", message: "GitHub did not answer" }))).toBe("GitHub did not answer");
  });
});
