// League's Agents screen, after the client's Collection > Champions: a grid of square portraits
// in hextech gold frames with role filters above, and the picked agent's page beside it (their
// art behind, name in gold caps, abilities as gold-framed squares with the one picked explained).
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import styles from "./leagueAgents.module.css";

/** The picked agent's page: their art behind, abilities as gold squares, the picked one explained. */
function AgentPage(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <section class={styles.page}>
      <Art src={props.agent.background ?? props.agent.portrait} class={styles.splash} fallback={<span class={styles.splash} />} />
      <Art src={props.agent.portrait} class={styles.figure} fallback={<span />} />
      <div class={styles.info}>
        <span class={styles.title}>{props.agent.role}</span>
        <h2 class={styles.name}>{props.agent.display_name}</h2>
        <div class={styles.abilities}>
          <Index each={abilitySlots(props.agent)}>
            {(slot) => (
              <button
                class={styles.ability}
                data-on={props.browser.tab() === slot().ability.slot ? "" : undefined}
                title={slot().ability.name}
                onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
              >
                <Art src={slot().ability.icon} class={styles.abilityIcon} fallback={<span class={styles.abilityIcon} />} />
                <kbd>{slot().key}</kbd>
              </button>
            )}
          </Index>
        </div>
        <Show when={props.browser.ability()} fallback={<p class={styles.text}>{props.agent.description}</p>}>
          {(ability) => (
            <p class={styles.text}>
              <b>{ability().name}</b>
              {ability().description}
            </p>
          )}
        </Show>
      </div>
    </section>
  );
}

export function LeagueAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.collection}>
      <section class={styles.browse}>
        <header class={styles.filters}>
          <span class={styles.heading}>Agents</span>
          <For each={["all", ...ROLE_ORDER] as const}>
            {(role) => (
              <button class={styles.filter} data-on={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
                {role === "all" ? "All" : role}
              </button>
            )}
          </For>
          <span class={styles.count}>
            {browser.shown().filter(browser.isOwned).length} / {browser.shown().length} owned
          </span>
        </header>
        <div class={styles.grid}>
          <For each={browser.shown()}>
            {(agent) => (
              <button
                class={styles.square}
                data-picked={browser.picked()?.uuid === agent.uuid ? "" : undefined}
                data-locked={browser.isOwned(agent) ? undefined : ""}
                title={agent.display_name}
                onClick={() => browser.pick(agent)}
              >
                <Art src={agent.icon} class={styles.squareArt} fallback={<span class={styles.squareArt} />} />
                <span class={styles.squareName}>{agent.display_name}</span>
              </button>
            )}
          </For>
        </div>
      </section>
      <Show when={browser.picked()}>{(agent) => <AgentPage agent={agent()} browser={browser} />}</Show>
    </div>
  );
}
