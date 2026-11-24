// CS 1.6-style pieces in the old VGUI look: olive bevelled windows with a title bar,
// sunken list boxes, yellow selection and raised buttons. "Find Match" picks the mode and
// queues; "Friends" is a server-browser style table of friends with an invite button. Their
// layouts (Look -> Layout) are CSS only, in classic.module.css.
import { For, createSignal, type JSX } from "solid-js";
import type { FriendView } from "~/bindings/FriendView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { friends, setDrawerOpen } from "~/state/friends";
import { partyLabel } from "~/ui/stacks";
import { partyActions } from "~/state/party";
import { settings, updateSettings } from "~/state/settings";
import { canInvite } from "./socialActions";
import { usePlay } from "./usePlay";
import styles from "./classic.module.css";

export function Window(props: { title: string; children: JSX.Element; footer: JSX.Element }) {
  return (
    <section class={styles.window}>
      <header class={styles.titleBar}>
        <span>{props.title}</span>
        <span class={styles.close} aria-hidden="true">
          x
        </span>
      </header>
      <div class={styles.body}>{props.children}</div>
      <footer class={styles.footer}>{props.footer}</footer>
    </section>
  );
}

/** Enter or Space on a focused list row acts like a click. */
export function onActivate(event: KeyboardEvent, act: () => void): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  act();
}

// ---- find match -------------------------------------------------------------------------

export function titleOf(props: PieceProps, fallback: string): string {
  const title = props.piece.props["title"];
  return typeof title === "string" && title ? title : fallback;
}

export function Cs16Play(props: PieceProps) {
  const play = usePlay();
  const status = () => {
    const clock = play.searchClock();
    if (clock) return `Searching for a match... ${clock}`;
    if (play.penaltyClock()) return `Queue restricted for ${play.penaltyClock()}`;
    if (!play.isOwner()) return play.isReady() ? "Ready. Waiting for the party leader." : "Waiting for the party leader.";
    return `${play.partySize()} / ${play.maxSize()} players in party`;
  };
  const mainLabel = () => {
    if (play.searchClock() !== null) return "Cancel";
    if (!play.isOwner()) return play.isReady() ? "Not ready" : "Ready";
    return play.isCustom() ? "Start game" : "Find match";
  };
  return (
    <Window
      title={titleOf(props, "Find Match")}
      footer={
        <>
          <span class={styles.status}>{status()}</span>
          <button
            class={styles.button}
            data-part="play"
            disabled={play.searchClock() === null && !play.canStart()}
            onClick={() => {
              playCue("confirm");
              play.press();
            }}
          >
            {mainLabel()}
          </button>
        </>
      }
    >
      <span class={styles.label}>Game mode:</span>
      <ul class={styles.list} role="listbox">
        <For each={play.queues()}>
          {(queue) => (
            <li
              role="option"
              tabIndex={0}
              aria-selected={play.current()?.id === queue.id}
              aria-disabled={!play.isOwner()}
              class={styles.listRow}
              data-active={play.current()?.id === queue.id ? "" : undefined}
              onClick={() => play.pickQueue(queue)}
              onKeyDown={(event) => onActivate(event, () => play.pickQueue(queue))}
            >
              {queue.label}
            </li>
          )}
        </For>
      </ul>
      {/* A VGUI checkbox, like the game's "Enable bots" options. */}
      <label class={styles.check}>
        <input
          type="checkbox"
          checked={settings()?.streamer.is_enabled ?? false}
          onChange={(event) => {
            const isEnabled = event.currentTarget.checked;
            playCue(isEnabled ? "confirm" : "back");
            updateSettings((draft) => {
              draft.streamer.is_enabled = isEnabled;
            });
          }}
        />
        <span class={styles.checkBox} aria-hidden="true" />
        Streamer mode (hide names)
      </label>
    </Window>
  );
}

// ---- friends browser --------------------------------------------------------------------

type Filter = "online" | "all";
const STATUS_TEXT: Record<FriendView["status"], string> = {
  menus: "In menus",
  queueing: "Searching",
  agent_select: "Agent select",
  in_match: "In game",
  online: "Online",
  away: "Away",
  offline: "Offline",
};

/** "league_of_legends" -> "League of legends": product ids read as words. */
function readable(detail: string): string {
  const words = detail.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function Cs16Browser(props: PieceProps) {
  const [filter, setFilter] = createSignal<Filter>("online");
  const [selected, setSelected] = createSignal<string | null>(null);
  const shown = () => (filter() === "all" ? friends() : friends().filter((friend) => friend.status !== "offline"));
  const picked = () => friends().find((friend) => friend.puuid === selected());
  const isPickedInvitable = () => {
    const friend = picked();
    return friend !== undefined && canInvite(friend);
  };
  return (
    <Window
      title={titleOf(props, "Friends")}
      footer={
        <>
          <span class={styles.status}>{shown().length} friends</span>
          <button class={styles.button} onClick={() => setDrawerOpen(true)}>
            Friends list
          </button>
          <button
            class={styles.button}
            disabled={!isPickedInvitable()}
            onClick={() => {
              const friend = picked();
              if (friend) void partyActions.invite(`${friend.game_name}#${friend.tag_line}`);
            }}
          >
            Invite
          </button>
        </>
      }
    >
      <nav class={styles.tabs}>
        <button class={styles.tab} data-active={filter() === "online" ? "" : undefined} onClick={() => setFilter("online")}>
          Online
        </button>
        <button class={styles.tab} data-active={filter() === "all" ? "" : undefined} onClick={() => setFilter("all")}>
          All
        </button>
      </nav>
      <div class={styles.table}>
        <div class={styles.tableHead}>
          <span>Name</span>
          <span>Status</span>
          <span>Detail</span>
        </div>
        <div class={styles.tableBody}>
          <For each={shown()}>
            {(friend) => (
              <div
                class={styles.tableRow}
                role="row"
                tabIndex={0}
                aria-selected={selected() === friend.puuid}
                data-active={selected() === friend.puuid ? "" : undefined}
                onClick={() => setSelected(friend.puuid)}
                onKeyDown={(event) => onActivate(event, () => setSelected(friend.puuid))}
              >
                <span data-sensitive>{friend.game_name}</span>
                <span>{STATUS_TEXT[friend.status]}</span>
                <span>{[readable(friend.detail), partyLabel(friend.party_size)].filter(Boolean).join(" · ")}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </Window>
  );
}
