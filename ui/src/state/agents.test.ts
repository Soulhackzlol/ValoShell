import { describe, expect, it, vi } from "vitest";

vi.mock("~/ipc/commands", () => ({ call: () => Promise.resolve(null) }));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));

const { rankMastery } = await import("./agents");

const row = (agent_uuid: string, lifetime_level: number, points = 0) => ({ agent_uuid, act_level: 0, lifetime_level, points });

describe("rankMastery", () => {
  it("lists the highest lifetime levels first, points breaking ties", () => {
    const rows = [row("reyna", 1, 40), row("brimstone", 12), row("cypher", 1, 300), row("sage", 0, 900)];
    expect(rankMastery(rows, 3).map((entry) => entry.agent_uuid)).toEqual(["brimstone", "cypher", "reyna"]);
  });

  it("leaves out agents never levelled", () => {
    expect(rankMastery([row("sage", 0, 900)], 3)).toEqual([]);
  });
});
