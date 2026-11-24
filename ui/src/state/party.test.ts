import { createRoot } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartyView } from "~/bindings/PartyView";

// The party module runs in the browser: its busy watchdog and usePlay's clock use `window` timers.
vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval, clearInterval });

// The backend is a list of called commands; the party arrives through the captured event handler.
const backend = vi.hoisted(() => ({ calls: [] as string[], onParty: undefined as ((view: unknown) => void) | undefined }));

vi.mock("~/ipc/commands", () => ({
  call: (name: string) => {
    backend.calls.push(name);
    return Promise.resolve(null);
  },
}));
vi.mock("~/ipc/events", () => ({
  onAppEvent: (name: string, handler: (view: unknown) => void) => {
    if (name === "party") backend.onParty = handler;
  },
}));
vi.mock("~/menu/sound", () => ({ playCue: () => undefined }));
vi.mock("~/ui/Art", () => ({ preloadArt: () => undefined }));
vi.mock("./views", () => ({ careerView: { value: () => undefined, isLoading: () => false, load: () => undefined } }));
vi.mock("./penalties", () => ({ refreshPenalties: () => undefined }));
vi.mock("./toasts", () => ({
  attempt: async (action: () => Promise<unknown>) => {
    await action();
    return true;
  },
  pushToast: () => undefined,
}));

const { partyActions, withOwnRank } = await import("./party");
const { usePlay } = await import("~/pieces/styled/usePlay");

const QUEUE = { id: "competitive", label: "Competitive", art: null, icon: null };

function arrive(overrides: Partial<PartyView>): void {
  const view: PartyView = {
    party_id: "p",
    is_owner: true,
    is_open: false,
    is_queueing: false,
    is_custom_game: false,
    queue: QUEUE,
    queue_entry_time: null,
    eligible_queues: [QUEUE],
    invite_code: null,
    members: [],
    max_size: 5,
    restricted_seconds: 0,
    custom: null,
    ...overrides,
  };
  backend.onParty?.(view);
}

/** The commands one press of the themed PLAY button sends. */
async function pressPlay(): Promise<string[]> {
  createRoot((dispose) => {
    usePlay().press();
    dispose();
  });
  await Promise.resolve();
  return [...backend.calls];
}

beforeEach(() => {
  backend.calls.length = 0;
});

describe("partyActions.start", () => {
  it("searches from a matchmaking party", async () => {
    arrive({ is_custom_game: false });
    await partyActions.start();
    expect(backend.calls).toEqual(["party_start_queue"]);
  });

  it("starts the game from a custom lobby instead of asking for matchmaking", async () => {
    arrive({ is_custom_game: true, max_size: 12 });
    await partyActions.start();
    expect(backend.calls).toEqual(["party_start_custom"]);
  });
});

describe("usePlay press", () => {
  it("starts the custom game for the owner of a custom lobby", async () => {
    arrive({ is_custom_game: true, is_owner: true });
    expect(await pressPlay()).toEqual(["party_start_custom"]);
  });

  it("still toggles ready for a member who isn't the owner", async () => {
    arrive({ is_custom_game: true, is_owner: false });
    expect(await pressPlay()).toEqual(["party_set_ready"]);
  });

  it("cancels a running search before anything else", async () => {
    arrive({ is_queueing: true, queue_entry_time: new Date().toISOString() });
    expect(await pressPlay()).toEqual(["party_stop_queue"]);
  });
});

describe("withOwnRank", () => {
  const ASCENDANT = { tier: 21, name: "ASCENDANT 1", icon: null, color: null };
  const UNRANKED = { tier: 0, name: "Unranked", icon: null, color: null };
  const member = (isSelf: boolean, rank = UNRANKED) => ({ is_self: isSelf, rank }) as PartyView["members"][number];
  const view = (members: PartyView["members"]) => ({ members }) as PartyView;

  it("fills your own rank from your career outside ranked queues", () => {
    expect(withOwnRank(view([member(true)]), ASCENDANT)?.members[0]?.rank).toBe(ASCENDANT);
  });

  it("leaves teammates and a rank Riot already sent alone", () => {
    const party = view([member(false), member(true, { ...ASCENDANT, tier: 22 })]);
    expect(withOwnRank(party, ASCENDANT)?.members.map((entry) => entry.rank.tier)).toEqual([0, 22]);
  });

  it("keeps the party as it is when the career has no rank either", () => {
    const party = view([member(true)]);
    expect(withOwnRank(party, UNRANKED)).toBe(party);
  });
});
