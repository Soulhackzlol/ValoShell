import { describe, expect, it, vi } from "vitest";

const offer = { agent_id: "fade", name: "Fade", image: null, prices: [{ currency: "vp", amount: 1000 }] };
vi.mock("~/ipc/commands", () => ({ call: () => Promise.resolve([offer]) }));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));

const { agentStoreOffer, formatAgentPrices, loadAgentStore } = await import("./agentStore");

describe("formatAgentPrices", () => {
  it("joins grouped prices with their currency", () => {
    const prices = [
      { currency: "vp", amount: 1000 },
      { currency: "kc", amount: 8000 },
    ];
    expect(formatAgentPrices(prices)).toBe("1,000 VP · 8,000 KC");
  });
});

describe("agentStoreOffer", () => {
  it("is null before the store is read, then finds the agent in any case", async () => {
    expect(agentStoreOffer("fade")).toBeNull();
    loadAgentStore();
    await vi.waitFor(() => expect(agentStoreOffer("FADE")).toEqual(offer));
  });
});
