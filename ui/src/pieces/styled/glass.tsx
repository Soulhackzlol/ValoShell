// Glass style pieces: a calm greeting, the party as rounded cards with readiness rings, the
// mode control with a gliding thumb above a capsule PLAY button, and a frosted friends list.
// Colours come from --glass-* variables that each piece's props can override; the motion
// (glare, ripples, rolls) comes from ./glassMotion.
import { For, Index, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { Check, ChevronDown, Crown, Plus, Search, UserPlus, X } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { artUrl, useLineupSlots } from "~/pieces/home";
import { friendActivity, friends, isElsewhere, productName, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { isConnected, ownRiotId } from "~/state/session";
import { careerView } from "~/state/views";
import { Art } from "~/ui/Art";
import { pointerGlow, pop, ripple, roll, stretch } from "./glassMotion";
import { usePlay } from "./usePlay";
import { slideOnWheel } from "~/ui/sideScroll";
import styles from "./glass.module.css";

function textOf(props: PieceProps, key: string, fallback: string): string {
  const value = props.piece.props[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

/** Colour props as --glass-* variables; empty keeps the stylesheet's own. */
function glassVars(props: PieceProps, keys: readonly string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of keys) {
    const value = props.piece.props[key];
    if (typeof value === "string" && value.trim()) vars[`--glass-${key}`] = value.trim();
  }
  return vars;
}

/** Re-runs `effect` on the element whenever `value` changes (not on first render). */
function onChange<T>(value: () => T, effect: (next: T, previous: T) => void): void {
  createEffect(on(value, (next, previous) => previous !== undefined && next !== previous && effect(next, previous), { defer: true }));
}

// ---- greeting -----------------------------------------------------------------------------

function greeting(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GlassHello(props: PieceProps) {
  let line: HTMLParagraphElement | undefined;
  onMount(() => {
    if (!careerView.value() && !careerView.isLoading()) void careerView.load();
  });
  const name = () => party()?.members.find((member) => member.is_self)?.game_name || ownRiotId()?.name || "";
  const subtitle = () => {
    const view = careerView.value();
    if (!view) return isConnected() ? "Ready when you are." : "Waiting for VALORANT…";
    // The rank itself sits on the rank card beside the greeting; this line is the act so far.
    if (view.games === 0) return "No ranked games yet this act.";
    return `${view.wins} wins in ${view.games} games this act · ${Math.round((view.wins / view.games) * 100)}% win rate`;
  };
  const words = () => {
    const list = textOf(props, "title", greeting(new Date().getHours())).split(" ");
    // "Good evening, s1moscs": the comma rides on the last word so it arrives with it.
    if (name() && list.length > 0) list[list.length - 1] = `${list[list.length - 1]},`;
    return list;
  };
  onChange(subtitle, () => roll(line));
  return (
    <div class={styles.hello} style={glassVars(props, ["text"])}>
      {/* Each word blurs in on its own beat, then the name settles in last. */}
      <h1 class={styles.helloTitle}>
        <Index each={words()}>
          {(word, index) => (
            <span class={styles.word} style={{ "--w": index }}>
              {word()}{" "}
            </span>
          )}
        </Index>
        <Show when={name()}>
          <span class={`${styles.word} ${styles.helloName}`} style={{ "--w": words().length }} data-sensitive>
            {name()}
          </span>
        </Show>
      </h1>
      <p ref={line} class={styles.helloLine}>
        {textOf(props, "subtitle", subtitle())}
      </p>
    </div>
  );
}

// ---- party --------------------------------------------------------------------------------

export function GlassParty(props: PieceProps) {
  const slots = useLineupSlots();
  return (
    <div class={styles.party} style={glassVars(props, ["ring", "fill"])}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.partySlot} style={{ "--i": index }}>
            <Show when={member()} fallback={<InviteCard isCenter={index === 2} />}>
              {(current) => <PartyCard member={current()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}

function ReadyRing(props: { isReady: boolean }) {
  const RADIUS = 15;
  const length = 2 * Math.PI * RADIUS;
  let ring: SVGSVGElement | undefined;
  let halo: HTMLSpanElement | undefined;
  // Becoming ready: the ring pops and a halo ripples out once.
  onChange(
    () => props.isReady,
    (isReady) => {
      if (!isReady) return;
      pop(ring as unknown as HTMLElement, 1.25);
      halo?.animate(
        [
          { transform: "scale(0.6)", opacity: 0.7 },
          { transform: "scale(2.2)", opacity: 0 },
        ],
        { duration: 700, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
      );
    },
  );
  return (
    <span class={styles.ringWrap}>
      <span ref={halo} class={styles.ringHalo} />
      <svg ref={ring} class={styles.ring} data-ready={props.isReady ? "" : undefined} viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={RADIUS} class={styles.ringTrack} />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          class={styles.ringFill}
          style={{ "stroke-dasharray": `${length}`, "stroke-dashoffset": props.isReady ? "0" : `${length}` }}
        />
        <path class={styles.ringCheck} pathLength="1" d="M12 18.5 L16.2 22.5 L24 14" />
      </svg>
    </span>
  );
}

function PartyCard(props: { member: MemberView }) {
  const canKick = () => (party()?.is_owner ?? false) && !props.member.is_self;
  return (
    <article ref={(element) => pointerGlow(element)} class={styles.card} data-self={props.member.is_self ? "" : undefined}>
      {/* Layouts pick the art that fits their shape: banners the wide card, portraits and strip the small. */}
      <div
        class={styles.cardArt}
        style={{
          "--art": artUrl(props.member.card_tall),
          "--art-wide": artUrl(props.member.card_wide ?? props.member.card_tall),
          "--art-small": artUrl(props.member.card_small ?? props.member.card_tall),
        }}
      />
      <span class={styles.glare} aria-hidden="true" />
      <Show when={props.member.is_owner}>
        <span class={styles.crown} title="Party owner">
          <Crown size={13} />
        </span>
      </Show>
      <Show when={canKick()}>
        <button class={styles.kick} title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={13} />
        </button>
      </Show>
      <footer class={styles.cardGlass}>
        <span class={styles.cardText}>
          <b data-sensitive>{props.member.game_name || "Player"}</b>
          <small>
            <Show when={props.member.rank.tier >= 3} fallback="Unranked">
              {props.member.rank.name}
            </Show>
            <Show when={props.member.account_level !== null}> · Lv {props.member.account_level}</Show>
          </small>
        </span>
        <ReadyRing isReady={props.member.is_ready} />
      </footer>
    </article>
  );
}

/** Friends you could invite right now: in the menus and not already with you. */
function invitable(): FriendView[] {
  const inParty = new Set(party()?.members.map((member) => member.puuid) ?? []);
  return friends().filter((friend) => friend.status === "menus" && !inParty.has(friend.puuid));
}

function InviteCard(props: { isCenter: boolean }) {
  const faces = () => invitable().slice(0, 3);
  return (
    <button
      ref={(element) => {
        pointerGlow(element);
        ripple(element, styles.ripple ?? "");
      }}
      class={styles.invite}
      disabled={!isConnected()}
      onMouseEnter={() => playCue("hover")}
      onClick={() => {
        playCue("confirm");
        setDrawerOpen(true);
      }}
    >
      <span class={styles.glare} aria-hidden="true" />
      <span class={styles.inviteRing} aria-hidden="true" />
      <span class={styles.inviteIcon}>
        <Plus size={22} />
      </span>
      <span class={styles.inviteLabel}>{props.isCenter ? (isConnected() ? "Loading" : "Offline") : "Invite"}</span>
      <Show when={!props.isCenter && faces().length > 0}>
        <span class={styles.inviteFaces}>
          <For each={faces()}>
            {(friend, index) => (
              <span class={styles.inviteFace} style={{ "--f": index() }}>
                <Avatar friend={friend} />
              </span>
            )}
          </For>
          <small>{invitable().length} available</small>
        </span>
      </Show>
    </button>
  );
}

/** A friend's picture: their card, else a soft gradient of their own with their initial. */
function Avatar(props: { friend: FriendView }) {
  const hue = () => [...props.friend.game_name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7);
  return (
    <Art
      src={props.friend.card_small}
      class={styles.friendImage}
      fallback={
        <span class={styles.friendInitial} style={{ "--hue": hue() }}>
          {props.friend.game_name.slice(0, 1).toUpperCase()}
        </span>
      }
    />
  );
}

// ---- mode control and PLAY ----------------------------------------------------------------

export function GlassPlay(props: PieceProps) {
  const play = usePlay();
  let strip: HTMLDivElement | undefined;
  let thumb: HTMLSpanElement | undefined;
  let labelText: HTMLSpanElement | undefined;
  let clock: HTMLSpanElement | undefined;
  const [box, setBox] = createSignal({ x: 0, w: 0 });
  const [edges, setEdges] = createSignal({ start: false, end: false });
  const queues = () => play.queues();
  const index = () => Math.max(0, queues().findIndex((queue) => queue.id === play.current()?.id));
  const isSearching = () => play.searchClock() !== null;
  const label = () => {
    if (isSearching()) return "Cancel";
    if (play.penaltyClock()) return `Wait ${play.penaltyClock()}`;
    if (!play.isOwner() && party()) return play.isReady() ? "Not ready" : "Ready";
    return textOf(props, "label", "Play");
  };
  // The highlight measures the picked mode (names differ in width) and keeps it in view.
  const measure = (shouldScroll: boolean) => {
    const button = strip?.querySelectorAll<HTMLElement>("[data-mode]")[index()];
    if (!strip || !button) return;
    setBox({ x: button.offsetLeft, w: button.offsetWidth });
    if (shouldScroll) {
      const left = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2;
      strip.scrollTo({ left, behavior: "smooth" });
    }
    updateEdges();
  };
  const updateEdges = () => {
    if (!strip) return;
    setEdges({ start: strip.scrollLeft > 4, end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4 });
  };
  createEffect(on([index, queues], () => requestAnimationFrame(() => measure(true))));
  onMount(() => {
    // A resized window can push the picked mode out of view, so it is scrolled back in.
    const observer = new ResizeObserver(() => measure(true));
    if (strip) observer.observe(strip);
    void document.fonts?.ready.then(() => measure(false));
    onCleanup(() => observer.disconnect());
  });
  onChange(index, (next, previous) => stretch(thumb, next - previous));
  onChange(label, () => roll(labelText));
  onChange(() => play.searchClock(), () => roll(clock, 1));
  return (
    <div class={styles.play} style={glassVars(props, ["accent"])}>
      <Show when={queues().length > 0}>
        <div class={styles.modesFrame} data-fade-start={edges().start ? "" : undefined} data-fade-end={edges().end ? "" : undefined}>
          <div
            ref={strip}
            class={styles.modes}
            onScroll={updateEdges}
            onWheel={slideOnWheel}
          >
            <span ref={thumb} class={styles.modeThumb} style={{ "--x": `${box().x}px`, "--w": `${box().w}px` }} />
            <For each={queues()}>
              {(queue) => (
                <button
                  class={styles.mode}
                  data-mode=""
                  data-active={play.current()?.id === queue.id ? "" : undefined}
                  disabled={!play.isOwner() || isSearching()}
                  onMouseEnter={() => playCue("hover")}
                  onClick={() => play.pickQueue(queue)}
                >
                  {queue.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
      <div class={styles.playHolder}>
        <button
          ref={(element) => ripple(element, styles.ripple ?? "")}
          class={styles.playButton}
          data-part="play"
          data-searching={isSearching() ? "" : undefined}
          data-idle={!isSearching() && play.canStart() ? "" : undefined}
          disabled={!isSearching() && !play.canStart()}
          onMouseEnter={() => playCue("hover")}
          onClick={() => play.press()}
        >
          <span class={styles.shine} aria-hidden="true" />
          <Show when={isSearching()}>
            <span class={styles.spinner} aria-hidden="true" />
            <span ref={clock} class={styles.searchClock}>
              {play.searchClock()}
            </span>
          </Show>
          <span ref={labelText} class={styles.playLabel}>
            {label()}
          </span>
        </button>
      </div>
      <span class={styles.playMeta}>
        {isSearching() ? `Searching ${play.current()?.label ?? ""}` : `${play.partySize()} of ${play.maxSize()} · ${play.current()?.label ?? "Offline"}`}
      </span>
    </div>
  );
}

// ---- friends ------------------------------------------------------------------------------

type GroupId = "valorant" | "other" | "offline";

const GROUPS: readonly { id: GroupId; label: string }[] = [
  { id: "valorant", label: "Playing VALORANT" },
  { id: "other", label: "Other games" },
  { id: "offline", label: "Offline" },
];

function groupOf(friend: FriendView): GroupId {
  if (friend.status === "offline") return "offline";
  if (isElsewhere(friend)) return "other";
  return "valorant";
}

const [collapsed, setCollapsed] = createSignal<ReadonlySet<GroupId>>(new Set());

export function GlassFriends(props: PieceProps) {
  const [query, setQuery] = createSignal("");
  let count: HTMLSpanElement | undefined;
  const showOffline = () => props.piece.props["showOffline"] === true;
  const online = () => friends().filter((friend) => friend.status !== "offline").length;
  const shown = createMemo(() => {
    const text = query().trim().toLowerCase();
    return friends().filter(
      (friend) => (showOffline() || friend.status !== "offline") && (!text || `${friend.game_name}#${friend.tag_line}`.toLowerCase().includes(text)),
    );
  });
  const groups = createMemo(() =>
    GROUPS.map((group) => ({ ...group, friends: shown().filter((friend) => groupOf(friend) === group.id) })).filter((group) => group.friends.length > 0),
  );
  const toggle = (id: GroupId) => {
    playCue("tab");
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };
  onChange(online, (next, previous) => roll(count, next > previous ? 1 : -1));
  return (
    <section ref={(element) => pointerGlow(element)} class={styles.friends} style={glassVars(props, ["fill"])}>
      <span class={styles.glare} aria-hidden="true" />
      <header class={styles.friendsHead}>
        <h2>{textOf(props, "title", "Friends")}</h2>
        <span ref={count}>{online()} online</span>
      </header>
      <label class={styles.friendSearch}>
        <Search size={15} />
        <input placeholder="Search" value={query()} spellcheck={false} onInput={(event) => setQuery(event.currentTarget.value)} />
        <Show when={query()}>
          <button class={styles.clear} title="Clear" onClick={() => setQuery("")}>
            <X size={12} />
          </button>
        </Show>
      </label>
      <div class={styles.friendList}>
        <For each={groups()} fallback={<p class={styles.friendEmpty}>{friends().length ? "Nobody matches" : "No friends online"}</p>}>
          {(group) => (
            <section class={styles.friendGroup} data-collapsed={collapsed().has(group.id) ? "" : undefined}>
              <button class={styles.groupHead} onClick={() => toggle(group.id)}>
                <span>{group.label}</span>
                <b>{group.friends.length}</b>
                <ChevronDown size={14} class={styles.groupChevron ?? ""} />
              </button>
              <div class={styles.groupBody}>
                <ol>
                  <For each={group.friends}>{(friend, index) => <GlassFriendRow friend={friend} index={index()} />}</For>
                </ol>
              </div>
            </section>
          )}
        </For>
      </div>
    </section>
  );
}

function GlassFriendRow(props: { friend: FriendView; index: number }) {
  const [isSent, setSent] = createSignal(false);
  let button: HTMLButtonElement | undefined;
  const canInvite = () =>
    isConnected() &&
    (props.friend.status === "menus" || props.friend.status === "queueing") &&
    !(party()?.members.some((member) => member.puuid === props.friend.puuid) ?? false);
  const detail = () => friendActivity(props.friend);
  return (
    <li class={styles.friend} data-status={props.friend.status} style={{ "--i": Math.min(props.index, 14) }} onMouseEnter={() => playCue("hover")}>
      <span class={styles.friendAvatar}>
        <Avatar friend={props.friend} />
        <Show when={isElsewhere(props.friend) && props.friend.product}>
          <i class={styles.productBadge} data-product={props.friend.product}>
            {productName(props.friend.product).slice(0, 1)}
          </i>
        </Show>
      </span>
      <span class={styles.friendText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{detail()}</small>
      </span>
      <Show when={canInvite()}>
        <button
          ref={(element) => {
            button = element;
            ripple(element, styles.ripple ?? "");
          }}
          class={styles.friendInvite}
          data-sent={isSent() ? "" : undefined}
          disabled={isSent()}
          onClick={async () => {
            playCue("confirm");
            if (await partyActions.invite(`${props.friend.game_name}#${props.friend.tag_line}`)) {
              setSent(true);
              pop(button, 1.12);
            }
          }}
        >
          <Show when={isSent()} fallback={<UserPlus size={14} />}>
            <Check size={14} />
          </Show>
          {isSent() ? "Sent" : "Invite"}
        </button>
      </Show>
    </li>
  );
}
