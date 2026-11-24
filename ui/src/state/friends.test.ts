import { describe, expect, it, vi } from "vitest";
import type { FriendView } from "~/bindings/FriendView";

vi.mock("~/ipc/commands", () => ({ call: () => Promise.resolve([]) }));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));
vi.mock("~/ui/Art", () => ({ preloadArt: () => undefined }));

const { friendActivity } = await import("./friends");

const friend = (overrides: Partial<FriendView>): FriendView => ({
  puuid: "p",
  game_name: "Ghost",
  tag_line: "0001",
  status: "menus",
  detail: "",
  party_size: 1,
  note: "",
  last_online_ms: null,
  card_small: null,
  account_level: null,
  queue: "",
  product: "valorant",
  ...overrides,
});

describe("friendActivity", () => {
  it("adds the party to what the friend is doing", () => {
    expect(friendActivity(friend({ status: "in_match", detail: "Lotus 9-6", party_size: 3 }))).toBe("Lotus 9-6 · Trio");
  });

  it("leaves a solo friend's line alone", () => {
    expect(friendActivity(friend({ status: "menus" }))).toBe("Available");
  });
});
