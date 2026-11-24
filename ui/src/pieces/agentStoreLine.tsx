// One line under a locked agent's bio: what the agent store asks for them. View only: there is
// no buy button, unlocking happens in VALORANT.
import { Show, onMount } from "solid-js";
import { agentStoreOffer, formatAgentPrices, loadAgentStore } from "~/state/agentStore";
import { isAgentOwned } from "~/state/agents";

export function AgentStoreLine(props: { agentId: string; class?: string }) {
  onMount(() => loadAgentStore());
  const offer = () => (isAgentOwned(props.agentId) ? null : agentStoreOffer(props.agentId));
  return (
    <Show when={offer()}>
      {(found) => (
        <p class={props.class} data-agent-store="">
          In the agent store: {formatAgentPrices(found().prices)}. Unlock it in VALORANT.
        </p>
      )}
    </Show>
  );
}
