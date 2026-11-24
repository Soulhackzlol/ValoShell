import { describe, expect, it } from "vitest";
import { READY_MESSAGE, isReadyMessage, isShowMessage, showMessage } from "./previewProtocol";

describe("preview messages", () => {
  it("accepts a show message the gallery builds", () => {
    expect(isShowMessage(showMessage({ theme: {} }, "agent-select"))).toBe(true);
  });

  it("refuses a page the preview does not have, so the frame never navigates elsewhere", () => {
    expect(isShowMessage({ ...showMessage({}, "home"), page: "../settings" })).toBe(false);
  });

  it("refuses other windows' messages that only look similar", () => {
    expect(isShowMessage({ kind: "something-else", doc: {}, page: "home" })).toBe(false);
    expect(isShowMessage(null)).toBe(false);
  });

  it("tells the ready message apart", () => {
    expect(isReadyMessage(READY_MESSAGE)).toBe(true);
    expect(isReadyMessage(showMessage({}, "home"))).toBe(false);
  });
});
