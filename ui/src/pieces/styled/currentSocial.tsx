// The current client's social panel on the right edge: a strip of player-card icons that opens
// into the friends list (search, you, then In VAL / Other game / Offline groups). Friends show
// their own small card art; anyone without one gets the client's grey V, never initials.
import { For, Show, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js";
import { List, MessageSquareText, Search, UserPlus, WifiOff } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import { playCue } from "~/menu/sound";
import { openDirectChat } from "~/state/chat";
import { friends, isDrawerOpen, isElsewhere, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { isConnected, ownRiotId } from "~/state/session";
import { Art } from "~/ui/Art";
import { ProductGlyph, RiotFistGlyph, ValLogo } from "./valIcons";
import { queueName, vt } from "./valText";
import styles from "./currentSocial.module.css";

type GroupId = "val" | "other" | "offline";

function groupOf(friend: FriendView): GroupId {
  if (friend.status === "offline") return "offline";
  return isElsewhere(friend) ? "other" : "val";
}

/** The status line under a name, worded like the client ("Competitive 11 - 8"). */
function statusLine(friend: FriendView): string {
  const queue = friend.queue ? queueName("", friend.queue) : "";
  switch (friend.status) {
    case "menus":
      // The client words a friend in the menus by their queue with a 0 - 0 score.
      return queue ? `${queue}  0 - 0` : vt("available");
    case "queueing":
      return queue ? `${vt("inQueue")} (${queue})` : vt("inQueue");
    case "agent_select":
      return queue ? `${vt("agentSelect")} (${queue})` : vt("agentSelect");
    case "in_match": {
      const score = /(\d+)-(\d+)$/.exec(friend.detail);
      if (score) return `${queue || vt("inGame")}  ${score[1]} - ${score[2]}`;
      return queue || vt("inGame");
    }
    case "away":
      return vt("away");
    case "online":
      return vt("online");
    case "offline":
      return vt("offline");
  }
}

/** Dot colour key on the avatar: available, busy (queue / match), other game, away, offline. */
function dotTone(friend: FriendView): string {
  if (friend.status === "menus") return "available";
  if (friend.status === "offline") return "offline";
  if (friend.status === "away") return "away";
  if (friend.status === "online") return "other";
  return "busy";
}

/** Which collapsed groups the panel remembers, across pages and launches. */
const GROUPS_KEY = "valoshell.valSocialGroups";
const DEFAULT_CLOSED: Record<GroupId, boolean> = { val: false, other: false, offline: true };

function savedGroups(): Record<GroupId, boolean> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(GROUPS_KEY) ?? "null");
    if (saved && typeof saved === "object") return { ...DEFAULT_CLOSED, ...(saved as Partial<Record<GroupId, boolean>>) };
  } catch {
    // Storage blocked or unreadable: start from the client's defaults.
  }
  return DEFAULT_CLOSED;
}

const [closedGroups, setClosedGroups] = createSignal(savedGroups());

function Avatar(props: { src: string | null | undefined; tone: string; product?: string | undefined }) {
  const fallback = () =>
    props.product !== undefined ? (
      <span class={styles.avatarFallback} data-product={props.product.toLowerCase()}>
        <ProductGlyph product={props.product} />
      </span>
    ) : (
      <span class={styles.avatarFallback}>
        <ValLogo size={26} />
      </span>
    );
  return (
    <span class={styles.avatar}>
      <Art src={props.src} class={styles.avatarImage} fallback={fallback()} />
      <i class={styles.dot} data-tone={props.tone} />
    </span>
  );
}

function FriendRow(props: { friend: FriendView }) {
  const [isSent, setSent] = createSignal(false);
  const isInParty = () => party()?.members.some((member) => member.puuid === props.friend.puuid) ?? false;
  const canInvite = () =>
    isConnected() && !isInParty() && (props.friend.status === "menus" || props.friend.status === "queueing");
  const invite = async () => {
    playCue("confirm");
    if (await partyActions.invite(`${props.friend.game_name}#${props.friend.tag_line}`)) setSent(true);
  };
  return (
    <>
      <div class={styles.row} data-group={groupOf(props.friend)} data-party={props.friend.party_size > 1 ? "" : undefined} onMouseEnter={() => playCue("hover")}>
        <Avatar src={props.friend.card_small} tone={dotTone(props.friend)} product={isElsewhere(props.friend) ? props.friend.product : undefined} />
        <span class={styles.rowText}>
          <b class={styles.name} data-sensitive>
            {props.friend.game_name}
          </b>
          <small class={styles.status} data-tone={dotTone(props.friend)}>
            {statusLine(props.friend)}
          </small>
        </span>
        <span class={styles.rowIcons}>
          <Show when={canInvite()}>
            <button class={styles.rowButton} title={vt("invite")} disabled={isSent()} onClick={() => void invite()}>
              <UserPlus size={15} />
            </button>
          </Show>
          <button
            class={`${styles.rowButton} ${styles.chatButton}`}
            title={vt("message")}
            aria-label={`${vt("message")} ${props.friend.game_name}`}
            onClick={() => {
              playCue("confirm");
              openDirectChat(props.friend.puuid);
            }}
          >
            <MessageSquareText size={14} class={styles.chatIcon ?? ""} />
          </button>
        </span>
      </div>
      <Show when={props.friend.party_size > 1 && groupOf(props.friend) === "val"}>
        <div class={styles.partyNote}>
          <span>+{props.friend.party_size - 1}</span>
          <span>{vt("otherPlayers")}</span>
        </div>
      </Show>
    </>
  );
}

function groupMark(id: GroupId, size: number): JSX.Element {
  if (id === "other") return <RiotFistGlyph size={size} />;
  if (id === "offline") return <WifiOff size={size - 2} />;
  return <ValLogo size={size} />;
}

