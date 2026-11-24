import { describe, expect, it } from "vitest";
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import type { ChatView } from "~/bindings/ChatView";
import { GROUP_GAP_MS, canSendTo, directKey, directPuuid, directThreadList, isGroupStart, threadKeys, threadMessages } from "./chatThreads";

function message(sentAt: number, overrides: Partial<ChatMessageView> = {}): ChatMessageView {
  return { id: `m${sentAt}`, author: "Luna", author_agent: null, is_self: false, is_system: false, body: "hi", sent_at_ms: sentAt, ...overrides };
}

function view(overrides: Partial<ChatView> = {}): ChatView {
  return { party: [], team: [], direct: [], is_party_open: true, is_team_open: false, ...overrides };
}

const luna = { puuid: "p-luna", game_name: "Luna", tag_line: "EUW", messages: [message(5)] };
const mia = { puuid: "p-mia", game_name: "Mia", tag_line: "FR", messages: [message(9)] };

describe("thread keys", () => {
  it("round-trips a friend's puuid", () => {
    expect(directPuuid(directKey("p-luna"))).toBe("p-luna");
  });

  it("names no friend for the group chats", () => {
    expect(directPuuid("party")).toBeNull();
    expect(directPuuid("team")).toBeNull();
  });
});

describe("threadMessages", () => {
  it("reads a whisper thread by its friend", () => {
    expect(threadMessages(view({ direct: [luna] }), directKey("p-luna"))).toEqual(luna.messages);
  });

  it("reads a thread not started yet as empty", () => {
    expect(threadMessages(view(), directKey("p-nobody"))).toEqual([]);
    expect(threadMessages(null, "party")).toEqual([]);
  });
});

describe("canSendTo", () => {
  it("needs the group chat to exist", () => {
    expect(canSendTo(view(), "party")).toBe(true);
    expect(canSendTo(view(), "team")).toBe(false);
  });

  it("lets a whisper go out once connected, before the thread exists", () => {
    expect(canSendTo(view(), directKey("p-new"))).toBe(true);
    expect(canSendTo(null, directKey("p-new"))).toBe(false);
  });
});

describe("directThreadList", () => {
  it("puts threads just started before the existing ones, without repeats", () => {
    const list = directThreadList(view({ direct: [mia, luna] }), ["p-ivy", "p-luna"]);
    expect(list).toEqual(["p-ivy", "p-mia", "p-luna"]);
  });
});

describe("isGroupStart", () => {
  it("groups one author's lines that are close together", () => {
    const lines = [message(0), message(1000)];
    expect(isGroupStart(lines, 0)).toBe(true);
    expect(isGroupStart(lines, 1)).toBe(false);
  });

  it("starts a group on a new author, a long pause or a system line", () => {
    expect(isGroupStart([message(0), message(1, { is_self: true })], 1)).toBe(true);
    expect(isGroupStart([message(0), message(GROUP_GAP_MS + 1)], 1)).toBe(true);
    expect(isGroupStart([message(0, { is_system: true }), message(1)], 1)).toBe(true);
  });
});

describe("threadKeys", () => {
  it("lists the group chats and every whisper thread", () => {
    expect(threadKeys(view({ direct: [luna, mia] }))).toEqual(["party", "team", "dm:p-luna", "dm:p-mia"]);
  });
});
