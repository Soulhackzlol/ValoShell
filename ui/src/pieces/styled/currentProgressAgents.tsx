// The Progress page's agent objectives from the real progress: the running recruitment event
// (agent, XP towards the unlock, days left) and the agent contracts with the most levels.
// Shares the objective tiles' look (currentProgress.module.css); adds only the bar and list.
import { For, Show } from "solid-js";
import type { ProgressView } from "~/bindings/ProgressView";
import type { RecruitmentView } from "~/bindings/RecruitmentView";
import { Art } from "~/ui/Art";
import { groupNumber, vt } from "./valText";
import styles from "./currentProgress.module.css";
import own from "./currentProgressAgents.module.css";

const DAY_MS = 86_400_000;
const SHOWN_CONTRACTS = 3;

function daysUntil(endsAt: string | null, now: number): number | null {
  const at = Date.parse(endsAt ?? "");
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / DAY_MS));
}

function RecruitmentEvent(props: { event: RecruitmentView; now: number }) {
  const percent = (goal: number) => Math.min(100, (props.event.xp / Math.max(1, goal)) * 100);
  return (
    <div class={styles.objective}>
      <b>
        {vt("recruit")} {props.event.agent_name}
      </b>
      <small>
        {groupNumber(props.event.xp)}
        <Show when={props.event.xp_goal}>{(goal) => <> / {groupNumber(goal())}</>}</Show> {vt("xp")}
      </small>
      <Show when={props.event.xp_goal}>
        {(goal) => (
          <span class={own.bar}>
            <i style={{ width: `${percent(goal())}%` }} />
          </span>
        )}
      </Show>
      <Show when={daysUntil(props.event.ends_at, props.now)}>
        {(days) => (
          <small>
            {vt("endsIn")} {days()} {vt("days")}
          </small>
        )}
      </Show>
      <span class={styles.objectiveIcon}>
        <Art src={props.event.agent_icon} class={own.icon} fallback={<span />} />
      </span>
    </div>
  );
}

function Recruitment(props: { view: ProgressView; now: number }) {
  return (
    <Show
      when={props.view.recruitment}
      fallback={
        <div class={styles.objective} data-locked="">
          <b>{vt("recruitment")}</b>
          <small>{vt("noRecruitment")}</small>
        </div>
      }
    >
      {(event) => <RecruitmentEvent event={event()} now={props.now} />}
    </Show>
  );
}

function Contracts(props: { view: ProgressView }) {
  const shown = () =>
    [...props.view.agent_contracts].sort((first, second) => second.level - first.level).slice(0, SHOWN_CONTRACTS);
  return (
    <div
      class={styles.objective}
      data-locked={shown().length === 0 ? "" : undefined}
    >
      <b>{vt("agentContracts")}</b>
      <Show
        when={shown().length > 0}
        fallback={<small>{vt("noContracts")}</small>}
      >
        <ul class={own.list}>
          <For each={shown()}>
            {(contract) => (
              <li>
                <Art
                  src={contract.agent_icon}
                  class={own.small}
                  fallback={<span />}
                />
                <span>{contract.agent_name}</span>
                <b>
                  {contract.level} / {contract.level_count}
                </b>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

/** The two agent tiles beside the battle pass objective. */
export function AgentObjectives(props: { view: ProgressView; now: number }) {
  return (
    <>
      <Recruitment view={props.view} now={props.now} />
      <Contracts view={props.view} />
    </>
  );
}
