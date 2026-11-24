// Play pieces: every eligible queue as a tall card on its own art (as the client's mode list
// draws them), and the party tools (open or closed, party code, join by code, invite, leave).
import { Index, Show, createSignal } from "solid-js";
import { Copy, DoorOpen, Lock, LockOpen, Ticket, UserPlus } from "lucide-solid";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { isPartyBusy, party, partyActions } from "~/state/party";
import { copyPartyCode } from "~/state/partyCode";
import { Art } from "~/ui/Art";
import { Empty, controls } from "~/ui/controls";
import { connection, connectionLine } from "~/state/session";
import styles from "./play.module.css";

export const QUEUE_BLURBS: Record<string, string> = {
  unrated: "Standard 13-round match, no rank on the line.",
  competitive: "Ranked. Win to climb.",
  swiftplay: "Short 5-round matches.",
  spikerush: "Fast rounds, random weapons, orbs.",
  deathmatch: "Free-for-all warmup.",
  hurm: "Team deathmatch, respawns and loadouts.",
  ggteam: "Escalation: weapons change as you score.",
  premier: "Your Premier team's matches.",
  onefa: "Replication: one agent per team.",
  snowball: "Snowball fight.",
};

export function QueuePicker(_props: PieceProps) {
  return (
    <Show
      when={party()}
      fallback={
        <Empty title="No party yet">
          <span>{connectionLine(connection())}</span>
        </Empty>
      }
    >
      {(view) => (
        <div class={styles.queues}>
          <h2 class={styles.title}>Choose a mode</h2>
          <div class={styles.queueGrid}>
            <Index each={view().eligible_queues}>
              {(queue, index) => (
                <button
                  class={styles.queueCard}
                  style={{ "--stagger": index }}
                  data-active={queue().id === view().queue.id ? "" : undefined}
                  disabled={!view().is_owner || view().is_queueing || isPartyBusy()}
                  onMouseEnter={() => playCue("hover")}
                  onClick={() => {
                    playCue("confirm");
                    void partyActions.changeQueue(queue().id);
                  }}
                >
                  <Art src={queue().art} class={styles.queueArt} fallback={null} />
                  <span class={styles.queueName}>
                    <Art src={queue().icon} class={styles.queueGlyph} fallback={null} />
                    <span class={styles.queueLabel}>{queue().label}</span>
                  </span>
                  <span class={styles.queueBlurb}>{QUEUE_BLURBS[queue().id] ?? "Custom rules."}</span>
                </button>
              )}
            </Index>
          </div>
          <Show when={!view().is_owner}>
            <p class={styles.note}>Only the party owner can change the mode.</p>
          </Show>
        </div>
      )}
    </Show>
  );
}

export function PartyTools(_props: PieceProps) {
  const [riotId, setRiotId] = createSignal("");
  const [code, setCode] = createSignal("");
  return (
    <Show when={party()} fallback={<Empty title="Party tools">Connect to VALORANT to manage your party.</Empty>}>
      {(view) => (
        <div class={styles.tools}>
          <h2 class={styles.title}>Party</h2>
          <section class={styles.block}>
            <span class="overline">Access</span>
            <div class={styles.row}>
              <button
                class={`${controls.button} ${controls.ghost} ${controls.small}`}
                disabled={!view().is_owner || isPartyBusy()}
                onClick={() => void partyActions.setOpen(!view().is_open)}
              >
                <Show when={view().is_open} fallback={<Lock size={14} />}>
                  <LockOpen size={14} />
                </Show>
                {view().is_open ? "Open to friends" : "Closed"}
              </button>
            </div>
          </section>
          <section class={styles.block}>
            <span class="overline">Party code</span>
            <Show
              when={view().invite_code}
              fallback={
                <button
                  class={`${controls.button} ${controls.ghost} ${controls.small}`}
                  disabled={!view().is_owner || isPartyBusy()}
                  onClick={() => void partyActions.generateCode()}
                >
                  <Ticket size={14} /> Create code
                </button>
              }
            >
              {(current) => (
                <button class={styles.code} onClick={() => void copyPartyCode(current())} title="Copy">
                  <span class="num" data-sensitive>
                    {current()}
                  </span>
                  <Copy size={14} />
                </button>
              )}
            </Show>
          </section>
          <form
            class={styles.block}
            onSubmit={(event) => {
              event.preventDefault();
              void partyActions.joinCode(code()).then((isJoined) => isJoined && setCode(""));
            }}
          >
            <span class="overline">Join with a code</span>
            <div class={styles.row}>
              <input
                class={controls.input}
                placeholder="Code"
                value={code()}
                spellcheck={false}
                autocomplete="off"
                data-secret
                onInput={(event) => setCode(event.currentTarget.value.toUpperCase())}
              />
              <button class={`${controls.button} ${controls.small}`} type="submit" disabled={!code().trim() || isPartyBusy()}>
                Join
              </button>
            </div>
          </form>
          <form
            class={styles.block}
            onSubmit={(event) => {
              event.preventDefault();
              void partyActions.invite(riotId()).then((isSent) => isSent && setRiotId(""));
            }}
          >
            <span class="overline">Invite</span>
            <div class={styles.row}>
              <input
                class={controls.input}
                placeholder="Name#TAG"
                value={riotId()}
                spellcheck={false}
                onInput={(event) => setRiotId(event.currentTarget.value)}
              />
              <button
                class={`${controls.button} ${controls.small}`}
                type="submit"
                disabled={!riotId().includes("#") || isPartyBusy()}
                title="Send invite"
              >
                <UserPlus size={14} />
              </button>
            </div>
          </form>
          <div class={styles.spacer} />
          <Show when={view().members.length > 1}>
            <button
              class={`${controls.button} ${controls.danger} ${controls.small}`}
              disabled={isPartyBusy()}
              onClick={() => void partyActions.leave()}
            >
              <DoorOpen size={14} /> Leave party
            </button>
          </Show>
        </div>
      )}
    </Show>
  );
}
