// VALORANT Beta (2020)-style Agents page, after the closed beta's pre-release screens: an
// off-white sheet with registration marks and tiny technical codes, the roster as thin
// line-framed cells under text role tabs, the agent drawn on a pale grey plate over their name
// in outline, and an "agent file" with line-framed ability keys and red as the only colour.
import { For, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, ROLE_BLURB, abilitySlots, isMasteryShown, roleOf, useAgentBrowser } from "../agentBrowser";
import styles from "./betaAgents.module.css";

/** Two digits, as the beta numbered its files and slots ("03"). */
const serial = (value: number) => String(value).padStart(2, "0");

export function BetaAgents(props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <section class={styles.sheet}>
      <span class={styles.mark} data-corner="tl" />
      <span class={styles.mark} data-corner="br" />
      <BetaRoster browser={browser} />
      <Show when={browser.picked()}>
        {(agent) => (
          <>
            <div class={styles.plate}>
              <span class={styles.ghost} aria-hidden="true">
                {agent().display_name}
              </span>
              <Art src={agent().portrait} class={styles.portrait} fallback={<span />} />
              <span class={styles.plateCode}>{`AGT-${agent().upper_name.replace(/[^A-Z0-9]/g, "")} // REF`}</span>
            </div>
            <BetaFile agent={agent()} browser={browser} isMasteryShown={isMasteryShown(props)} />
          </>
        )}
      </Show>
    </section>
  );
}

function BetaRoster(props: { browser: AgentBrowser }) {
  return (
    <div class={styles.roster}>
      <header class={styles.head}>
        <h2>Agents</h2>
        <span class={styles.code}>{`Roster // ${serial(props.browser.shown().length)}`}</span>
      </header>
      <nav class={styles.roles}>
        <For each={["all", ...ROLE_ORDER] as const}>
          {(role) => (
            <button class={styles.role} data-active={props.browser.role() === role ? "" : undefined} onClick={() => props.browser.filter(role)}>
              {role === "all" ? "All" : role}
            </button>
          )}
        </For>
      </nav>
      <ol class={styles.grid}>
        <For each={props.browser.shown()}>{(agent) => <BetaCell agent={agent} browser={props.browser} />}</For>
      </ol>
      <button class={styles.owned} role="switch" aria-checked={props.browser.isOwnedOnly()} onClick={props.browser.toggleOwned}>
        <i data-on={props.browser.isOwnedOnly() ? "" : undefined} />
        Owned only
      </button>
    </div>
  );
}

function BetaCell(props: { agent: AgentCard; browser: AgentBrowser }) {
  const isOwned = () => props.browser.isOwned(props.agent);
  return (
    <li>
      <button
        class={styles.cell}
        data-active={props.browser.picked()?.uuid === props.agent.uuid ? "" : undefined}
        data-unowned={isOwned() ? undefined : ""}
        title={isOwned() ? props.agent.display_name : `${props.agent.display_name} (not unlocked)`}
        onMouseEnter={() => playCue("hover")}
        onClick={() => props.browser.pick(props.agent)}
      >
        <Art src={props.agent.icon} class={styles.cellIcon} fallback={<span>{props.agent.display_name}</span>} />
      </button>
    </li>
  );
}

function BetaFile(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  const role = () => roleOf(props.agent);
  const mastery = () => props.browser.mastery();
  return (
    <article class={styles.file}>
      <span class={styles.code}>Agent file</span>
      <h3 class={styles.name}>{props.agent.display_name}</h3>
      <div class={styles.facts}>
        <span>{props.agent.role}</span>
        <Show when={props.isMasteryShown}>
          <span class={styles.mastery} title={`Mastery level ${mastery().lifetime} (act level ${mastery().act})`}>
            Mastery <b class="num">{mastery().lifetime}</b>
          </span>
        </Show>
      </div>
      <BetaAbilityKeys agent={props.agent} browser={props.browser} />
      <div class={styles.text}>
        <Show
          when={props.browser.ability()}
          fallback={
            <>
              <p>{props.agent.description}</p>
              <Show when={role()}>{(key) => <p class={styles.blurb}>{ROLE_BLURB[key()]}</p>}</Show>
            </>
          }
        >
          {(ability) => (
            <>
              <h4>{ability().name}</h4>
              <p>{ability().description}</p>
            </>
          )}
        </Show>
      </div>
    </article>
  );
}

function BetaAbilityKeys(props: { agent: AgentCard; browser: AgentBrowser }) {
  const isOpen = (tab: string) => props.browser.tab() === tab;
  return (
    <nav class={styles.keys} role="tablist">
      <button class={styles.key} role="tab" aria-selected={isOpen(INFO_TAB)} data-active={isOpen(INFO_TAB) ? "" : undefined} onClick={() => props.browser.openTab(INFO_TAB)}>
        <b>Info</b>
        <small>00</small>
      </button>
      <For each={abilitySlots(props.agent)}>
        {(slot, index) => (
          <button
            class={styles.key}
            role="tab"
            aria-selected={isOpen(slot.ability.slot)}
            data-active={isOpen(slot.ability.slot) ? "" : undefined}
            title={slot.ability.name}
            onMouseEnter={() => playCue("hover")}
            onClick={() => props.browser.openTab(slot.ability.slot)}
          >
            <Art src={slot.ability.icon} class={styles.keyIcon} fallback={<b>{slot.key}</b>} />
            <small>{slot.key || serial(index() + 1)}</small>
          </button>
        )}
      </For>
    </nav>
  );
}
