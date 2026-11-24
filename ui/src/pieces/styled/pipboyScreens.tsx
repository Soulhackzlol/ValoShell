// Pip-Boy's own screens, after Fallout 4's wrist computer: Agents as INV (role sub-tabs, a
// cursor list, the agent drawn in green beside a stat table) and Play as DATA > QUESTS (modes as
// quests, the active one ticked). Both lists move with the arrow keys, as the Pip-Boy does;
// Enter stays the hint bar's Find match (pipboy.tsx), so setting a quest is its own button.
import { For, Index, type JSX, Show, createSignal, onCleanup, onMount } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { isEditing } from "~/studio/store";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, isMasteryShown, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./pipboyScreens.module.css";

/** Up and Down move the cursor while nothing else has the keys (a field, the Studio). */
function useArrowKeys(onStep: (step: 1 | -1) => void): void {
  const onKey = (event: KeyboardEvent) => {
    if (isEditing() || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    onStep(event.key === "ArrowDown" ? 1 : -1);
  };
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));
}

/** The item `step` places away from `current`, stopping at the ends of the list. */
function stepFrom<T>(items: readonly T[], current: T | undefined, step: 1 | -1): T | undefined {
  const at = current === undefined ? -1 : items.indexOf(current);
  return items[Math.min(items.length - 1, Math.max(0, at + step))];
}

function SubTabs<T extends string>(props: { options: readonly T[]; value: T; label: (value: T) => string; onPick: (value: T) => void }) {
  return (
    <nav class={styles.subTabs}>
      <For each={props.options}>
        {(option) => (
          <button data-on={props.value === option ? "" : undefined} onClick={() => props.onPick(option)}>
            {props.label(option)}
          </button>
        )}
      </For>
    </nav>
  );
}

function Row(props: { isPicked: boolean; mark?: JSX.Element; onPick: () => void; children: JSX.Element }) {
  return (
    <li>
      <button
        class={styles.row}
        data-picked={props.isPicked ? "" : undefined}
        ref={(element) => props.isPicked && queueMicrotask(() => element.scrollIntoView({ block: "nearest" }))}
        onMouseEnter={() => playCue("hover")}
        onClick={() => props.onPick()}
      >
        <span class={styles.cursor}>{props.isPicked ? "▶" : ""}</span>
        <span class={styles.label}>{props.children}</span>
        {props.mark}
      </button>
    </li>
  );
}

// ---- INV: agents ------------------------------------------------------------------------

function StatTable(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  return (
    <dl class={styles.table}>
      <div>
        <dt>Role</dt>
        <dd>{props.agent.role}</dd>
      </div>
      <Show when={props.isMasteryShown}>
        <div>
          <dt>Mastery</dt>
          <dd>{props.browser.mastery().lifetime}</dd>
        </div>
      </Show>
      <div>
        <dt>Status</dt>
        <dd>{props.browser.isOwned(props.agent) ? "Owned" : "Locked"}</dd>
      </div>
      <Index each={abilitySlots(props.agent)}>
        {(slot) => (
          <div
            class={styles.abilityRow}
            data-open={props.browser.tab() === slot().ability.slot ? "" : undefined}
            onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
          >
            <dt>{slot().key || "·"}</dt>
            <dd>{slot().ability.name}</dd>
          </div>
        )}
      </Index>
    </dl>
  );
}

export function PipAgents(props: PieceProps) {
  const browser = useAgentBrowser();
  useArrowKeys((step) => {
    const next = stepFrom(browser.shown(), browser.picked(), step);
    if (next) browser.pick(next);
  });
  return (
    <div class={styles.screen}>
      <SubTabs options={["all", ...ROLE_ORDER] as const} value={browser.role()} label={(role) => (role === "all" ? "All" : `${role}s`)} onPick={browser.filter} />
      <div class={styles.split}>
        <ol class={styles.list}>
          <For each={browser.shown()}>
            {(agent) => (
              <Row isPicked={browser.picked()?.uuid === agent.uuid} mark={browser.isOwned(agent) ? undefined : <span class={styles.mark}>Locked</span>} onPick={() => browser.pick(agent)}>
                {agent.display_name}
              </Row>
            )}
          </For>
        </ol>
        <Show when={browser.picked()}>
          {(agent) => (
            <section class={styles.detail}>
              <Art src={agent().portrait} class={styles.figure} fallback={<span class={styles.figure} />} />
              <StatTable agent={agent()} browser={browser} isMasteryShown={isMasteryShown(props)} />
              <p class={styles.text}>{browser.ability()?.description ?? agent().description}</p>
            </section>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---- DATA > QUESTS: modes ---------------------------------------------------------------

function Quest(props: { queue: QueueOption; play: ReturnType<typeof usePlay> }) {
  const isActive = () => props.play.current()?.id === props.queue.id;
  return (
    <section class={styles.detail}>
      <Art src={props.queue.art} class={styles.questArt} fallback={<span class={styles.questArt} />} />
      <h2 class={styles.questName}>{props.queue.label}</h2>
      <p class={styles.text}>{QUEUE_BLURBS[props.queue.id] ?? ""}</p>
      <ul class={styles.objectives}>
        <li data-done={isActive() ? "" : undefined}>Set as active quest</li>
        <li>Gather your party ({props.play.partySize()}/{props.play.maxSize()})</li>
        <li>Find a match</li>
      </ul>
      <button class={styles.action} disabled={isActive() || !props.play.isOwner()} onClick={() => props.play.pickQueue(props.queue)}>
        {isActive() ? "Active quest" : props.play.isOwner() ? "Set active" : "Party leader decides"}
      </button>
    </section>
  );
}

export function PipQuests(_props: PieceProps) {
  const play = usePlay();
  const [browsedId, setBrowsedId] = createSignal("");
  const shown = () => play.queues().find((queue) => queue.id === (browsedId() || play.current()?.id)) ?? play.current() ?? undefined;
  useArrowKeys((step) => {
    const next = stepFrom(play.queues(), shown(), step);
    if (next) {
      playCue("tab");
      setBrowsedId(next.id);
    }
  });
  return (
    <div class={styles.screen}>
      <SubTabs options={["quests"] as const} value="quests" label={() => "Quests"} onPick={() => undefined} />
      <div class={styles.split}>
        <ol class={styles.list}>
          <For each={play.queues()}>
            {(queue) => (
              <Row isPicked={shown()?.id === queue.id} mark={play.current()?.id === queue.id ? <span class={styles.mark}>■</span> : undefined} onPick={() => setBrowsedId(queue.id)}>
                {queue.label}
              </Row>
            )}
          </For>
        </ol>
        <Show when={shown()}>{(queue) => <Quest queue={queue()} play={play} />}</Show>
      </div>
    </div>
  );
}
