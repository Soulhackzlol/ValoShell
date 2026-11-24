// The agent picker: a spotlight on the hovered (or picked) agent, the roster grouped by role,
// and LOCK IN. Its layouts (Spotlight, Split, Grid, Showcase, Roles, Cards) are CSS only, so the
// markup carries everything any of them may show: the agent's tint, art, abilities and role names.
import { For, Show, createMemo, createSignal, type JSX } from "solid-js";
import { DoorOpen } from "lucide-solid";
import type { AgentCard } from "~/bindings/AgentCard";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { isAgentOwned } from "~/state/agents";
import { ROLE_ORDER, agentByUuid, agentColours, catalog } from "~/state/catalog";
import { pregame, pregameActions } from "~/state/pregame";
import { Empty, controls } from "~/ui/controls";
import { Art } from "~/ui/Art";
import { useConfirmPress } from "~/ui/confirmPress";
import { cssUrl } from "./pregame";
import styles from "./agentPicker.module.css";

/** The known roles in game order, then "" for any role the game adds later. */
const ROLE_GROUPS = [...ROLE_ORDER, ""];
const DODGE_ICON_PX = 14;

/** The catalog's agents of `role`, or, for "", those whose role is not one of the known four. */
function agentsInRole(role: string): AgentCard[] {
  const known = ROLE_ORDER as readonly string[];
  return catalog().agents.filter((agent) => (role ? agent.role === role : !known.includes(agent.role)));
}

/** The agent's own colours as CSS variables (spotlight glow, card wash); unset ones fall back. */
function agentTint(agent: AgentCard): JSX.CSSProperties {
  const colors = agentColours(agent);
  const style: JSX.CSSProperties = {};
  const mid = colors[1] ?? colors[0];
  const deep = colors[colors.length - 1];
  if (mid) style["--tint"] = mid;
  if (deep) style["--tint-deep"] = deep;
  return style;
}

interface PickerState {
  own: () => string | null;
  isLocked: () => boolean;
  isTaken: (uuid: string) => boolean;
  /** Each agent's place in the whole roster, so tiles deal in one after another across roles. */
  order: () => Map<string, number>;
  hover: (uuid: string | null) => void;
}

function Abilities(props: { agent: AgentCard }) {
  return (
    <span class={styles.abilities}>
      <For each={props.agent.abilities}>
        {(ability, index) => (
          <span class={styles.ability} style={{ "--stagger": index() }} title={ability.name}>
            <Art src={ability.icon} alt={ability.name} fallback={<span>{ability.slot.slice(0, 1)}</span>} />
          </span>
        )}
      </For>
    </span>
  );
}

/** Keyed on the agent, so each new focus mounts fresh and plays its entrance again. */
function Spotlight(props: { agent: AgentCard | undefined; isLocked: boolean }) {
  return (
    <div class={styles.spotlight} data-part="spotlight" data-locked={props.isLocked ? "" : undefined}>
      <Show keyed when={props.agent} fallback={<span class={styles.spotlightPrompt}>Choose your agent</span>}>
        {(agent) => (
          <div class={styles.stage} style={agentTint(agent)}>
            <span class={styles.ghost} aria-hidden="true">
              {agent.display_name}
            </span>
            <div
              class={styles.portrait}
              style={{ "--portrait": cssUrl(agent.portrait), "--agent-bg": cssUrl(agent.background) }}
            />
            <div class={styles.caption}>
              <span class={styles.spotlightRole}>
                <Art src={agent.role_icon} fallback={null} />
                {agent.role}
              </span>
              <span class={styles.spotlightName}>{agent.display_name}</span>
              <Abilities agent={agent} />
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

function AgentTile(props: { agent: AgentCard; picker: PickerState }) {
  const agent = props.agent;
  const isOwned = () => isAgentOwned(agent.uuid);
  return (
    <button
      class={styles.agent}
      data-part="agent-tile"
      data-own={props.picker.own() === agent.uuid ? "" : undefined}
      data-unowned={isOwned() ? undefined : ""}
      disabled={props.picker.isLocked() || props.picker.isTaken(agent.uuid) || !isOwned()}
      title={isOwned() ? agent.display_name : `${agent.display_name} (not unlocked)`}
      style={{
        ...agentTint(agent),
        "--stagger": props.picker.order().get(agent.uuid) ?? 0,
        "--agent-art": cssUrl(agent.portrait),
      }}
      onMouseEnter={() => {
        props.picker.hover(agent.uuid);
        playCue("hover");
      }}
      onMouseLeave={() => props.picker.hover(null)}
      onClick={() => void pregameActions.select(agent.uuid)}
    >
      <Art src={agent.icon} fallback={<span>{agent.display_name.slice(0, 2)}</span>} />
      <span class={styles.tileName}>{agent.display_name}</span>
    </button>
  );
}

function RoleGroup(props: { role: string; picker: PickerState }) {
  const agents = () => agentsInRole(props.role);
  return (
    <Show when={agents().length > 0}>
      <div class={styles.roleGroup} data-role={props.role || "other"}>
        <span class={styles.roleLabel}>
          <Art src={agents()[0]?.role_icon} fallback={null} />
          {props.role || "Other"}
        </span>
        <For each={agents()}>{(agent) => <AgentTile agent={agent} picker={props.picker} />}</For>
      </div>
    </Show>
  );
}

function LockBar(props: { isLocked: boolean; own: string | null }) {
  const dodge = useConfirmPress(() => void pregameActions.dodge());
  return (
    <div class={styles.actions}>
      <button
        class={`${controls.button} ${controls.ghost} ${controls.small}`}
        disabled={props.isLocked}
        title="Leave this match (dodge penalty applies)"
        data-armed={dodge.isArmed() ? "" : undefined}
        onClick={() => dodge.press()}
      >
        <DoorOpen size={DODGE_ICON_PX} /> {dodge.isArmed() ? "Click again to dodge" : "Dodge"}
      </button>
      <button
        class={styles.lock}
        data-part="lock"
        data-locked={props.isLocked ? "" : undefined}
        disabled={props.isLocked || !props.own}
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          if (props.own) void pregameActions.lock(props.own);
        }}
      >
        {props.isLocked ? "Locked in" : "Lock in"}
      </button>
    </div>
  );
}

export function AgentPicker(_props: PieceProps) {
  const [hovered, setHovered] = createSignal<string | null>(null);
  const taken = createMemo(() => new Set(pregame()?.taken_agents ?? []));
  const order = createMemo(
    () => new Map(ROLE_GROUPS.flatMap(agentsInRole).map((agent, index) => [agent.uuid, index] as const)),
  );
  const picker: PickerState = {
    own: () => pregame()?.own_agent_uuid ?? null,
    isLocked: () => pregame()?.is_own_locked ?? false,
    isTaken: (uuid) => taken().has(uuid),
    order,
    hover: setHovered,
  };
  return (
    <Show when={pregame()} fallback={<Empty title="Agent picker">Your roster appears in agent select.</Empty>}>
      <div class={styles.picker} data-part="screen-board">
        <Spotlight agent={agentByUuid(hovered() ?? picker.own())} isLocked={picker.isLocked()} />
        <div class={styles.grid}>
          <For each={ROLE_GROUPS}>{(role) => <RoleGroup role={role} picker={picker} />}</For>
        </div>
        <LockBar isLocked={picker.isLocked()} own={picker.own()} />
      </div>
    </Show>
  );
}
