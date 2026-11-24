import { describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const request = { puuid: "p1", game_name: "Nova", tag_line: "EUW", is_incoming: true };
vi.mock("~/ipc/commands", () => ({
  call: (command: string) => {
    calls.push(command);
    return Promise.resolve(command === "get_friend_requests" ? [request] : null);
  },
}));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));
vi.mock("./toasts", () => ({ attempt: async (action: () => Promise<unknown>) => (await action(), true), pushToast: () => undefined }));

const { friendRequestActions, friendRequests, isRiotId, refreshFriendRequests } = await import("./friendRequests");

describe("isRiotId", () => {
  it("accepts Name#TAG, splitting at the last hash", () => {
    expect(isRiotId("Na#me#EUW")).toBe(true);
  });

  it("rejects a missing name or tag", () => {
    expect(["Name", "#TAG", "Name# ", ""].map(isRiotId)).toEqual([false, false, false, false]);
  });
});

describe("refreshFriendRequests", () => {
  it("keeps the backend's pending requests", async () => {
    await refreshFriendRequests();
    expect(friendRequests()).toEqual([request]);
  });
});

describe("friendRequestActions", () => {
  it("re-reads the requests after an answer", async () => {
    calls.length = 0;
    expect(await friendRequestActions.accept("p1")).toBe(true);
    expect(calls).toEqual(["friend_request_accept", "get_friend_requests"]);
  });

  it("sends the trimmed Riot ID", async () => {
    calls.length = 0;
    expect(await friendRequestActions.add(" Nova#EUW ")).toBe(true);
    expect(calls[0]).toBe("friend_request_send");
  });
});
