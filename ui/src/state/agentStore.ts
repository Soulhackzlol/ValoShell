// The agent store, view only: which agents are on sale and for what. Read once a page asks
// and again on connect. Nothing here (or anywhere in ValoShell) buys; unlocking is in VALORANT.
import { createMemo, createRoot, createSignal } from "solid-js";
import type { AgentOfferView } from "~/bindings/AgentOfferView";
import type { AgentPriceView } from "~/bindings/AgentPriceView";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";

const CURRENCY_LABEL: Record<string, string> = { vp: "VP", kc: "KC" };

const [offers, setOffers] = createSignal<AgentOfferView[] | null>(null);
let isLoading = false;
// Set once a page asked for the store, so a read that failed offline is retried on connect.
let isWanted = false;

const byAgent = createRoot(() =>
  createMemo(
    () => new Map((offers() ?? []).map((offer) => [offer.agent_id, offer])),
  ),
);

/** Read the agent store unless an answer is already here (or on its way). */
export function loadAgentStore(isForced = false): void {
  isWanted = true;
  if (isLoading || (offers() !== null && !isForced)) return;
  isLoading = true;
  call("get_agent_store", {})
    .then(setOffers, (error: unknown) =>
      console.warn("agent_store_read_failed", error),
    )
    .finally(() => {
      isLoading = false;
    });
}

/** The agent's store offer, or null when it is not on sale (or not read yet). */
export function agentStoreOffer(agentId: string): AgentOfferView | null {
  return byAgent().get(agentId.toLowerCase()) ?? null;
}

/** `1,000 VP · 8,000 KC`. */
export function formatAgentPrices(prices: readonly AgentPriceView[]): string {
  return prices
    .map(
      (price) =>
        `${price.amount.toLocaleString("en-US")} ${CURRENCY_LABEL[price.currency] ?? price.currency.toUpperCase()}`,
    )
    .join(" · ");
}

onAppEvent("connection", (status) => {
  if (status.state === "connected" && isWanted) loadAgentStore(true);
  if (status.state !== "connected") setOffers(null);
});
