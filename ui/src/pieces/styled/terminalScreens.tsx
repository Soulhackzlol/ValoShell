// Terminal's own screens: Agents, Play and the party as console output you can click.
// `agents --list` prints the roster as a table (role switches as flags) and `agent show` the
// picked one; `queue --list` prints the modes and `queue set` takes the picked one; `party
// --watch` prints the party htop-style. A cursor blinks after the last prompt.
import { For, Index, Show, createSignal } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { MemberView } from "~/bindings/MemberView";
import type { QueueOption } from "~/bindings/QueueOption";
import { playCue } from "~/menu/sound";
import { ROLE_ORDER } from "~/state/catalog";
import { setDrawerOpen } from "~/state/friends";
import { party } from "~/state/party";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { type AgentBrowser, INFO_TAB, abilitySlots, isMasteryShown, useAgentBrowser } from "../agentBrowser";
import { QUEUE_BLURBS } from "../play";
import { usePlay } from "./usePlay";
import styles from "./terminalScreens.module.css";

const PROMPT = "valoshell@valorant:~$ ";
const NAME_COLUMN = 14;
const ROLE_COLUMN = 12;

export const pad = (text: string, width: number) => text.toLowerCase().padEnd(width, " ").slice(0, width);
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function Prompt(props: { command: string; isLast?: boolean }) {
  return (
    <div class={styles.prompt}>
      {PROMPT}
      <b>{props.command}</b>
      <Show when={props.isLast}>
        <span class={styles.caret} aria-hidden="true" />
      </Show>
    </div>
  );
}

// ---- agents -----------------------------------------------------------------------------

function RoleFlags(props: { browser: AgentBrowser }) {
  return (
    <div class={styles.flags}>
      <For each={["all", ...ROLE_ORDER] as const}>
        {(role) => (
          <button class={styles.flag} data-on={props.browser.role() === role ? "" : undefined} onClick={() => props.browser.filter(role)}>
            --role={role.toLowerCase()}
          </button>
        )}
      </For>
    </div>
  );
}

function AgentLine(props: { agent: AgentCard; index: number; browser: AgentBrowser }) {
  const isPicked = () => props.browser.picked()?.uuid === props.agent.uuid;
  return (
    <button class={styles.line} data-on={isPicked() ? "" : undefined} onMouseEnter={() => playCue("hover")} onClick={() => props.browser.pick(props.agent)}>
      {`${isPicked() ? ">" : " "} ${String(props.index + 1).padStart(2, "0")}  ${pad(props.agent.display_name, NAME_COLUMN)}${pad(props.agent.role, ROLE_COLUMN)}${props.browser.isOwned(props.agent) ? "ok" : "locked"}`}
    </button>
  );
}

function AgentShow(props: { agent: AgentCard; browser: AgentBrowser; isMasteryShown: boolean }) {
  const mastery = () => (props.isMasteryShown ? `mastery  ${props.browser.mastery().lifetime}\n` : "");
  return (
    <>
      <Prompt command={`agent show ${slug(props.agent.display_name)}`} />
      <div class={styles.show}>
        <Art src={props.agent.portrait} class={styles.portrait} fallback={<span class={styles.portrait} />} />
        <pre class={styles.kv}>
          {`name     ${props.agent.display_name}\nrole     ${props.agent.role.toLowerCase()}\n${mastery()}status   ${props.browser.isOwned(props.agent) ? "owned" : "locked"}`}
        </pre>
      </div>
      <div class={styles.dim}>abilities:</div>
      <Index each={abilitySlots(props.agent)}>
        {(slot) => (
          <button
            class={styles.line}
            data-on={props.browser.tab() === slot().ability.slot ? "" : undefined}
            onClick={() => props.browser.openTab(props.browser.tab() === slot().ability.slot ? INFO_TAB : slot().ability.slot)}
          >
            {`  [${slot().key || "?"}] ${slot().ability.name}${slot().isUltimate ? "  (ultimate)" : ""}`}
          </button>
        )}
      </Index>
      <p class={styles.out}>{props.browser.ability()?.description ?? props.agent.description}</p>
      <Prompt command="" isLast />
    </>
  );
}

export function TerminalAgents(props: PieceProps) {
  const browser = useAgentBrowser();
  return (
    <div class={styles.console}>
      <section class={styles.pane}>
        <Prompt command={`agents --list --role=${browser.role().toLowerCase()}${browser.isOwnedOnly() ? " --owned" : ""}`} />
        <RoleFlags browser={browser} />
        <button class={styles.flag} data-on={browser.isOwnedOnly() ? "" : undefined} onClick={browser.toggleOwned}>
          --owned
        </button>
        <div class={styles.dim}>{`   #   ${pad("name", NAME_COLUMN)}${pad("role", ROLE_COLUMN)}status`}</div>
        <div class={styles.table}>
          <For each={browser.shown()}>{(agent, index) => <AgentLine agent={agent} index={index()} browser={browser} />}</For>
        </div>
        <div class={styles.dim}>{`${browser.shown().length} agents`}</div>
      </section>
      <section class={styles.pane}>
        <Show when={browser.picked()}>{(agent) => <AgentShow agent={agent()} browser={browser} isMasteryShown={isMasteryShown(props)} />}</Show>
      </section>
    </div>
  );
}

// ---- queue ------------------------------------------------------------------------------