function GroupHeader(props: { id: GroupId; count: number; isOpen: boolean; onToggle: () => void }) {
  const title = () => (props.id === "val" ? vt("inVal") : props.id === "other" ? vt("otherGame") : vt("offline"));
  return (
    <button class={styles.group} data-open={props.isOpen ? "" : undefined} onClick={() => props.onToggle()}>
      <span class={styles.groupIcon}>
        {groupMark(props.id, 20)}
      </span>
      <span class={styles.groupTitle}>
        {title()} ({props.count})
      </span>
      <i class={styles.groupArrow} />
    </button>
  );
}

function SelfRow() {
  const self = () => party()?.members.find((member) => member.is_self);
  const line = () => {
    const view = party();
    if (view?.is_queueing) return `${vt("inQueue")} (${queueName(view.queue.id, view.queue.label)})`;
    return isConnected() ? vt("available") : vt("offline");
  };
  return (
    <div class={styles.row} data-self="">
      <Avatar src={self()?.card_small ?? null} tone={isConnected() ? "available" : "offline"} />
      <span class={styles.rowText}>
        <b class={styles.name} data-sensitive>
          {self()?.game_name || ownRiotId()?.name || "—"}
        </b>
        <small class={styles.status} data-tone="available">
          {line()}
        </small>
      </span>
    </div>
  );
}

export function ValSocial() {
  const [query, setQuery] = createSignal("");
  const closed = closedGroups;
  const groups = createMemo(() => {
    const text = query().trim().toLowerCase();
    const shown = friends().filter((friend) => !text || `${friend.game_name}#${friend.tag_line}`.toLowerCase().includes(text));
    const by: Record<GroupId, FriendView[]> = { val: [], other: [], offline: [] };
    for (const friend of shown) by[groupOf(friend)].push(friend);
    return by;
  });
  const toggle = (id: GroupId) => {
    playCue("tab");
    const next = { ...closedGroups(), [id]: !closedGroups()[id] };
    setClosedGroups(next);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered this time; the panel still works.
    }
  };
  const open = (isOpen: boolean) => {
    playCue(isOpen ? "confirm" : "back");
    setDrawerOpen(isOpen);
  };
  let panel: HTMLElement | undefined;
  // Like the client, the open list folds back into the strip when you click anywhere else.
  onMount(() => {
    const closeOutside = (event: PointerEvent) => {
      if (isDrawerOpen() && panel && !panel.contains(event.target as Node)) setDrawerOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    onCleanup(() => document.removeEventListener("pointerdown", closeOutside));
  });
  const submit = (event: Event) => {
    event.preventDefault();
    if (!query().includes("#")) return;
    void partyActions.invite(query().trim()).then((isSent) => isSent && setQuery(""));
  };
  return (
    <aside ref={panel} class={styles.panel} data-open={isDrawerOpen() ? "" : undefined} aria-label="Friends">
      <Show when={isDrawerOpen()} fallback={<Strip onOpen={() => open(true)} groups={groups()} />}>
        <header class={styles.tabs}>
          <button class={styles.tab} data-active="" title="Friends" onClick={() => open(false)}>
            <List size={24} />
          </button>
          <button class={styles.tab} title={vt("invite")} onClick={() => document.getElementById("val-friend-search")?.focus()}>
            <UserPlus size={22} />
            <i class={styles.tabBadge} />
          </button>
        </header>
        <form class={styles.search} onSubmit={submit}>
          <Search size={18} />
          <input
            id="val-friend-search"
            placeholder={vt("searchFriends").toUpperCase()}
            value={query()}
            spellcheck={false}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </form>
        <div class={styles.list}>
          <SelfRow />
          <For each={["val", "other", "offline"] as const}>
            {(id) => (
              <Show when={groups()[id].length > 0}>
                <GroupHeader id={id} count={groups()[id].length} isOpen={!closed()[id]} onToggle={() => toggle(id)} />
                <Show when={!closed()[id]}>
                  <For each={groups()[id]}>{(friend) => <FriendRow friend={friend} />}</For>
                </Show>
              </Show>
            )}
          </For>
        </div>
      </Show>
    </aside>
  );
}

function Strip(props: { onOpen: () => void; groups: Record<GroupId, FriendView[]> }) {
  const self = () => party()?.members.find((member) => member.is_self);
  const marker = (id: GroupId): JSX.Element => <span class={styles.stripMarker}>{groupMark(id, 18)}</span>;
  return (
    <div class={styles.strip} onClick={() => props.onOpen()}>
      <button class={styles.stripAdd} title={vt("invite")}>
        <UserPlus size={26} />
        <i class={styles.tabBadge} />
      </button>
      <div class={styles.stripList}>
        <span class={styles.stripCell}>
          <Avatar src={self()?.card_small ?? null} tone={isConnected() ? "available" : "offline"} />
        </span>
        <For each={["val", "other", "offline"] as const}>
          {(id) => (
            <Show when={props.groups[id].length > 0}>
              {marker(id)}
              {/* A group folded in the list stays folded here too. */}
              <For each={closedGroups()[id] ? [] : props.groups[id]}>
                {(friend) => (
                  <>
                    <span class={styles.stripCell} data-party={friend.party_size > 1 && id === "val" ? "" : undefined}>
                      <Avatar src={friend.card_small} tone={dotTone(friend)} product={isElsewhere(friend) ? friend.product : undefined} />
                    </span>
                    <Show when={friend.party_size > 1 && id === "val"}>
                      <span class={styles.stripMore}>+{friend.party_size - 1}</span>
                    </Show>
                  </>
                )}
              </For>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
