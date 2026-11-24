// Fortnite's own screens, after the Battle Royale lobby: Agents as a Locker (the character big
// on the sky, the roster as rarity tiles, abilities as rounded cards) and Play as Discover (the
// picked mode as a hero banner over a row of mode tiles that slides sideways).
import { For, Index, Show, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { slideOnWheel } from "~/ui/sideScroll";
import { type AgentBrowser, type Role, INFO_TAB, abilitySlots, roleOf, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./fortniteScreens.module.css";

/** Roles shown as Fortnite rarities, so the roster reads like a Locker. */
const RARITY: Record<Role, { name: string; tone: string }> = {
  Duelist: { name: "Legendary", tone: "legendary" },
  Initiator: { name: "Epic", tone: "epic" },
  Controller: { name: "Rare", tone: "rare" },
  Sentinel: { name: "Uncommon", tone: "uncommon" },
};

const rarityOf = (agent: AgentCard) => {
  const role = roleOf(agent);
  return role ? RARITY[role] : { name: "Common", tone: "common" };
};

// ---- locker -----------------------------------------------------------------------------

function RosterTile(props: { agent: AgentCard; index: number; browser: AgentBrowser }) {
  const isPicked = () => props.browser.picked()?.uuid === props.agent.uuid;
  return (
    <button
      class={styles.tile}
      data-tone={rarityOf(props.agent).tone}
      data-picked={isPicked() ? "" : undefined}
      data-locked={props.browser.isOwned(props.agent) ? undefined : ""}
      style={{ "--i": props.index }}
      title={props.browser.isOwned(props.agent) ? props.agent.display_name : `${props.agent.display_name} (not unlocked)`}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.browser.pick(props.agent)}
    >
      <Art src={props.agent.icon} class={styles.tileArt} fallback={<span class={styles.tileArt} />} />
      <span class={styles.tileName}>{props.agent.display_name}</span>
    </button>
  );
}

function Roster(props: { browser: AgentBrowser }) {
  return (
    <section class={styles.roster}>
      <nav class={styles.pills}>
        <For each={["all", ...ROLE_ORDER] as const}>
          {(role) => (
            <button class={styles.pill} data-active={props.browser.role() === role ? "" : undefined} onClick={() => props.browser.filter(role)}>
              {role === "all" ? "All" : `${role}s`}
            </button>
          )}
        </For>
      </nav>
      <div class={styles.grid}>
        <For each={props.browser.shown()}>{(agent, index) => <RosterTile agent={agent} index={index()} browser={props.browser} />}</For>
      </div>
    </section>
  );
}

function AbilityCards(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <div class={styles.abilities}>
      <Index each={abilitySlots(props.agent)}>
        {(slot) => (
          <button
            class={styles.ability}
            data-open={props.browser.tab() === slot().ability.slot ? "" : undefined}
            data-ult={slot().isUltimate ? "" : undefined}
            title={slot().ability.name}
            onMouseEnter={() => playCue("hover")}
            onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
          >
            <Art src={slot().ability.icon} class={styles.abilityIcon} fallback={<span class={styles.abilityIcon} />} />
            <Show when={slot().key}>
              <kbd>{slot().key}</kbd>
            </Show>
          </button>
        )}
      </Index>
    </div>
  );
}

function Showcase(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <section class={styles.showcase} data-tone={rarityOf(props.agent).tone}>
      <Art src={props.agent.portrait} class={styles.hero} fallback={<span />} />
      <div class={styles.caption}>
        <span class={styles.rarity}>{rarityOf(props.agent).name}</span>
        <h2 class={styles.heroName}>{props.agent.display_name}</h2>
        <span class={styles.heroRole}>{props.agent.role}</span>
      </div>
      <AbilityCards agent={props.agent} browser={props.browser} />
      <p class={styles.blurb}>
        <Show when={props.browser.ability()} fallback={props.agent.description}>
          {(ability) => (
            <>
              <b>{ability().name}</b> {ability().description}
            </>
          )}
        </Show>
      </p>
    </section>
  );
}

export function FnAgents(_props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.locker}>
      <Show when={browser.picked()}>{(agent) => <Showcase agent={agent()} browser={browser} />}</Show>
      <Roster browser={browser} />
    </div>
  );
}

// ---- discover ---------------------------------------------------------------------------

function ModeTile(props: { queue: QueueOption; index: number; isPicked: boolean; isActive: boolean; onPick: () => void }) {
  return (
    <button
      class={styles.mode}
      data-picked={props.isPicked ? "" : undefined}
      style={{ "--i": props.index }}
      onMouseEnter={() => playCue("hover")}
      onClick={(event) => {
        props.onPick();
        event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
      }}
    >
      <Art src={props.queue.art} class={styles.modeArt} fallback={<span class={styles.modeArt} />} />
      <span class={styles.modeName}>{props.queue.label}</span>
      <Show when={props.isActive}>
        <span class={styles.modeTag}>Selected</span>
      </Show>
    </button>
  );
}

function Banner(props: { queue: QueueOption; play: ReturnType<typeof usePlay> }) {
  const isActive = () => props.play.current()?.id === props.queue.id;
  return (
    <section class={styles.banner}>
      <Art src={props.queue.art} class={styles.bannerArt} fallback={<span class={styles.bannerArt} />} />
      <div class={styles.bannerText}>
        <span class={styles.rarity}>Featured</span>
        <h2 class={styles.heroName}>{props.queue.label}</h2>
        <p>{QUEUE_BLURBS[props.queue.id] ?? ""}</p>
        <button class={styles.select} data-active={isActive() ? "" : undefined} disabled={isActive() || !props.play.isOwner()} onClick={() => props.play.pickQueue(props.queue)}>
          {isActive() ? "Selected" : props.play.isOwner() ? "Select" : "Party leader picks"}
        </button>
      </div>
    </section>
  );
}

export function FnDiscover(_props: PieceProps) {
  const play = usePlay();
  const [browsedId, setBrowsedId] = createSignal("");
  const shown = () => play.queues().find((queue) => queue.id === (browsedId() || play.current()?.id)) ?? play.current() ?? undefined;
  return (
    <div class={styles.discover}>
      <header class={styles.discoverHead}>
        <span class={styles.discoverTitle}>Discover</span>
      </header>
      <Show when={shown()}>{(queue) => <Banner queue={queue()} play={play} />}</Show>
      <span class={styles.rowTitle}>Game modes</span>
      <div class={styles.row} onWheel={slideOnWheel}>
        <For each={play.queues()}>
          {(queue, index) => (
            <ModeTile queue={queue} index={index()} isPicked={shown()?.id === queue.id} isActive={play.current()?.id === queue.id} onPick={() => setBrowsedId(queue.id)} />
          )}
        </For>
      </div>
    </div>
  );
}
