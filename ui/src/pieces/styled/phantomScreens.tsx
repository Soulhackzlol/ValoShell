// Phantom's own screens, after Persona 5: Agents as the party roster (names on slanted strips
// thrown down the right, the agent cut out on red halftone, their name in ransom-note letters,
// abilities as a skill list) and Play as mission select (modes as thrown words, the picked one
// opened as a calling card).
import { For, Index, Show, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { RansomText } from "./phantom";
import { usePlay } from "./usePlay";
import styles from "./phantomScreens.module.css";

// ---- party roster -----------------------------------------------------------------------

function Strip(props: { agent: AgentCard; index: number; browser: AgentBrowser }) {
  const isPicked = () => props.browser.picked()?.uuid === props.agent.uuid;
  return (
    <button
      class={styles.strip}
      data-picked={isPicked() ? "" : undefined}
      data-locked={props.browser.isOwned(props.agent) ? undefined : ""}
      style={{ "--i": props.index }}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.browser.pick(props.agent)}
    >
      <Art src={props.agent.icon} class={styles.stripIcon} fallback={<span class={styles.stripIcon} />} />
      <span>{props.agent.display_name}</span>
    </button>
  );
}

function Skills(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <ol class={styles.skills}>
      <Index each={abilitySlots(props.agent)}>
        {(slot) => (
          <li>
            <button
              class={styles.skill}
              data-open={props.browser.tab() === slot().ability.slot ? "" : undefined}
              data-ult={slot().isUltimate ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
            >
              <Art src={slot().ability.icon} class={styles.skillIcon} fallback={<span class={styles.skillIcon} />} />
              <span>{slot().ability.name}</span>
              <b>{slot().key || "—"}</b>
            </button>
          </li>
        )}
      </Index>
    </ol>
  );
}

function Spotlight(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <section class={styles.spotlight}>
      <Art src={props.agent.portrait} class={styles.cutout} fallback={<span />} />
      <div class={styles.nameplate}>
        <span class={styles.tag}>{props.agent.role}</span>
        <RansomText text={props.agent.display_name} class={styles.ransom} />
      </div>
      <div class={styles.sheet}>
        <span class={styles.sheetTitle}>Skills</span>
        <Skills agent={props.agent} browser={props.browser} />
        <p class={styles.note}>{props.browser.ability()?.description ?? props.agent.description}</p>
      </div>
    </section>
  );
}

export function PhAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.roster}>
      <Show when={browser.picked()}>{(agent) => <Spotlight agent={agent()} browser={browser} />}</Show>
      <section class={styles.side}>
        <nav class={styles.roles}>
          <For each={["all", ...ROLE_ORDER] as const}>
            {(role) => (
              <button class={styles.role} data-on={browser.role() === role ? "" : undefined} onClick={() => browser.filter(role)}>
                {role === "all" ? "All" : role}
              </button>
            )}
          </For>
        </nav>
        <div class={styles.strips}>
          <For each={browser.shown()}>{(agent, index) => <Strip agent={agent} index={index()} browser={browser} />}</For>
        </div>
      </section>
    </div>
  );
}

// ---- mission select ---------------------------------------------------------------------

function CallingCard(props: { queue: QueueOption; play: ReturnType<typeof usePlay> }) {
  const isActive = () => props.play.current()?.id === props.queue.id;
  return (
    <section class={styles.card}>
      <span class={styles.tag}>The target</span>
      <div class={styles.cardArt}>
        <Art src={props.queue.art} class={styles.cardImage} fallback={<span class={styles.cardImage} />} />
      </div>
      <RansomText text={props.queue.label} class={styles.ransom} />
      <p class={styles.note}>{QUEUE_BLURBS[props.queue.id] ?? "Your target awaits."}</p>
      <button class={styles.send} data-active={isActive() ? "" : undefined} disabled={isActive() || !props.play.isOwner()} onClick={() => props.play.pickQueue(props.queue)}>
        {isActive() ? "Target locked" : props.play.isOwner() ? "Send the calling card" : "The leader decides"}
      </button>
      <span class={styles.signature}>— The Phantoms</span>
    </section>
  );
}

export function PhMissions(_props: PieceProps) {
  const play = usePlay();
  const [browsedId, setBrowsedId] = createSignal("");
  const shown = () => play.queues().find((queue) => queue.id === (browsedId() || play.current()?.id)) ?? play.current() ?? undefined;
  return (
    <div class={styles.missions}>
      <div class={styles.words}>
        <span class={styles.wordsTitle}>Missions</span>
        <For each={play.queues()}>
          {(queue, index) => (
            <button
              class={styles.word}
              data-picked={shown()?.id === queue.id ? "" : undefined}
              style={{ "--i": index() }}
              onMouseEnter={() => playCue("hover")}
              onClick={() => setBrowsedId(queue.id)}
            >
              <span>{queue.label}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={shown()}>{(queue) => <CallingCard queue={queue()} play={play} />}</Show>
    </div>
  );
}
