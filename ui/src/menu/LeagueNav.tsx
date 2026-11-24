// League client style nav: the hextech PLAY crest top left, gold small-caps tabs on an 80 px
// bar, and the client's social column down the right edge (window buttons, your profile, then
// friends grouped like the client's folders). Sized in client units (1280 px wide), so it
// keeps the same proportions at 1280 x 720 or 1600 x 900.
import { For, Show, createMemo, createSignal } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChevronRight, Paintbrush, Settings, UserPlus } from "lucide-solid";
import type { FriendView } from "~/bindings/FriendView";
import { usePlay } from "~/pieces/styled/usePlay";
import { RpCoin, VpCoin } from "~/pieces/styled/valIcons";
import { friendActivity, friends, isElsewhere } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { connection, game, ownRiotId } from "~/state/session";
import { sensitiveTitle } from "~/state/settings";
import { wallet } from "~/state/wallet";
import { doc, isEditing, setEditMode } from "~/studio/store";
import { tabLabel } from "~/studio/skins";
import { Art } from "~/ui/Art";
import { isTauri } from "~/ipc/runtime";
import { openEscMenu } from "./EscMenu";
import { TABS } from "./scenes";
import { playCue } from "./sound";
import styles from "./LeagueNav.module.css";

export function LeagueNav() {
  return (
    <>
      <LeagueBar />
      <LeagueSocial />
    </>
  );
}

function LeagueBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const play = usePlay();
  const current = () => location.pathname.replace(/^\//, "").split("/")[0] || "home";
  const isLive = () => game()?.phase === "pregame" || game()?.phase === "ingame";
  const tabs = () => TABS.filter((tab) => tab.id !== "play");
  const crestLabel = () => {
    if (isLive()) return "In game";
    if (play.searchClock() !== null) return "In queue";
    if (current() === "play") return "Lobby";
    return "Play";
  };
  return (
    <header class={styles.bar} data-part="nav">
      <button
        class={styles.crest}
        data-part="play"
        data-state={play.searchClock() !== null ? "queue" : current() === "play" ? "lobby" : undefined}
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          playCue("confirm");
          navigate(isLive() ? "/live" : "/play");
        }}
      >
        <span class={styles.crestFrame} aria-hidden="true" />
        <span class={styles.crestText}>{crestLabel()}</span>
      </button>
      <Show when={play.searchClock()}>
        {(clock) => (
          <div class={styles.queue}>
            <span class={styles.queueMode}>{play.current()?.label ?? ""}</span>
            <span class={`${styles.queueClock} num`}>{clock()}</span>
            <button class={styles.queueCancel} title="Leave the queue" onClick={() => void partyActions.stopQueue()}>
              ×
            </button>
          </div>
        )}
      </Show>
      <nav class={styles.tabs} aria-label="Menu">
        <For each={tabs()}>
          {(tab) => (
            <A
              href={`/${tab.id}`}
              class={styles.tab}
              data-part="tab"
              data-active={current() === tab.id ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => playCue("tab")}
            >
              {tabLabel(doc.theme.skin, tab.id, tab.label)}
            </A>
          )}
        </For>
        <Show when={isLive()}>
          <A href="/live" class={styles.tab} data-part="tab" data-active={current() === "live" ? "" : undefined} onClick={() => playCue("tab")}>
            Live
          </A>
        </Show>
      </nav>
      <div class={styles.tools}>
        <button
          class={styles.tool}
          data-active={isEditing() ? "" : undefined}
          title="Studio: edit everything (Ctrl+E)"
          onMouseEnter={() => playCue("hover")}
          onClick={() => {
            playCue(isEditing() ? "back" : "confirm");
            setEditMode(!isEditing());
          }}
        >
          <Paintbrush size={15} />
        </button>
        <div class={styles.wallet} data-part="wallet" data-sensitive>
          <span>
            <VpCoin size={13} />
            <b class="num">{wallet()?.valorant_points?.toLocaleString() ?? "–"}</b>
          </span>
          <span>
            <RpCoin size={13} />
            <b class="num">{wallet()?.radianite_points?.toLocaleString() ?? "–"}</b>
          </span>
        </div>
      </div>
    </header>
  );
}

/** The client's social folders: in VALORANT, elsewhere, offline. */
interface Folder {
  id: string;
  label: string;
  rows: FriendView[];
}

