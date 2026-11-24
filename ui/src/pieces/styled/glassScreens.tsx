// Glass progress and party chat. Progress shows the real battle pass and missions (state/views,
// the standard Progress page's source) as a frosted pass card beside rounded mission rows. The
// chat line is the standard one's capsule, sending to party chat (chatLine.ts).
import { For, Show, onMount } from "solid-js";
import { MessageSquare } from "lucide-solid";
import type { BattlePassView } from "~/bindings/BattlePassView";
import type { MissionView } from "~/bindings/MissionView";
import type { PieceProps } from "~/studio/registry";
import { progressView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { ChatFrame, ChatUnread } from "./chatFrame";
import { useChatLine } from "./chatLine";
import { textProp } from "./current";
import { vt } from "./valText";
import { daysLeft, fillOf } from "./screenData";
import styles from "./glassScreens.module.css";

const CHAT_ICON_PX = 15;

function PassCard(props: { pass: BattlePassView }) {
  const days = () => daysLeft(props.pass);
  return (
    <section class={styles.pass}>
      <span class={styles.kicker}>{props.pass.name}</span>
      <Art src={props.pass.next_reward?.image} class={styles.reward} fallback={<span class={styles.reward} />} />
      <b class={styles.rewardName}>{props.pass.next_reward?.name ?? "Every tier done"}</b>
      <div class={styles.tierLine}>
        <span class="num">
          Tier {props.pass.tier} / {props.pass.tier_count}
        </span>
        <span class="num">{props.pass.xp_left.toLocaleString()} XP to go</span>
      </div>
      <span class={styles.bar}>
        <i style={{ "--fill": fillOf(props.pass.tier, props.pass.tier_count) }} />
      </span>
      <Show when={days() !== null}>
        <small class={styles.note}>Ends in {days()} days</small>
      </Show>
    </section>
  );
}

function MissionList(props: { title: string; missions: MissionView[] }) {
  return (
    <Show when={props.missions.length > 0}>
      <section class={styles.missions}>
        <h3 class={styles.kicker}>{props.title}</h3>
        <For each={props.missions}>
          {(mission, index) => (
            <div class={styles.mission} data-done={mission.is_complete ? "" : undefined} style={{ "--i": index() }}>
              <span class={styles.missionHead}>
                <b>{mission.title}</b>
                <small class="num">+{mission.xp.toLocaleString()} XP</small>
              </span>
              <span class={styles.bar}>
                <i style={{ "--fill": fillOf(mission.done, mission.goal) }} />
              </span>
              <small class={`${styles.note} num`}>
                {mission.done.toLocaleString()} / {mission.goal.toLocaleString()}
              </small>
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}

export function GlassProgress(_props: PieceProps) {
  onMount(() => {
    if (!progressView.value() && !progressView.isLoading()) void progressView.load();
  });
  const empty = () =>
    progressView.isLoading() ? "Loading your progress…" : "Your progress shows once VALORANT is open.";
  return (
    <Show when={progressView.value()} fallback={<Empty title="Progress">{empty()}</Empty>}>
      {(view) => (
        <div class={styles.progress}>
          <Show when={view().battle_pass}>{(pass) => <PassCard pass={pass()} />}</Show>
          <div class={styles.lists}>
            <MissionList title="Daily" missions={view().daily_missions} />
            <MissionList title="Weekly" missions={view().weekly_missions} />
          </div>
        </div>
      )}
    </Show>
  );
}

export function GlassChat(props: PieceProps) {
  const line = useChatLine();
  return (
    <ChatFrame line={line}>
      <form
        class={styles.chat}
        data-sending={line.isSending() ? "" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          line.submit();
        }}
      >
        <span class={styles.chatLabel}>{textProp(props, "label", "partyChat")}</span>
        <input
          value={line.text()}
          spellcheck={false}
          disabled={!line.canSend()}
          onInput={(event) => line.onInput(event.currentTarget.value)}
          onKeyDown={(event) => line.onKeyDown(event)}
          placeholder={line.placeholder(vt("saySomething"), vt("chatClosed"))}
        />
        <button
          type="button"
          data-part="chat-open"
          class={styles.chatOpen}
          title={vt("openChat")}
          aria-label={vt("openChat")}
          onClick={() => line.openChat()}
        >
          <MessageSquare class={styles.chatIcon ?? ""} size={CHAT_ICON_PX} />
          <ChatUnread line={line} />
        </button>
      </form>
    </ChatFrame>
  );
}
