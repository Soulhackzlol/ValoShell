// Restriction notice (bottom left, home and play only): the account's queue ban, queue delay,
// ranked, chat or behaviour restriction with when it lifts. A dismissed notice stays dismissed
// across scenes and comes back with the next read (after a match or a failed queue start).
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import { X } from "lucide-solid";
import type { PenaltyKind } from "~/bindings/PenaltyKind";
import type { PenaltyView } from "~/bindings/PenaltyView";
import { dismissPenaltyNotice, isPenaltyNoticeDismissed, penalties } from "~/state/penalties";
import styles from "./RestrictionNotice.module.css";

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

const TITLE: Record<PenaltyKind, string> = {
  queue_ban: "Queue restricted",
  queue_delay: "Queue delay",
  ranked: "Ranked restricted",
  chat: "Chat restricted",
  warning: "Behaviour warning",
  other: "Account restriction",
};

const FALLBACK: Record<PenaltyKind, string> = {
  queue_ban: "You can't queue for now.",
  queue_delay: "Queueing takes longer for now.",
  ranked: "A ranked penalty applies to your account.",
  chat: "Text or voice chat is muted for now.",
  warning: "Riot warned your account about its behaviour.",
  other: "Riot has restricted your account.",
};

/** `in 2 h 05 min` / `in 12 min`. */
function timeLeft(endsAt: number, now: number): string {
  const minutes = Math.max(1, Math.ceil((endsAt - now) / MINUTE_MS));
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours === 0) return `in ${minutes} min`;
  return `in ${hours} h ${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")} min`;
}

function detail(penalty: PenaltyView, now: number): string {
  const parts: string[] = [];
  const endsAt = Date.parse(penalty.ends_at ?? "");
  if (!Number.isNaN(endsAt)) parts.push(`Ends ${timeLeft(endsAt, now)}`);
  if (penalty.games_left !== null) parts.push(`${penalty.games_left} ${penalty.games_left === 1 ? "match" : "matches"} to go`);
  if (penalty.queue_ids.length > 0) parts.push(`Queues: ${penalty.queue_ids.join(", ")}`);
  return parts.length > 0 ? `${parts.join(" · ")}.` : FALLBACK[penalty.kind];
}

function isOver(penalty: PenaltyView, now: number): boolean {
  const endsAt = Date.parse(penalty.ends_at ?? "");
  return !Number.isNaN(endsAt) && endsAt <= now;
}

export function RestrictionNotice() {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS / 2);
  onCleanup(() => window.clearInterval(timer));
  const active = createMemo(() => penalties().filter((penalty) => !isOver(penalty, now())));
  const isShown = () => active().length > 0 && !isPenaltyNoticeDismissed();
  return (
    <Show when={isShown()}>
      <div class={styles.notice} role="status">
        <span class={styles.bar} />
        <div class={styles.list}>
          <For each={active()}>
            {(penalty) => (
              <div class={styles.item} data-kind={penalty.kind}>
                <span class={styles.title}>{TITLE[penalty.kind]}</span>
                <span class={styles.body}>{detail(penalty, now())}</span>
              </div>
            )}
          </For>
        </div>
        <button class={styles.close} aria-label="Dismiss" onClick={dismissPenaltyNotice}>
          <X size={14} />
        </button>
      </div>
    </Show>
  );
}
