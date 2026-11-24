// Glass's Agents screen, after a macOS app: a frosted sidebar with a search field and the roster
// as rows (round avatar, name, role), and the picked agent on a big frosted card with a sliding
// segmented control (Overview and each ability) above their text.
import { For, Show, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import styles from "./glassAgents.module.css";

/** The picked agent on the big frosted card: Overview or one ability under the segmented control. */
function AgentCardPanel(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <section class={styles.card}>
      <Art src={props.agent.portrait} class={styles.portrait} fallback={<span />} />
      <div class={styles.body}>
        <span class={styles.kicker}>{props.agent.role}</span>
        <h2 class={styles.name}>{props.agent.display_name}</h2>
        <div class={styles.segmented} role="tablist">
          <button role="tab" aria-selected={props.browser.tab() === INFO_TAB} data-on={props.browser.tab() === INFO_TAB ? "" : undefined} onClick={() => props.browser.openTab(INFO_TAB)}>
            Overview
          </button>
          <For each={abilitySlots(props.agent)}>
            {(slot) => (
              <button
                role="tab"
                aria-selected={props.browser.tab() === slot.ability.slot}
                data-on={props.browser.tab() === slot.ability.slot ? "" : undefined}
                title={slot.ability.name}
                onClick={() => props.browser.openTab(slot.ability.slot)}
              >
                <Art src={slot.ability.icon} class={styles.segmentIcon} fallback={<span>{slot.key}</span>} />
              </button>
            )}
          </For>
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

export function GlassAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  const [query, setQuery] = createSignal("");
  const listed = () => {
    const text = query().trim().toLowerCase();
    return text ? browser.shown().filter((agent) => agent.display_name.toLowerCase().includes(text)) : browser.shown();
  };
  return (
    <div class={styles.app}>
      <aside class={styles.sidebar}>
        <input class={styles.search} placeholder="Search" value={query()} onInput={(event) => setQuery(event.currentTarget.value)} spellcheck={false} />
        <nav class={styles.roles}>
          <For each={["all", ...ROLE_ORDER] as const}>
            {(role) => (
              <button class={styles.role} data-on={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
                {role === "all" ? "All" : role}
              </button>
            )}
          </For>
        </nav>
        <ol class={styles.rows}>
          <For each={listed()}>
            {(agent) => (
              <li>
                <button class={styles.row} data-on={browser.picked()?.uuid === agent.uuid ? "" : undefined} onClick={() => browser.pick(agent)}>
                  <Art src={agent.icon} class={styles.avatar} fallback={<span class={styles.avatar} />} />
                  <span class={styles.rowText}>
                    <b>{agent.display_name}</b>
                    <small>{browser.isOwned(agent) ? agent.role : `${agent.role} · Locked`}</small>
                  </span>
                </button>
              </li>
            )}
          </For>
        </ol>
      </aside>
      <Show when={browser.picked()}>{(agent) => <AgentCardPanel agent={agent()} browser={browser} />}</Show>
    </div>
  );
}
