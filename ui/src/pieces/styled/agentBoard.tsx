// The standard Agents piece's shared layouts (Grid, Roster, Spotlight, and Showcase when another
// style borrows it), drawn fluid at any size from the theme's tokens instead of the client's
// pixels: registry/jobs.ts offers them to every style's Agents look, so they must read right
// dressed in any style. One tree for all; the frame's data-layout picks the arrangement.
import { For, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import { playCue } from "~/menu/sound";
import { masteryOf } from "~/state/agents";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, ROLE_BLURB, abilitySlots, isMasteryShown, roleOf, useAgentBrowser } from "../agentBrowser";
import styles from "./agentBoard.module.css";

/** The layouts this board draws; the first layout ("showcase") stays the client's own page. */
export const BOARD_LAYOUTS: readonly string[] = ["grid", "roster", "spotlight"];

export function AgentBoard(props: PieceProps) {
  const browser = useAgentBrowser();
  // Grid tiles show the full portrait cropped to the face; the other lists only need the icon.
  const isPortraitGrid = () => props.piece.props["layout"] === "grid";
  return (
    <div class={styles.board}>
      <BoardBar browser={browser} />
      <ol class={styles.list}>
        <For each={browser.shown()}>
          {(agent) => <AgentTile agent={agent} browser={browser} isPortrait={isPortraitGrid()} isMasteryShown={isMasteryShown(props)} />}
        </For>
      </ol>
      <Show when={browser.picked()}>{(agent) => <AgentDetail agent={agent()} browser={browser} isMasteryShown={isMasteryShown(props)} />}</Show>
    </div>
  );
}

function BoardBar(props: { browser: AgentBrowser }) {
  const roleIcon = (role: string) => props.browser.agents().find((agent) => agent.role === role)?.role_icon ?? null;
  return (
    <header class={styles.bar}>
      <h2 class={styles.title}>Agents</h2>
      <nav class={styles.filters}>
        <button class={styles.filter} data-active={props.browser.role() === "all" ? "" : undefined} onClick={() => props.browser.filter("all")}>
          All
        </button>
        <For each={ROLE_ORDER}>
          {(role) => (
            <button class={styles.filter} title={`${role}s`} data-active={props.browser.role() === role ? "" : undefined} onClick={() => props.browser.filter(role)}>
              <Art src={roleIcon(role)} class={styles.filterIcon} fallback={<span />} />
              <span class={styles.filterText}>{role}</span>
            </button>
          )}
        </For>
      </nav>
      <button class={styles.owned} role="switch" aria-checked={props.browser.isOwnedOnly()} onClick={props.browser.toggleOwned}>
        <i data-on={props.browser.isOwnedOnly() ? "" : undefined} />
        Owned only
      </button>
    </header>
  );
}

function AgentTile(props: { agent: AgentCard; browser: AgentBrowser; isPortrait: boolean; isMasteryShown: boolean }) {
  const isOwned = () => props.browser.isOwned(props.agent);
  return (
    <li>
      <button
        class={styles.tile}
        data-active={props.browser.picked()?.uuid === props.agent.uuid ? "" : undefined}
        data-unowned={isOwned() ? undefined : ""}
        title={isOwned() ? props.agent.display_name : `${props.agent.display_name} (not unlocked)`}
        onMouseEnter={() => playCue("hover")}
        onClick={() => props.browser.pick(props.agent)}
      >
        <Art src={props.isPortrait ? (props.agent.portrait ?? props.agent.icon) : props.agent.icon} class={styles.tileArt} fallback={<span class={styles.tileArt} />} />
        <span class={styles.tileName}>{props.agent.display_name}</span>
        <span class={styles.tileRole}>{isOwned() ? props.agent.role : `${props.agent.role} · Locked`}</span>
        <Show when={props.isMasteryShown && masteryOf(props.agent.uuid).lifetime > 0}>
          <span class={styles.tileMastery} title="Mastery level">
            {masteryOf(props.agent.uuid).lifetime}
          </span>
        </Show>
      </button>
    </li>
  );
}

function AgentDetail(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  const role = () => roleOf(props.agent);
  const mastery = () => masteryOf(props.agent.uuid);
  return (
    <section class={styles.detail}>
      <Art src={props.agent.portrait} class={styles.portrait} fallback={<span />} />
      <div class={styles.info}>
        <span class={styles.kicker}>{props.agent.role}</span>
        <h3 class={styles.name}>{props.agent.display_name}</h3>
        <Show when={props.isMasteryShown}>
          <span class={styles.mastery} title={`Mastery level ${mastery().lifetime} (act level ${mastery().act})`}>
            Mastery {mastery().lifetime}
          </span>
        </Show>
        <AbilityTabs agent={props.agent} browser={props.browser} />
        <Show
          when={props.browser.ability()}
          fallback={
            <p class={styles.text}>
              {props.agent.description}
              <Show when={role()}>{(key) => <em>{ROLE_BLURB[key()]}</em>}</Show>
            </p>
          }
        >
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

function AbilityTabs(props: { agent: AgentCard; browser: AgentBrowser }) {
  const isOpen = (tab: string) => props.browser.tab() === tab;
  return (
    <nav class={styles.tabs} role="tablist">
      <button
        class={styles.tab}
        role="tab"
        aria-selected={isOpen(INFO_TAB)}
        data-active={isOpen(INFO_TAB) ? "" : undefined}
        onClick={() => props.browser.openTab(INFO_TAB)}
      >
        <b>Info</b>
      </button>
      <For each={abilitySlots(props.agent)}>
        {(slot) => (
          <button
            class={styles.tab}
            role="tab"
            aria-selected={isOpen(slot.ability.slot)}
            data-active={isOpen(slot.ability.slot) ? "" : undefined}
            title={slot.ability.name}
            onClick={() => props.browser.openTab(slot.ability.slot)}
          >
            <Art src={slot.ability.icon} class={styles.tabIcon} fallback={<span />} />
            <b>{slot.key}</b>
          </button>
        )}
      </For>
    </nav>
  );
}