function LeagueSocial() {
  const self = () => party()?.members.find((member) => member.is_self);
  const [closed, setClosed] = createSignal<Record<string, boolean>>({ offline: true });
  const [inviteName, setInviteName] = createSignal("");
  const [isAdding, setAdding] = createSignal(false);
  const folders = createMemo<Folder[]>(() => {
    const list = [...friends()].sort((a, b) => a.game_name.localeCompare(b.game_name));
    const isOffline = (friend: FriendView) => friend.status === "offline";
    return [
      { id: "valorant", label: "VALORANT", rows: list.filter((friend) => !isOffline(friend) && !isElsewhere(friend)) },
      { id: "elsewhere", label: "Other games", rows: list.filter((friend) => !isOffline(friend) && isElsewhere(friend)) },
      { id: "offline", label: "Offline", rows: list.filter(isOffline) },
    ];
  });
  const toggle = (id: string) => setClosed((current) => ({ ...current, [id]: !current[id] }));
  const statusWord = () => {
    if (connection().state !== "connected") return "Offline";
    const phase = game()?.phase;
    if (phase === "pregame") return "Agent select";
    if (phase === "ingame") return "In game";
    if (party()?.is_queueing) return "In queue";
    return "Online";
  };
  return (
    <aside class={styles.social}>
      <div class={styles.windowRow}>
        <button class={styles.windowButton} title="Settings (Esc)" onClick={openEscMenu}>
          <Settings size={12} />
        </button>
        <Show when={isTauri}>
          <button class={styles.windowButton} title="Minimise" onClick={() => void getCurrentWindow().minimize()}>
            –
          </button>
          <button class={styles.windowButton} data-close title="Hide to tray (Ctrl+Alt+V brings it back)" onClick={() => void getCurrentWindow().hide()}>
            ×
          </button>
        </Show>
      </div>
      <div class={styles.profile}>
        <span class={styles.icon}>
          <Art src={self()?.card_small ?? null} fallback={<span class={styles.iconEmpty} />} />
          <Show when={self()?.account_level}>{(level) => <b class={`${styles.level} num`}>{level()}</b>}</Show>
        </span>
        <span class={styles.who}>
          <b data-sensitive>{self()?.game_name || ownRiotId()?.name || "Summoner"}</b>
          <small data-state={statusWord() === "Online" ? "online" : statusWord() === "Offline" ? "offline" : "busy"}>{statusWord()}</small>
        </span>
      </div>
      <div class={styles.socialHead}>
        <span>Social</span>
        <button class={styles.headButton} title="Invite by Riot ID" onClick={() => setAdding(!isAdding())}>
          <UserPlus size={13} />
        </button>
      </div>
      <Show when={isAdding()}>
        <form
          class={styles.add}
          onSubmit={(event) => {
            event.preventDefault();
            const name = inviteName().trim();
            if (!name) return;
            void partyActions.invite(name).then((isSent) => isSent && setInviteName(""));
          }}
        >
          <input placeholder="Name#TAG" value={inviteName()} onInput={(event) => setInviteName(event.currentTarget.value)} />
        </form>
      </Show>
      <div class={styles.list}>
        <For each={folders()}>
          {(folder) => (
            <section>
              <button class={styles.folder} data-open={closed()[folder.id] ? undefined : ""} onClick={() => toggle(folder.id)}>
                <ChevronRight size={11} />
                <span>{folder.label}</span>
                <b class="num">({folder.rows.length})</b>
              </button>
              <Show when={!closed()[folder.id]}>
                <For each={folder.rows}>{(friend) => <FriendRow friend={friend} />}</For>
              </Show>
            </section>
          )}
        </For>
      </div>
    </aside>
  );
}

function FriendRow(props: { friend: FriendView }) {
  const tone = () => {
    const status = props.friend.status;
    if (status === "offline") return "offline";
    if (status === "away") return "away";
    if (status === "menus" || status === "online") return "online";
    return "busy";
  };
  const canInvite = () => props.friend.status === "menus" && (party()?.members.length ?? 1) < (party()?.max_size ?? 5);
  return (
    <div class={styles.friend} data-tone={tone()} onMouseEnter={() => playCue("hover")}>
      <span class={styles.friendIcon}>
        <Art src={props.friend.card_small} fallback={<span class={styles.iconEmpty} />} />
      </span>
      <span class={styles.friendText}>
        <b data-sensitive>{props.friend.game_name}</b>
        <small>{friendActivity(props.friend)}</small>
      </span>
      <Show when={canInvite()}>
        <button
          class={styles.invite}
          title={sensitiveTitle(`Invite ${props.friend.game_name}`)}
          onClick={() => {
            playCue("confirm");
            void partyActions.invite(`${props.friend.game_name}#${props.friend.tag_line}`);
          }}
        >
          <UserPlus size={12} />
        </button>
      </Show>
    </div>
  );
}
