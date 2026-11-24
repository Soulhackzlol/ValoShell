// Glass agent select: the focused agent (hovered, else your pick) on a big frosted card, the
// roster as round avatars grouped by role, and a capsule LOCK IN. Picking and locking are the
// standard picker's own actions (state/pregame); locking happens only on the button's click.
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import { DoorOpen, Lock } from "lucide-solid";
import type { AgentCard } from "~/bindings/AgentCard";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { isAgentOwned } from "~/state/agents";
import { ROLE_ORDER, agentByUuid, agentColours, catalog } from "~/state/catalog";
import { pregame, pregameActions, timeLeft } from "~/state/pregame";
import { Art } from "~/ui/Art";
import { useConfirmPress } from "~/ui/confirmPress";
import { Empty } from "~/ui/controls";
import { ripple } from "./glassMotion";
import styles from "./glassPick.module.css";

const ICON_PX = 15;
const TICK_MS = 1000;

/** The roster by role in game order; agents of a role the game adds later go last as "Other". */
function rosterGroups(): { role: string; agents: AgentCard[] }[] {
  const known = ROLE_ORDER as readonly string[];
  const agents = catalog().agents;
  const groups = ROLE_ORDER.map((role): { role: string; agents: AgentCard[] } => ({
    role,
    agents: agents.filter((agent) => agent.role === role),
  }));
  groups.push({ role: "Other", agents: agents.filter((agent) => !known.includes(agent.role)) });
  return groups.filter((group) => group.agents.length > 0);
}

/** The agent's mid colour for the card's wash, else the theme accent. */
function tintOf(agent: AgentCard): string {
  const colors = agentColours(agent);
  return colors[1] ?? colors[0] ?? "var(--accent)";
}

function Hero(props: { agent: AgentCard | undefined; isLocked: boolean }) {
  return (
    <section class={styles.hero} data-part="spotlight" data-locked={props.isLocked ? "" : undefined}>
      <Show keyed when={props.agent} fallback={<p class={styles.prompt}>Choose your agent</p>}>
        {(agent) => (
          <div class={styles.heroStage} style={{ "--tint": tintOf(agent) }}>
            <Art src={agent.portrait} class={styles.portrait} fallback={<span />} />
            <div class={styles.heroText}>
              <span class={styles.role}>
                <Art src={agent.role_icon} fallback={null} />
                {agent.role}
              </span>
              <h2 class={styles.name}>{agent.display_name}</h2>
              <span class={styles.abilities}>
                <For each={agent.abilities}>
                  {(ability) => (
                    <Art src={ability.icon} alt={ability.name} fallback={<span>{ability.slot.slice(0, 1)}</span>} />
                  )}
                </For>
              </span>
            </div>
          </div>
        )}
      </Show>
    </section>
  );
}

interface TileState {
  own: () => string | null;
  isLocked: () => boolean;
  isTaken: (uuid: string) => boolean;
  hover: (uuid: string | null) => void;
}

function Avatar(props: { agent: AgentCard; state: TileState }) {
  const isOwned = () => isAgentOwned(props.agent.uuid);
  const isTaken = () => props.state.isTaken(props.agent.uuid);
  return (
    <button
      class={styles.avatar}
      data-part="agent-tile"
      data-own={props.state.own() === props.agent.uuid ? "" : undefined}
      data-taken={isTaken() ? "" : undefined}
      disabled={props.state.isLocked() || isTaken() || !isOwned()}
      title={isOwned() ? props.agent.display_name : `${props.agent.display_name} (not unlocked)`}
      onMouseEnter={() => {
        props.state.hover(props.agent.uuid);
        playCue("hover");
      }}
      onMouseLeave={() => props.state.hover(null)}
      onClick={() => void pregameActions.select(props.agent.uuid)}
    >
      <Art src={props.agent.icon} fallback={<span>{props.agent.display_name.slice(0, 2)}</span>} />
      <Show when={!isOwned()}>
        <Lock class={styles.lockMark ?? ""} size={12} />
      </Show>
    </button>
  );
}

function Actions(props: { own: string | null; isLocked: boolean; secondsLeft: number }) {
  const dodge = useConfirmPress(() => void pregameActions.dodge());
  return (
    <footer class={styles.actions}>
      <button
        class={styles.dodge}
        disabled={props.isLocked}
        title="Leave this match (dodge penalty applies)"
        data-armed={dodge.isArmed() ? "" : undefined}
        onClick={() => dodge.press()}
      >
        <DoorOpen size={ICON_PX} /> {dodge.isArmed() ? "Click again to dodge" : "Dodge"}
      </button>
      <span class={`${styles.timer} num`}>{Math.ceil(props.secondsLeft)}</span>
      <button
        ref={(element) => ripple(element, styles.ripple ?? "")}
        class={styles.lock}
        data-part="lock"
        data-locked={props.isLocked ? "" : undefined}
        disabled={props.isLocked || !props.own}
        onClick={() => {
          if (props.own) void pregameActions.lock(props.own);
        }}
      >
        {props.isLocked ? "Locked in" : "Lock in"}
      </button>
    </footer>
  );
}

export function GlassPick(_props: PieceProps) {
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
  onCleanup(() => window.clearInterval(timer));
  const taken = createMemo(() => new Set(pregame()?.taken_agents ?? []));
  const state: TileState = {
    own: () => pregame()?.own_agent_uuid ?? null,
    isLocked: () => pregame()?.is_own_locked ?? false,
    isTaken: (uuid) => taken().has(uuid),
    hover: setHovered,
  };
  return (
    <Show when={pregame()} fallback={<Empty title="Agent select">Your roster appears in agent select.</Empty>}>
      {(view) => (
        <div class={styles.pick} data-part="screen-board">
          <Hero agent={agentByUuid(hovered() ?? state.own())} isLocked={state.isLocked()} />
          <div class={styles.roster}>
            <For each={rosterGroups()}>
              {(group) => (
                <div class={styles.group}>
                  <span class={styles.groupLabel}>{group.role}</span>
                  <div class={styles.avatars}>
                    <For each={group.agents}>{(agent) => <Avatar agent={agent} state={state} />}</For>
                  </div>
                </div>
              )}
            </For>
          </div>
          <Actions own={state.own()} isLocked={state.isLocked()} secondsLeft={timeLeft(view(), now())} />
        </div>
      )}
    </Show>
  );
}