function QueueLine(props: { queue: QueueOption; isPicked: boolean; isActive: boolean; onPick: () => void }) {
  return (
    <button class={styles.line} data-on={props.isPicked ? "" : undefined} onMouseEnter={() => playCue("hover")} onClick={() => props.onPick()}>
      {`${props.isPicked ? ">" : " "} ${props.isActive ? "*" : " "} ${pad(props.queue.id, NAME_COLUMN)}${props.queue.label}`}
    </button>
  );
}

export function TerminalQueue(_props: PieceProps) {
  const play = usePlay();
  const [browsedId, setBrowsedId] = createSignal("");
  const shown = () => play.queues().find((queue) => queue.id === (browsedId() || play.current()?.id)) ?? play.current() ?? undefined;
  const isActive = () => play.current()?.id === shown()?.id;
  return (
    <div class={styles.console} data-single="">
      <section class={styles.pane}>
        {/* Two halves that only the split layout lays out as columns; elsewhere they flow as one. */}
        <div class={styles.half}>
          <Prompt command="queue --list" />
          <div class={styles.dim}>{`    ${pad("id", NAME_COLUMN)}mode`}</div>
          <div class={styles.table}>
            <For each={play.queues()}>
              {(queue) => (
                <QueueLine queue={queue} isPicked={shown()?.id === queue.id} isActive={play.current()?.id === queue.id} onPick={() => setBrowsedId(queue.id)} />
              )}
            </For>
          </div>
          <div class={styles.dim}>* = active · party {play.partySize()}/{play.maxSize()}</div>
        </div>
        <div class={styles.half}>
          <Show when={shown()}>
            {(queue) => (
              <>
                <Prompt command={`queue info ${queue().id}`} />
                <p class={styles.out} data-row="blurb">
                  {QUEUE_BLURBS[queue().id] ?? "no description"}
                </p>
                <button class={styles.run} disabled={isActive() || !play.isOwner()} onClick={() => play.pickQueue(queue())}>
                  {isActive() ? `queue: ${queue().id} is already active` : play.isOwner() ? `run: queue set ${queue().id}` : "queue: only the party owner can set this"}
                </button>
              </>
            )}
          </Show>
          <Prompt command="" isLast />
        </div>
      </section>
    </div>
  );
}

// ---- party ------------------------------------------------------------------------------

const PARTY_NAME_COLUMN = 18;
const PARTY_RANK_COLUMN = 13;
const METER_WIDTH = 20;

/** htop's meter: `[|||||||||       3/5]`, filled by how full the party is. */
function partyMeter(size: number, max: number): string {
  const filled = Math.round((size / Math.max(1, max)) * METER_WIDTH);
  return `[${"|".repeat(filled)}${" ".repeat(METER_WIDTH - filled)}${size}/${max}]`;
}

function MemberLine(props: { member: MemberView; slot: number }) {
  const state = () => (props.member.is_ready ? "ready" : "not-ready");
  const level = () => (props.member.account_level === null ? "-" : `${props.member.account_level}`);
  const ping = () => (props.member.ping_ms === null ? "-" : `${props.member.ping_ms}ms`);
  return (
    <div class={styles.line} data-on={props.member.is_self ? "" : undefined}>
      {`${props.slot}  ${props.member.is_owner ? "*" : " "} `}
      <span data-sensitive>{pad(`${props.member.game_name}#${props.member.tag_line}`, PARTY_NAME_COLUMN)}</span>
      {/* The detail columns, which the brief layouts leave out. */}
      <span data-col="">{`${pad(props.member.rank.name || "unranked", PARTY_RANK_COLUMN)}${level().padEnd(5)}${ping().padEnd(7)}`}</span>
      <b data-state={state()}>{state()}</b>
    </div>
  );
}

/** The party as `party --watch` prints it, htop-style: a fill meter, one line per member, and an
 *  `invite` on each empty slot that opens the friends list. */
export function TerminalParty(_props: PieceProps) {
  const empty = () => {
    const view = party();
    return view ? Array.from({ length: Math.max(0, view.max_size - view.members.length) }, (_, index) => view.members.length + index + 1) : [];
  };
  return (
    <div class={styles.console} data-single="">
      <section class={styles.pane}>
        <Prompt command="party --watch" />
        <Show when={party()} fallback={<p class={styles.out}>party: not connected to the riot client</p>}>
          {(view) => (
            <>
              <div class={styles.out}>
                {`party  ${partyMeter(view().members.length, view().max_size)}  ${view().queue.id}  ${view().is_open ? "open" : "closed"}`}
              </div>
              <div class={styles.dim} data-row="head">
                {`#  o ${pad("name", PARTY_NAME_COLUMN)}`}
                <span data-col="">{`${pad("rank", PARTY_RANK_COLUMN)}lvl  ping   `}</span>
                state
              </div>
              <div class={styles.table}>
                <For each={view().members}>{(member, index) => <MemberLine member={member} slot={index() + 1} />}</For>
                <For each={empty()}>
                  {(slot) => (
                    <button class={styles.line} onMouseEnter={() => playCue("hover")} onClick={() => setDrawerOpen(true)}>
                      {`${slot}    ${pad("-- empty --", PARTY_NAME_COLUMN)}`}
                      <b>[ invite ]</b>
                    </button>
                  )}
                </For>
              </div>
              <div class={styles.dim} data-row="legend">
                o = owner · your line is highlighted
              </div>
            </>
          )}
        </Show>
        <Prompt command="" isLast />
      </section>
    </div>
  );
}
