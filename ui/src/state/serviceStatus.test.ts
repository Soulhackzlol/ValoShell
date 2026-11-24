import { describe, expect, it, vi } from "vitest";

const notice = { id: "1", kind: "maintenance", is_urgent: true, title: "Patch 13.09", detail: "" };
let answer = [notice];
vi.mock("~/ipc/commands", () => ({ call: () => Promise.resolve(answer) }));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));

const { dismissServiceNotices, refreshServiceStatus, visibleServiceNotices } = await import("./serviceStatus");

describe("visibleServiceNotices", () => {
  it("shows what Riot reports", async () => {
    await refreshServiceStatus();
    expect(visibleServiceNotices()).toEqual([notice]);
  });

  it("hides dismissed notices but shows a later one", async () => {
    dismissServiceNotices();
    expect(visibleServiceNotices()).toEqual([]);
    const later = { ...notice, id: "2", kind: "incident" };
    answer = [notice, later];
    await refreshServiceStatus();
    expect(visibleServiceNotices()).toEqual([later]);
  });
});
