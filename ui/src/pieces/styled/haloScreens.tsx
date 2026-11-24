// Halo 3's own screens: Play as the Playlists menu (one highlighted bar per playlist, set the
// moment it is picked, as Halo does) and Agents as an armory: the list in the lobby's bars, the
// agent as a blue hologram on a projector, a frosted card with their abilities.
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./halo.module.css";
import own from "./haloScreens.module.css";

export function HaloPlaylists(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.lobby}>
      <header class={styles.lobbyHead}>
        <span class={styles.lobbyTitle}>Playlists</span>
        <span class={styles.lobbySub}>Choose a playlist for your party</span>
      </header>
      <ul class={styles.options}>
        <For each={play.queues()}>
          {(queue) => (
            <li>
              <button
                class={`${styles.option} ${own.playlist}`}
                data-active={play.current()?.id === queue.id ? "" : undefined}
                disabled={!play.isOwner()}
                onClick={() => play.pickQueue(queue)}
              >
                <Art src={queue.icon} class={own.glyph} fallback={<span class={own.glyph} />} />
                {queue.label}
              </button>
            </li>
          )}
        </For>
      </ul>
      <p class={styles.description}>{QUEUE_BLURBS[play.current()?.id ?? ""] ?? "Matchmade games with your party."}</p>
    </section>
  );
}

/** The picked agent: a hologram on the projector and a frosted card with their abilities. */
function ArmoryAgent(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <>
      <div class={own.projector}>
        <Art src={props.agent.portrait} class={own.hologram} fallback={<span />} />
        <span class={own.pad} aria-hidden="true" />
      </div>
      <section class={own.card}>
        <span class={own.kicker}>{props.agent.role}</span>
        <span class={own.name}>{props.agent.display_name}</span>
        <Index each={abilitySlots(props.agent)}>
          {(slot) => (
            <button
              class={own.ability}
              data-active={props.browser.tab() === slot().ability.slot ? "" : undefined}
              onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
            >
              <Art src={slot().ability.icon} class={own.abilityIcon} fallback={<span class={own.abilityIcon} />} />
              <span>{slot().ability.name}</span>
              <kbd>{slot().key}</kbd>
            </button>
          )}
        </Index>
        <p class={own.text}>{props.browser.ability()?.description ?? props.agent.description}</p>
      </section>
    </>
  );
}

export function HaloAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={own.armory}>
      <section class={styles.lobby}>
        <header class={styles.lobbyHead}>
          <span class={styles.lobbyTitle}>Agents</span>
          <span class={styles.lobbySub}>
            <For each={["all", ...ROLE_ORDER] as const}>
              {(role) => (
                <button class={own.filter} data-active={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
                  {role === "all" ? "All" : role}
                </button>
              )}
            </For>
          </span>
        </header>
        <ul class={`${styles.options} ${own.scroll}`}>
          <For each={browser.shown()}>
            {(agent) => (
              <li>
                <button class={styles.option} data-active={browser.picked()?.uuid === agent.uuid ? "" : undefined} onClick={() => browser.pick(agent)}>
                  {agent.display_name}
                  <Show when={!browser.isOwned(agent)}>
                    <small class={own.locked}>Locked</small>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </section>
      <Show when={browser.picked()}>{(agent) => <ArmoryAgent agent={agent()} browser={browser} />}</Show>
    </div>
  );
}
