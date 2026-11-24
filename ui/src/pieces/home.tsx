// Home pieces: the party lineup (you in the middle, like the game) and the PLAY bar with
// queue picker and search timer.
import { For, Index, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { ChevronUp, Crown, Plus, Signal, X } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { formatClock, isPartyBusy, party, partyActions, queueElapsedSeconds } from "~/state/party";
import { connection, connectionLine, isConnected, ownRiotId } from "~/state/session";
import { setDrawerOpen } from "~/state/friends";
import styles from "./home.module.css";
import { Art } from "~/ui/Art";

const PARTY_SLOTS = 5;

/** Riot sends rank colours as `RRGGBBAA`. */
export function rankColor(color: string | null): string {
  return color && /^[0-9a-f]{8}$/i.test(color) ? `#${color.slice(0, 6)}` : "var(--rank-unranked)";
}

export function useClock(intervalMs = 1000): () => number {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => window.clearInterval(timer));
  return now;
}

// ---- lineup -----------------------------------------------------------------------------

/** A CSS `url()` for card art, or `none` when the member has none. */
export function artUrl(src: string | null): string {
  return src ? `url("${src}")` : "none";
}

/** Five slots with the local player in the middle, the others around them (as the game). */
export function useLineupSlots(): () => (MemberView | null)[] {
  return createMemo<(MemberView | null)[]>(() => {
    const members = party()?.members ?? [];
    const self = members.find((member) => member.is_self) ?? null;
    const others = members.filter((member) => !member.is_self);
    const order = [others[2], others[0], self, others[1], others[3]];
    return Array.from({ length: PARTY_SLOTS }, (_, index) => order[index] ?? null);
  });
}

export function PartyLineup(props: PieceProps) {
  const slots = useLineupSlots();
  const showRanks = () => props.piece.props["showRanks"] !== false;
  return (
    <div class={styles.lineup}>
      {/* Index, not For: every party event brings new objects, and a card must update in
          place rather than remount (which would replay its entrance and reload its art). */}
      <Index each={slots()}>
        {(member, index) => (
          <Show when={member()} fallback={index === 2 ? <OfflineCard /> : <InviteSlot stagger={Math.abs(index - 2)} />}>
            {(current) => <MemberCard member={current()} stagger={Math.abs(index - 2)} showRank={showRanks()} />}
          </Show>
        )}
      </Index>
    </div>
  );
}

function MemberCard(props: { member: MemberView; stagger: number; showRank: boolean }) {
  const canKick = () => (party()?.is_owner ?? false) && !props.member.is_self;
  return (
    <article
      class={styles.card}
      classList={{ [styles.own ?? ""]: props.member.is_self }}
      style={{
        "--stagger": props.stagger,
        "--card-art": artUrl(props.member.card_tall),
        // Layouts pick the art that fits their shape: banners use the wide card, portraits the small.
        "--card-wide": artUrl(props.member.card_wide ?? props.member.card_tall),
        "--card-small": artUrl(props.member.card_small ?? props.member.card_tall),
      }}
    >
      <div class={styles.cardArt} />
      <div class={styles.cardShade} />
      <Show when={props.member.is_owner}>
        <span class={styles.owner} title="Party owner">
          <Crown size={14} />
        </span>
      </Show>
      <Show when={canKick()}>
        <button class={styles.kick} title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={14} />
        </button>
      </Show>
      <div class={styles.cardInfo}>
        <Show when={props.showRank}>
          <span class={styles.rank} style={{ "--rank": rankColor(props.member.rank.color) }} title={props.member.rank.name}>
            <Art src={props.member.rank.icon} fallback={<span class={styles.rankDot} />} />
            {props.member.rank.name}
          </span>
        </Show>
        <span class={styles.cardName} data-sensitive>
          {props.member.game_name || "Player"}
        </span>
        <span class={styles.cardMeta}>
          <span data-sensitive>#{props.member.tag_line}</span>
          <Show when={props.member.account_level !== null}>
            <span class="num">LV {props.member.account_level}</span>
          </Show>
          <Show when={props.member.ping_ms !== null}>
            <span class={styles.ping}>
              <Signal size={11} />
              <span class="num">{props.member.ping_ms}</span>
            </span>
          </Show>
        </span>
        <span class={styles.ready} data-ready={props.member.is_ready ? "" : undefined}>
          {props.member.is_ready ? "Ready" : "Not ready"}
        </span>
      </div>
    </article>
  );
}

