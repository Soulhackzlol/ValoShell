// Counter-Strike's Agents screen, as an inventory: agents as item cards with a rarity bar (roles
// read as CS grades) and an inspect panel beside them, the way CS:GO and CS2 show an agent skin.
// One piece, two eras: CS:GO's slate Panorama cards or CS2's flat near-black ones lit from below.
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, type Role, INFO_TAB, abilitySlots, roleOf, useAgentBrowser } from "../agentBrowser";
import styles from "./csAgents.module.css";

/** Roles as Counter-Strike grades, the colour of the bar under each card. */
const GRADE: Record<Role, { name: string; color: string }> = {
  Duelist: { name: "Covert", color: "#eb4b4b" },
  Initiator: { name: "Classified", color: "#d32ce6" },
  Controller: { name: "Restricted", color: "#8847ff" },
  Sentinel: { name: "Mil-Spec", color: "#4b69ff" },
};

const gradeOf = (agent: AgentCard) => {
  const role = roleOf(agent);
  return role ? GRADE[role] : { name: "Base Grade", color: "#b0c3d9" };
};

/** The inspect panel beside the inventory: the picked agent, their grade and abilities. */
function InspectPanel(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <section class={styles.inspect} style={{ "--grade": gradeOf(props.agent).color }}>
      <Art src={props.agent.portrait} class={styles.inspectArt} fallback={<span />} />
      <div class={styles.inspectText}>
        <span class={styles.grade}>
          {gradeOf(props.agent).name} Agent · {props.agent.role}
        </span>
        <h2 class={styles.name}>{props.agent.display_name}</h2>
        <ol class={styles.abilities}>
          <Index each={abilitySlots(props.agent)}>
            {(slot) => (
              <li>
                <button
                  class={styles.ability}
                  data-on={props.browser.tab() === slot().ability.slot ? "" : undefined}
                  onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
                >
                  <Art src={slot().ability.icon} class={styles.abilityIcon} fallback={<span class={styles.abilityIcon} />} />
                  <span>{slot().ability.name}</span>
                  <kbd>{slot().key}</kbd>
                </button>
              </li>
            )}
          </Index>
        </ol>
        <p class={styles.text}>{props.browser.ability()?.description ?? props.agent.description}</p>
      </div>
    </section>
  );
}

function CsAgents(props: { era: "csgo" | "cs2" }) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.inventory} data-era={props.era}>
      <section class={styles.panel}>
        <header class={styles.head}>
          <span class={styles.title}>Agents</span>
          <For each={["all", ...ROLE_ORDER] as const}>
            {(role) => (
              <button class={styles.tab} data-on={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
                {role === "all" ? "All" : role}
              </button>
            )}
          </For>
        </header>
        <div class={styles.grid}>
          <For each={browser.shown()}>
            {(agent) => (
              <button
                class={styles.item}
                style={{ "--grade": gradeOf(agent).color }}
                data-on={browser.picked()?.uuid === agent.uuid ? "" : undefined}
                data-locked={browser.isOwned(agent) ? undefined : ""}
                onMouseEnter={() => playCue("hover")}
                onClick={() => browser.pick(agent)}
              >
                <Art src={agent.icon} class={styles.itemArt} fallback={<span class={styles.itemArt} />} />
                <span class={styles.itemName}>
                  Agent | <b>{agent.display_name}</b>
                </span>
              </button>
            )}
          </For>
        </div>
      </section>
      <Show when={browser.picked()}>{(agent) => <InspectPanel agent={agent()} browser={browser} />}</Show>
    </div>
  );
}

export function CsgoAgents(_props: PieceProps) {
  return <CsAgents era="csgo" />;
}

export function Cs2Agents(_props: PieceProps) {
  return <CsAgents era="cs2" />;
}
