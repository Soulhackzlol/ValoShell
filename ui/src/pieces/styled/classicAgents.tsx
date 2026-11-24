// CS 1.6's Agents screen, after its "choose a class" menu: an olive VGUI window with the agents
// as numbered raised buttons down the left, the picked one's picture in a sunken box with their
// text beside it, role tabs on top and Auto-select in the footer.
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import { Window } from "./classic";
import styles from "./classic.module.css";
import own from "./classicAgents.module.css";

/** The picked agent: picture in a sunken box, abilities as list rows, the picked one's text. */
function AgentInfo(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <div class={own.info}>
      <div class={own.picture}>
        <Art src={props.agent.portrait} class={own.portrait} fallback={<span />} />
      </div>
      <div class={own.text}>
        <span>
          <b>{props.agent.display_name}</b> · {props.agent.role}
        </span>
        <Index each={abilitySlots(props.agent)}>
          {(slot) => (
            <button
              class={`${styles.listRow} ${own.ability}`}
              data-active={props.browser.tab() === slot().ability.slot ? "" : undefined}
              onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
            >
              [{slot().key || "?"}] {slot().ability.name}
            </button>
          )}
        </Index>
        <p>{props.browser.ability()?.description ?? props.agent.description}</p>
      </div>
    </div>
  );
}

/** The roster as numbered raised buttons, the way the class menu lists its choices. */
function Choices(props: { browser: AgentBrowser }) {
  return (
    <div class={own.choices}>
      <For each={props.browser.shown()}>
        {(agent, index) => (
          <button
            class={`${styles.button} ${own.choice}`}
            data-active={props.browser.picked()?.uuid === agent.uuid ? "" : undefined}
            disabled={!props.browser.isOwned(agent)}
            onClick={() => props.browser.pick(agent)}
          >
            {index() + 1}&nbsp;&nbsp;{agent.display_name}
          </button>
        )}
      </For>
    </div>
  );
}

export function Cs16Agents(_props: PieceProps) {
  const browser = useAgentBrowser();
  const autoSelect = () => {
    const owned = browser.shown().filter(browser.isOwned);
    const pick = owned[Math.floor(Math.random() * owned.length)];
    if (pick) browser.pick(pick);
  };
  return (
    <Window
      title="Select an Agent"
      footer={
        <>
          <span class={styles.status}>{browser.shown().length} agents</span>
          <button class={styles.button} onClick={autoSelect}>
            Auto-select
          </button>
        </>
      }
    >
      <div class={styles.tabs}>
        <For each={["all", ...ROLE_ORDER] as const}>
          {(role) => (
            <button class={styles.tab} data-active={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
              {role === "all" ? "All" : `${role}s`}
            </button>
          )}
        </For>
      </div>
      <div class={own.split}>
        <Choices browser={browser} />
        <Show when={browser.picked()}>{(agent) => <AgentInfo agent={agent()} browser={browser} />}</Show>
      </div>
    </Window>
  );
}