function OfflineCard() {
  const name = () => ownRiotId()?.name ?? "You";
  return (
    <article class={`${styles.card} ${styles.own}`} style={{ "--stagger": 0, "--card-art": "none" }}>
      <div class={styles.cardArt} />
      <div class={styles.cardShade} />
      <div class={styles.cardInfo}>
        <span class={styles.cardName} data-sensitive>
          {name()}
        </span>
        <span class="overline">{connectionLine(connection())}</span>
        <Show when={!isConnected()}>
          <span class={styles.pulse} />
        </Show>
      </div>
    </article>
  );
}

function InviteSlot(props: { stagger: number }) {
  return (
    <div class={`${styles.card} ${styles.invite}`} style={{ "--stagger": props.stagger }}>
      <button
        class={styles.inviteButton}
        disabled={!isConnected()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          playCue("confirm");
          setDrawerOpen(true);
        }}
      >
        <Plus size={22} strokeWidth={1.5} />
        <span class="overline">Invite</span>
      </button>
    </div>
  );
}

// ---- play bar ---------------------------------------------------------------------------

export function PlayBar(props: PieceProps) {
  const now = useClock();
  const [isPickerOpen, setPickerOpen] = createSignal(false);
  const view = () => party();
  const elapsed = () => queueElapsedSeconds(view(), now());
  const isOwner = () => view()?.is_owner ?? false;
  const self = () => view()?.members.find((member) => member.is_self);
  const label = () => (typeof props.piece.props["label"] === "string" && props.piece.props["label"]) || "Play";
  let root: HTMLDivElement | undefined;

  const onDocumentPointer = (event: PointerEvent) => {
    if (root && !root.contains(event.target as Node)) setPickerOpen(false);
  };
  onMount(() => document.addEventListener("pointerdown", onDocumentPointer));
  onCleanup(() => document.removeEventListener("pointerdown", onDocumentPointer));

  return (
    <div ref={root} class={styles.playBar}>
      <div class={styles.queueWrap}>
        <button
          class={styles.queue}
          disabled={!isOwner() || (view()?.is_queueing ?? false)}
          onMouseEnter={() => playCue("hover")}
          onClick={() => {
            playCue("tab");
            setPickerOpen((open) => !open);
          }}
        >
          <span class="overline">{isOwner() || !view() ? "Mode" : "Mode · owner picks"}</span>
          <span class={styles.queueName}>
            {view()?.queue.label ?? "—"}
            <span class={styles.chevron} data-open={isPickerOpen() ? "" : undefined}>
              <ChevronUp size={16} />
            </span>
          </span>
        </button>
        <Show when={isPickerOpen() && view()}>
          {(current) => (
            <div class={styles.picker} role="listbox">
              <For each={current().eligible_queues}>
                {(queue) => (
                  <button
                    class={styles.pickerItem}
                    data-active={queue.id === current().queue.id ? "" : undefined}
                    onMouseEnter={() => playCue("hover")}
                    onClick={() => {
                      setPickerOpen(false);
                      playCue("confirm");
                      void partyActions.changeQueue(queue.id);
                    }}
                  >
                    {queue.label}
                  </button>
                )}
              </For>
            </div>
          )}
        </Show>
      </div>
      <Show
        when={isOwner() || !view()}
        fallback={
          <div class={styles.playGlow}>
            <button
              class={styles.play}
              data-part="play"
              data-secondary={self()?.is_ready ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => void partyActions.setReady(!(self()?.is_ready ?? false))}
            >
              {self()?.is_ready ? "Ready" : "Not ready"}
            </button>
          </div>
        }
      >
        <div class={styles.playGlow}>
          <Show
            when={elapsed() !== null}
            fallback={
              <button
                class={styles.play}
                data-part="play"
                disabled={!view() || isPartyBusy() || (view()?.restricted_seconds ?? 0) > 0}
                onMouseEnter={() => playCue("hover")}
                onClick={() => void partyActions.start()}
              >
                <span>{(view()?.restricted_seconds ?? 0) > 0 ? formatClock(view()?.restricted_seconds ?? 0) : label()}</span>
                {/* Only the Big button layout shows it: there the mode picker is hidden. */}
                <span class={styles.playMode}>{view()?.queue.label ?? ""}</span>
              </button>
            }
          >
            <button class={`${styles.play} ${styles.searching}`} data-part="play" onClick={() => void partyActions.stopQueue()}>
              <span class={styles.searchLabel}>Searching</span>
              <span class={`${styles.searchTime} num`}>{formatClock(elapsed() ?? 0)}</span>
              <span class={styles.cancel}>Cancel</span>
            </button>
          </Show>
        </div>
      </Show>
    </div>
  );
}
