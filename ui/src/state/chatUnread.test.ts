import { describe, expect, it } from "vitest";
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import { countUnread, newestAt } from "./chatUnread";

function message(sentAt: number, overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return { id: `m${sentAt}`, author: "", author_agent: null, is_self: false, is_system: false, body: "hi", sent_at_ms: sentAt, ...overrides };
}

describe("newestAt", () => {
  it("finds the latest message time", () => {
    expect(newestAt([message(30), message(10), message(20)])).toBe(30);
  });

  it("reads an empty chat as 0", () => {
    expect(newestAt([])).toBe(0);
  });
});

describe("countUnread", () => {
  it("counts only messages after what was seen", () => {
    expect(countUnread([message(10), message(20), message(30)], 15)).toBe(2);
  });

  it("never counts the player's own or system lines", () => {
    const messages = [message(10, { is_self: true }), message(20, { is_system: true }), message(30)];
    expect(countUnread(messages, 0)).toBe(1);
  });

  it("reads nothing as unread once the baseline is the newest message", () => {
    const history = [message(10), message(20)];
    expect(countUnread(history, newestAt(history))).toBe(0);
  });
});
