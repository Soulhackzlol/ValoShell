// Minecraft's Agents screen, after the survival inventory: a grey bevelled panel with the picked
// agent standing in the black player box, the roster as heads in sunken slots (the item tooltip
// on hover), and their abilities as a hotbar with the chosen one's text underneath.
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import styles from "./minecraftAgents.module.css";

/** The picked agent standing in the player box, their abilities as a hotbar with the text under. */
function PlayerBox(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <div class={styles.top}>
      <div class={styles.playerBox}>
        <Art src={props.agent.portrait} class={styles.player} fallback={<span />} />
      </div>
      <div class={styles.about}>
        <span class={styles.label}>{props.agent.display_name}</span>
        <span class={styles.role}>{props.agent.role}</span>
        <div class={styles.hotbar}>
          <Index each={abilitySlots(props.agent)}>
            {(slot) => (
              <button
                class={styles.slot}
                data-on={props.browser.tab() === slot().ability.slot ? "" : undefined}
                onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
              >
                <Art src={slot().ability.icon} class={styles.icon} fallback={<span class={styles.icon} />} />
                <span class={styles.count}>{slot().key}</span>
                <span class={styles.tooltip}>{slot().ability.name}</span>
              </button>
            )}
          </Index>
        </div>
        <p class={styles.text}>{props.browser.ability()?.description ?? props.agent.description}</p>
      </div>
    </div>
  );
}

export function McAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <section class={styles.gui}>
      <Show when={browser.picked()}>{(agent) => <PlayerBox agent={agent()} browser={browser} />}</Show>
      <div class={styles.tabs}>
        <For each={["all", ...ROLE_ORDER] as const}>
          {(role) => (
            <button class={styles.tab} data-on={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
              {role === "all" ? "All" : role}
            </button>
          )}
        </For>
      </div>
      <div class={styles.grid}>
        <For each={browser.shown()}>
          {(agent) => (
            <button
              class={styles.slot}
              data-on={browser.picked()?.uuid === agent.uuid ? "" : undefined}
              data-locked={browser.isOwned(agent) ? undefined : ""}
              onClick={() => browser.pick(agent)}
            >
              <Art src={agent.icon} class={styles.icon} fallback={<span class={styles.icon} />} />
              <span class={styles.tooltip}>
                {agent.display_name}
                <small>{browser.isOwned(agent) ? agent.role : "Locked"}</small>
              </span>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}
