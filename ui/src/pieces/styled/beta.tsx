// VALORANT Beta (2020)-style pieces. From the closed-beta menu: the lineup of line-framed
// cards (you in the middle on a pale name plate), the party/friends column with the pale
// queue block on top, and the CLOSED / MATCHMADE pills. Extras: the off-white play slab, the
// player dossier and the closed-beta watermark.
import { For, Index, Show, createSignal, onMount } from "solid-js";
import { ChevronLeft, ChevronRight, Lock, LockOpen, Plus, UserPlus, Users } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { useLineupSlots } from "~/pieces/home";
import { friendActivity, friends, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { ownRiotId } from "~/state/session";
import { careerView } from "~/state/views";
import { Art } from "~/ui/Art";
import { usePlay } from "./usePlay";
import { ValLogo } from "./valIcons";
import styles from "./beta.module.css";

// ---- play slab --------------------------------------------------------------------------

export function BetaPlay(props: PieceProps) {
  const play = usePlay();
  const label = () => (typeof props.piece.props["label"] === "string" && props.piece.props["label"]) || "Play";
  const buttonLabel = () => {
    if (play.searchClock() !== null) return "Cancel";
    if (play.penaltyClock()) return play.penaltyClock();
    if (!play.isOwner()) return play.isReady() ? "Ready" : "Not ready";
    return label();
  };
  return (
    <section class={styles.slab} data-searching={play.searchClock() !== null ? "" : undefined}>
      <span class={styles.mark} data-corner="tl" />
      <span class={styles.mark} data-corner="br" />
      <nav class={styles.modes}>
        <For each={play.queues()}>
          {(queue) => (
            <button
              class={styles.mode}
              data-active={play.current()?.id === queue.id ? "" : undefined}
              disabled={!play.isOwner()}
              onMouseEnter={() => playCue("hover")}
              onClick={() => play.pickQueue(queue)}
            >
              {queue.label}
            </button>
          )}
        </For>
      </nav>
      <button
        class={styles.play}
        data-part="play"
        disabled={play.searchClock() === null && !play.canStart()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        <span>{buttonLabel()}</span>
      </button>
      <footer class={styles.meta}>
        <span class="num">
          <Show when={play.searchClock()} fallback={`Party ${play.partySize()}/${play.maxSize()}`}>
            {(clock) => `Searching ${clock()}`}
          </Show>
        </span>
        <span class={styles.code}>{(play.current()?.id ?? "offline").toUpperCase()} // 01</span>
      </footer>
    </section>
  );
}

// ---- dossier ----------------------------------------------------------------------------

const BARCODE_BARS = 34;

/** Stable bar widths from the player id, so the barcode is theirs. */
function barcode(seed: string): number[] {
  return Array.from({ length: BARCODE_BARS }, (_, index) => {
    const code = seed.charCodeAt(index % Math.max(1, seed.length)) || 7;
    return 1 + ((code * (index + 3)) % 3);
  });
}

export function BetaDossier(_props: PieceProps) {
  onMount(() => {
    if (!careerView.value()) void careerView.load();
  });
  const self = () => party()?.members.find((member) => member.is_self);
  const riotId = () => ownRiotId();
  return (
    <section class={styles.dossier}>
      <header class={styles.dossierHead}>
        <span>Player file</span>
        <span class={styles.code}>#{riotId()?.tag ?? "----"}</span>
      </header>
      <div class={styles.dossierBody}>
        <div class={styles.portrait}>
          <Art src={self()?.card_tall} class={styles.portraitImage} fallback={<span class={styles.portraitEmpty} />} />
        </div>
        <div class={styles.fields}>
          <span class={styles.fieldLabel}>Name</span>
          <span class={styles.name} data-sensitive>
            {riotId()?.name ?? "Unknown"}
          </span>
          <Show when={self()?.title}>
            {(title) => <span class={styles.title}>{title()}</span>}
          </Show>
          <span class={styles.fieldLabel}>Level</span>
          <span class={`${styles.value} num`}>{self()?.account_level ?? "—"}</span>
          <span class={styles.fieldLabel}>Rank</span>
          <span class={styles.rank}>
            <Art src={careerView.value()?.rank.icon} class={styles.rankIcon} fallback={<span />} />
            <span>{careerView.value()?.rank.name ?? "—"}</span>
            <Show when={careerView.value()}>{(view) => <span class={`${styles.rr} num`}>{view().rr} RR</span>}</Show>
          </span>
        </div>
      </div>
      <footer class={styles.barcodeRow}>
        <span class={styles.barcode} aria-hidden="true">
          <For each={barcode(self()?.puuid ?? "valoshell")}>{(width) => <i style={{ width: `${width}px` }} />}</For>
        </span>
        <span class={styles.code}>{(self()?.puuid ?? "").slice(0, 8).toUpperCase() || "OFFLINE"}</span>
      </footer>
    </section>
  );
}

// ---- watermark --------------------------------------------------------------------------

export function BetaWatermark(props: PieceProps) {
  const text = () => (typeof props.piece.props["text"] === "string" && props.piece.props["text"]) || "Closed beta · not final game";
  const day = new Date().toISOString().slice(0, 10);
  return (
    <div class={styles.watermark}>
      <span class={styles.watermarkMain}>{text()}</span>
      <span class={`${styles.watermarkSub} num`} data-sensitive>
        {riotLine()} · {day}
      </span>
    </div>
  );
}

function riotLine(): string {
  const id = ownRiotId();
  return id ? `${id.name}#${id.tag}` : "offline";
}

// ---- lineup -----------------------------------------------------------------------------

export function BetaLineup(props: PieceProps) {
  const slots = useLineupSlots();
  const showStats = () => props.piece.props["showStats"] !== false;
  return (
    <div class={styles.lineup}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} data-center={index === 2 ? "" : undefined} style={{ "--stagger": Math.abs(index - 2) }}>
            <Show when={member()} fallback={<EmptySlot isCenter={index === 2} />}>
              {(current) => <BetaCard member={current()} showStats={showStats()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}

function EmptySlot(props: { isCenter: boolean }) {
  return (
    <button
      class={styles.empty}
      disabled={props.isCenter}
      onMouseEnter={() => playCue("hover")}
      onClick={() => {
        playCue("confirm");
        setDrawerOpen(true);
      }}
    >
      <i class={styles.emptyCorners} aria-hidden="true" />
      <Show when={!props.isCenter}>
        <span class={styles.emptyPlus} aria-hidden="true">
          <Plus size={18} strokeWidth={1.5} />
        </span>
      </Show>
      <span class={styles.emptyLabel}>{props.isCenter ? "Offline" : "Invite"}</span>
    </button>
  );
}

function BetaCard(props: { member: MemberView; showStats: boolean }) {
  const isSelf = () => props.member.is_self;
  const isRanked = () => props.member.rank.tier >= 3;
  return (
    <article class={styles.card} data-self={isSelf() ? "" : undefined}>
      <div class={styles.cardArt} style={{ "--art": props.member.card_tall ? `url("${props.member.card_tall}")` : "none" }} />
      <div class={styles.cardShade} />
      <svg class={styles.cardFrame} viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden="true">
        <path vector-effect="non-scaling-stroke" d="M50 4 L95 26 L95 274 L50 296 L5 274 L5 26 Z" />
        <path vector-effect="non-scaling-stroke" d="M50 0 L50 12 M50 288 L50 300" />
      </svg>
      <Show when={isSelf()}>
        <span class={styles.chevron} data-corner="tl" />
        <span class={styles.chevron} data-corner="tr" />
        <span class={styles.chevron} data-corner="bl" />
        <span class={styles.chevron} data-corner="br" />
      </Show>
      <div class={styles.cardBody}>
        <span class={styles.cardRank} title={props.member.rank.name}>
          <Art src={props.member.rank.icon} class={styles.cardRankIcon} fallback={<span class={styles.diamond} />} />
        </span>
        <Show
          when={isSelf()}
          fallback={
            <>
              <span class={styles.cardName} data-sensitive>{props.member.game_name}</span>
              <Show when={props.showStats}>
                <span class={styles.cardDivider} />
                <span class={styles.stat}>
                  <b class="num">{props.member.account_level ?? "—"}</b>
                  <small>Account level</small>
                </span>
                <span class={styles.stat}>
                  <b>{isRanked() ? props.member.rank.name : "Unranked"}</b>
                  <small>Rank</small>
                </span>
                <span class={styles.stat} data-dim={props.member.is_ready ? undefined : ""}>
                  <b>{props.member.is_ready ? "Ready" : "Not ready"}</b>
                  <small>{props.member.ping_ms === null ? "Ping —" : `Ping ${props.member.ping_ms} ms`}</small>
                </span>
              </Show>
            </>
          }
        >
          <Show when={props.member.account_level !== null}>
            <span class={styles.selfLevel}>
              <b class="num">{props.member.account_level}</b>
              <small>Account level</small>
            </span>
          </Show>
          <span class={styles.namePlate} data-sensitive>{props.member.game_name}</span>
          <span class={styles.readyText}>{props.member.is_ready ? "Ready" : "Not ready"}</span>
        </Show>
      </div>
    </article>
  );
}

// ---- party and friends column -----------------------------------------------------------

export function BetaSocial(props: PieceProps) {
  const play = usePlay();
  const showFriends = () => props.piece.props["showFriends"] !== false;
  const [isOfflineOpen, setOfflineOpen] = createSignal(false);
  const members = () => party()?.members ?? [];
  const online = () => friends().filter((friend) => friend.status !== "offline");
  const offline = () => friends().filter((friend) => friend.status === "offline");
  const openFriends = () => {
    playCue("confirm");
    setDrawerOpen(true);
  };
  const idleLabel = () => {
    if (play.penaltyClock()) return play.penaltyClock();
    if (!play.isOwner()) return play.isReady() ? "Ready" : "Not ready";
    return "Play";
  };
  return (
    <aside class={styles.social}>
      <button
        class={styles.queueBlock}
        data-part="play"
        data-searching={play.searchClock() !== null ? "" : undefined}
        disabled={play.searchClock() === null && !play.canStart()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        <Show
          when={play.searchClock()}
          fallback={
            <>
              <span class={styles.queueBig}>{idleLabel()}</span>
              <span class={styles.queueSmall}>{play.current()?.label ?? "Offline"}</span>
            </>
          }
        >
          {(clock) => (
            <>
              <span class={`${styles.queueBig} num`}>{clock()}</span>
              <span class={styles.queueSmall}>In queue</span>
            </>
          )}
        </Show>
      </button>
      <div class={styles.socialScroll}>
        <div class={styles.socialHead}>
          <b class="num">
            {members().length}/{play.maxSize()}
          </b>
          <span>My party</span>
        </div>
        <Index each={members()}>
          {(member) => (
            <div class={styles.socialRow} data-self={member().is_self ? "" : undefined}>
              <span class={styles.portrait}>
                <Art src={member().card_small ?? member().card_tall} class={styles.portraitImage} fallback={<PortraitMark />} />
              </span>
              <span class={styles.rowText}>
                <small>#{member().tag_line}</small>
                <b data-sensitive>{member().game_name}</b>
                <Show when={member().rank.tier >= 3}>
                  <em>{member().rank.name}</em>
                </Show>
              </span>
            </div>
          )}
        </Index>
        <Show when={showFriends()}>
          <div class={styles.socialHead}>
            <b class="num">{online().length}</b>
            <span>Online</span>
          </div>
          <For each={online()}>{(friend) => <FriendRow friend={friend} onOpen={openFriends} />}</For>
          <button class={styles.socialFold} onClick={() => setOfflineOpen((open) => !open)}>
            <b>{isOfflineOpen() ? "–" : "+"}</b>
            <span>Offline · {offline().length}</span>
          </button>
          <Show when={isOfflineOpen()}>
            <For each={offline()}>{(friend) => <FriendRow friend={friend} onOpen={openFriends} />}</For>
          </Show>
        </Show>
      </div>
      <footer class={styles.socialFoot}>
        <button title="Friends" onClick={openFriends}>
          <Users size={18} />
        </button>
        <button title="Invite" onClick={openFriends}>
          <UserPlus size={18} />
        </button>
      </footer>
    </aside>
  );
}

/** No card art: the client's grey V mark, never the player's initials. */
function PortraitMark() {
  return (
    <span class={styles.portraitMark}>
      <ValLogo size={26} />
    </span>
  );
}

function FriendRow(props: { friend: FriendView; onOpen: () => void }) {
  return (
    <button class={styles.socialRow} data-status={props.friend.status} data-valorant={props.friend.status !== "online" && props.friend.status !== "offline" ? "" : undefined} onMouseEnter={() => playCue("hover")} onClick={() => props.onOpen()}>
      <span class={styles.portrait}>
        <Art src={props.friend.card_small} class={styles.portraitImage} fallback={<PortraitMark />} />
      </span>
      <span class={styles.rowText}>
        <small>#{props.friend.tag_line}</small>
        <b data-sensitive>{props.friend.game_name}</b>
        <em>{friendActivity(props.friend)}</em>
      </span>
    </button>
  );
}

// ---- CLOSED / MATCHMADE pills -----------------------------------------------------------

export function BetaPills(_props: PieceProps) {
  const play = usePlay();
  const isOpen = () => party()?.is_open ?? false;
  const cycleQueue = () => {
    const queues = play.queues();
    const index = queues.findIndex((queue) => queue.id === play.current()?.id);
    const next = queues[(index + 1) % Math.max(1, queues.length)];
    if (next) play.pickQueue(next);
  };
  const step = (direction: 1 | -1) => {
    const queues = play.queues();
    const index = queues.findIndex((queue) => queue.id === play.current()?.id);
    const next = queues[(index + direction + queues.length) % Math.max(1, queues.length)];
    if (next) play.pickQueue(next);
  };
  return (
    <div class={styles.pills}>
      <i class={styles.pillTick} />
      <button
        class={styles.pill}
        data-open={isOpen() ? "" : undefined}
        disabled={!play.isOwner()}
        title="Party access"
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          playCue("tab");
          void partyActions.setOpen(!isOpen());
        }}
      >
        <Show when={isOpen()} fallback={<Lock size={12} strokeWidth={2.4} />}>
          <LockOpen size={12} strokeWidth={2.4} />
        </Show>
        {isOpen() ? "Open" : "Closed"}
      </button>
      <span class={styles.pillGroup}>
        <button class={styles.pillArrow} disabled={!play.isOwner()} title="Previous mode" onClick={() => step(-1)}>
          <ChevronLeft size={14} />
        </button>
        <button class={styles.pill} disabled={!play.isOwner()} title="Next mode" onMouseEnter={() => playCue("hover")} onClick={cycleQueue}>
          <span class={styles.pillText}>{play.current()?.label ?? "—"}</span>
        </button>
        <button class={styles.pillArrow} disabled={!play.isOwner()} title="Next mode" onClick={() => step(1)}>
          <ChevronRight size={14} />
        </button>
      </span>
      <i class={styles.pillTick} />
    </div>
  );
}
