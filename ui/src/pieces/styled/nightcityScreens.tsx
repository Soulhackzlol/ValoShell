// Night City's own screens, after Cyberpunk 2077's menus: Agents as a merc database (a data list
// on the left, the agent as a red and cyan hologram, a dossier with their cyberware) and Gigs as
// a fixer's job board (contracts in a list, the picked one opened with its art).
import { For, Index, Show, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { ROLE_BLURB, type AgentBrowser, INFO_TAB, abilitySlots, isMasteryShown, roleOf, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./nightcityScreens.module.css";
import holo from "./nightcityHolo.module.css";

const hex = (index: number) => `0x${(index + 1).toString(16).toUpperCase().padStart(2, "0")}`;

// ---- merc database ----------------------------------------------------------------------

function MercRow(props: { agent: AgentCard; index: number; browser: AgentBrowser }) {
  const isPicked = () => props.browser.picked()?.uuid === props.agent.uuid;
  const isOwned = () => props.browser.isOwned(props.agent);
  return (
    <li>
      <button
        class={styles.merc}
        data-picked={isPicked() ? "" : undefined}
        style={{ "--i": props.index }}
        onMouseEnter={() => playCue("hover")}
        onClick={() => props.browser.pick(props.agent)}
      >
        <span class={styles.code}>{hex(props.index)}</span>
        <Art src={props.agent.icon} class={styles.mercIcon} fallback={<span class={styles.mercIcon} />} />
        <span class={styles.mercName}>{props.agent.display_name}</span>
        <span class={styles.status} data-locked={isOwned() ? undefined : ""}>
          {isOwned() ? "Owned" : "Locked"}
        </span>
      </button>
    </li>
  );
}

function MercList(props: { browser: AgentBrowser }) {
  return (
    <section class={styles.list}>
      <header class={styles.head}>
        <span class={styles.code}>NET//MERC_INDEX</span>
        <span class={styles.title}>Database</span>
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
      <ol class={styles.rows}>
        <For each={props.browser.shown()}>{(agent, index) => <MercRow agent={agent} index={index()} browser={props.browser} />}</For>
      </ol>
      <button class={styles.owned} role="switch" aria-checked={props.browser.isOwnedOnly()} onClick={props.browser.toggleOwned}>
        <i data-on={props.browser.isOwnedOnly() ? "" : undefined} /> Owned only
      </button>
    </section>
  );
}

/** The agent as a hologram: their portrait washed red with cyan fringes, a scan sweeping it. */
function Hologram(props: { agent: AgentCard }) {
  return (
    <div class={holo.holo}>
      <span class={holo.reticle} aria-hidden="true" />
      <Show when={props.agent.portrait}>
        {(portrait) => (
          <div class={holo.figure} style={{ "--portrait": `url("${portrait()}")` }}>
            <img src={portrait()} alt="" draggable={false} />
          </div>
        )}
      </Show>
      <span class={styles.scan} aria-hidden="true" />
      <span class={holo.holoTag}>SUBJECT // {props.agent.upper_name}</span>
    </div>
  );
}

function Cyberware(props: { agent: AgentCard; browser: AgentBrowser }) {
  return (
    <ol class={styles.ware}>
      <Index each={abilitySlots(props.agent)}>
        {(slot) => (
          <li>
            <button
              class={styles.slot}
              data-open={props.browser.tab() === slot().ability.slot ? "" : undefined}
              data-ult={slot().isUltimate ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
            >
              <kbd>{slot().key || "·"}</kbd>
              <Art src={slot().ability.icon} class={styles.wareIcon} fallback={<span class={styles.wareIcon} />} />
              <span>{slot().ability.name}</span>
            </button>
          </li>
        )}
      </Index>
    </ol>
  );
}

function Dossier(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  const roleLine = () => {
    const role = roleOf(props.agent);
    return role ? ROLE_BLURB[role] : "";
  };
  return (
    <section class={styles.dossier}>
      <span class={styles.code}>DOSSIER // CLASS: {props.agent.role.toUpperCase()}</span>
      <h2 class={styles.name}>{props.agent.display_name}</h2>
      <dl class={styles.facts}>
        <Show when={props.isMasteryShown}>
          <div>
            <dt>Threat lvl</dt>
            <dd>{props.browser.mastery().lifetime}</dd>
          </div>
        </Show>
        <div>
          <dt>Status</dt>
          <dd data-locked={props.browser.isOwned(props.agent) ? undefined : ""}>{props.browser.isOwned(props.agent) ? "Contracted" : "Unavailable"}</dd>
        </div>
      </dl>
      <span class={styles.code}>CYBERWARE</span>
      <Cyberware agent={props.agent} browser={props.browser} />
      <div class={styles.readout}>
        <Show when={props.browser.ability()} fallback={<p>{props.agent.description || roleLine()}</p>}>
          {(ability) => (
            <>
              <b>{ability().name}</b>
              <p>{ability().description}</p>
            </>
          )}
        </Show>
      </div>
    </section>
  );
}

export function NcAgents(props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.db}>
      <MercList browser={browser} />
      <Show when={browser.picked()}>
        {(agent) => (
          <>
            <Hologram agent={agent()} />
            <Dossier agent={agent()} browser={browser} isMasteryShown={isMasteryShown(props)} />
          </>
        )}
      </Show>
    </div>
  );
}

// ---- job board --------------------------------------------------------------------------

/** How risky each job reads on the board: what is on the line in that mode. */
const RISK: Record<string, string> = {
  competitive: "High // RR on the line",
  premier: "High // team rating",
  unrated: "Medium",
  hurm: "Medium",
  swiftplay: "Low",
  spikerush: "Low",
  ggteam: "Low",
  onefa: "Low",
  deathmatch: "Solo job",
  snowball: "None",
};

function GigRow(props: { queue: QueueOption; index: number; isPicked: boolean; isActive: boolean; onPick: () => void }) {
  return (
    <li>
      <button class={styles.gig} data-picked={props.isPicked ? "" : undefined} style={{ "--i": props.index }} onMouseEnter={() => playCue("hover")} onClick={() => props.onPick()}>
        <span class={styles.code}>GIG {hex(props.index)}</span>
        <span class={styles.gigName}>{props.queue.label}</span>
        <Show when={props.isActive}>
          <span class={styles.status}>Active</span>
        </Show>
      </button>
    </li>
  );
}

export function NcGigs(_props: PieceProps) {
  const play = usePlay();
  // The contract being read; until one is picked, the mode the party is on.
  const [browsedId, setBrowsedId] = createSignal("");
  const shown = () => play.queues().find((queue) => queue.id === (browsedId() || play.current()?.id)) ?? play.current() ?? undefined;
  return <JobBoard play={play} shown={shown} onBrowse={setBrowsedId} />;
}

function JobBoard(props: { play: ReturnType<typeof usePlay>; shown: () => QueueOption | undefined; onBrowse: (id: string) => void }) {
  return (
    <div class={styles.board}>
      <section class={styles.list}>
        <header class={styles.head}>
          <span class={styles.code}>FIXER // OPEN CONTRACTS</span>
          <span class={styles.title}>Gigs</span>
        </header>
        <ol class={styles.rows}>
          <For each={props.play.queues()}>
            {(queue, index) => (
              <GigRow
                queue={queue}
                index={index()}
                isPicked={props.shown()?.id === queue.id}
                isActive={props.play.current()?.id === queue.id}
                onPick={() => props.onBrowse(queue.id)}
              />
            )}
          </For>
        </ol>
      </section>
      <Show when={props.shown()}>{(queue) => <Contract queue={queue()} play={props.play} />}</Show>
    </div>
  );
}

function Contract(props: { queue: QueueOption; play: ReturnType<typeof usePlay> }) {
  const isActive = () => props.play.current()?.id === props.queue.id;
  return (
    <section class={styles.contract}>
      <div class={styles.contractArt}>
        <Art src={props.queue.art} class={styles.contractImage} fallback={<span class={styles.contractImage} />} />
        <span class={styles.scan} aria-hidden="true" />
      </div>
      <span class={styles.code}>CONTRACT // {props.queue.id.toUpperCase()}</span>
      <h2 class={styles.name}>{props.queue.label}</h2>
      <p class={styles.brief}>{QUEUE_BLURBS[props.queue.id] ?? "A job like any other."}</p>
      <dl class={styles.facts}>
        <div>
          <dt>Risk</dt>
          <dd>{RISK[props.queue.id] ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Crew</dt>
          <dd>
            {props.play.partySize()}/{props.play.maxSize()}
          </dd>
        </div>
      </dl>
      <button class={styles.accept} data-active={isActive() ? "" : undefined} disabled={isActive() || !props.play.isOwner()} onClick={() => props.play.pickQueue(props.queue)}>
        {isActive() ? "Contract active" : props.play.isOwner() ? "Accept gig" : "Your fixer picks"}
      </button>
    </section>
  );
}
