// VALORANT 2022's Agents tab: the picked agent's art large on a flat band of their colour with
// their name in giant caps behind, role, bio and the four abilities on the left, and every agent
// as a square tile in a row along the bottom.
import { For, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { masteryOf } from "~/state/agents";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, isMasteryShown, useAgentBrowser } from "../agentBrowser";
import styles from "./valnowAgents.module.css";

export function V22Agents(props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.agents}>
      {/* Keyed so each pick redraws the stage and its fade runs again. */}
      <Show when={browser.picked()} keyed>
        {(agent) => <AgentStage agent={agent} browser={browser} isMasteryShown={isMasteryShown(props)} />}
      </Show>
      <ol class={styles.grid}>
        <For each={browser.agents()}>
          {(agent) => (
            <li>
              <button
                class={styles.tile}
                title={browser.isOwned(agent) ? agent.display_name : `${agent.display_name} (locked)`}
                data-on={browser.picked()?.uuid === agent.uuid ? "" : undefined}
                data-locked={browser.isOwned(agent) ? undefined : ""}
                onClick={() => browser.pick(agent)}
              >
                <Art src={agent.icon} class={styles.tileIcon} fallback={<span>{agent.display_name.slice(0, 2)}</span>} />
              </button>
            </li>
          )}
        </For>
      </ol>
    </div>
  );
}

function AgentStage(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  // Colours are listed darkest first; the band uses the brightest, as the 2022 page did.
  const tint = () => props.agent.colors.at(-1) ?? "#ff4655";
  return (
    <section class={styles.stage} style={{ "--tint": tint() }}>
      <span class={styles.band} aria-hidden="true" />
      <span class={styles.ghost} aria-hidden="true">
        {props.agent.display_name}
      </span>
      <Art src={props.agent.portrait} class={styles.portrait} fallback={<span />} />
      <div class={styles.info}>
        <span class={styles.role}>
          <Art src={props.agent.role_icon} class={styles.roleIcon} fallback={<span />} />
          {`// ${props.agent.role}`}
        </span>
        <h2 class={styles.name}>{props.agent.display_name}</h2>
        <Show when={props.isMasteryShown}>
          <MasteryChip uuid={props.agent.uuid} />
        </Show>
        <Show when={props.browser.ability()} fallback={<p class={styles.text}>{props.agent.description}</p>}>
          {(ability) => (
            <p class={styles.text}>
              <b>{ability().name}</b>
              {ability().description}
            </p>
          )}
        </Show>
        <AbilityRow agent={props.agent} browser={props.browser} />
      </div>
    </section>
  );
}

function MasteryChip(props: { uuid: string }) {
  const mastery = () => masteryOf(props.uuid);
  return (
    <span class={styles.mastery} title={`Act level ${mastery().act}`}>
      Mastery <b>{mastery().lifetime}</b>
    </span>
  );
}

/** The four abilities as icon boxes with the player's key under each; clicking one opens it. */
function AbilityRow(props: { agent: AgentCard; browser: AgentBrowser }) {
  const isOpen = (slot: string) => props.browser.tab() === slot;
  return (
    <div class={styles.abilities} role="tablist">
      <For each={abilitySlots(props.agent)}>
        {(slot) => (
          <button
            role="tab"
            class={styles.ability}
            aria-selected={isOpen(slot.ability.slot)}
            data-on={isOpen(slot.ability.slot) ? "" : undefined}
            title={slot.ability.name}
            onClick={() => props.browser.openTab(isOpen(slot.ability.slot) ? INFO_TAB : slot.ability.slot)}
          >
            <Art src={slot.ability.icon} class={styles.abilityIcon} fallback={<span />} />
            <small>{slot.key}</small>
          </button>
        )}
      </For>
    </div>
  );
}
