// Halo 3-style pieces, after the 2007 lobby: the options list (one highlighted row and a
// description box for it), and the roster of colour-banded player rows with emblem,
// gamertag, service tag, level and rank.
import { For, Index, Show, createSignal, onCleanup } from "solid-js";
import { Crown } from "lucide-solid";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { QUEUE_BLURBS } from "~/pieces/play";
import { catalog } from "~/state/catalog";
import { setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { connection } from "~/state/session";
import { Art } from "~/ui/Art";
import { usePlay } from "./usePlay";
import styles from "./halo.module.css";

interface LobbyOption {
  id: string;
  label: () => string;
  description: () => string;
  isEnabled: () => boolean;
  run: () => void;
}

// ---- lobby options (the side menu carries the controller hints) -------------------------

export function HaloLobby(_props: PieceProps) {
  const play = usePlay();
  const [highlighted, setHighlighted] = createSignal("start");
  const isOpen = () => party()?.is_open ?? false;
  const cycleQueue = () => {
    const queues = play.queues();
    const index = queues.findIndex((queue) => queue.id === play.current()?.id);
    const next = queues[(index + 1) % Math.max(1, queues.length)];
    if (next) play.pickQueue(next);
  };
  const startLabel = () => {
    if (play.searchClock() !== null) return "Stop searching";
    if (play.penaltyClock()) return `Restricted ${play.penaltyClock()}`;
    if (!play.isOwner()) return play.isReady() ? "Not ready" : "Ready";
    return play.isCustom() ? "Start game" : "Start matchmaking";
  };
  // Fixed rows with live fields: the buttons stay mounted, so focus and a press survive the clock.
  const options: LobbyOption[] = [
    {
      id: "start",
      label: startLabel,
      description: () =>
        play.isOwner()
          ? "Search for a match in the current playlist with everyone in your party."
          : "Tell your party leader you are ready to play.",
      isEnabled: () => play.searchClock() !== null || play.canStart(),
      run: () => play.press(),
    },
    {
      id: "playlist",
      label: () => `Playlist: ${play.current()?.label ?? "None"}`,
      description: () => "Choose what to play. Each press moves to the next playlist your party can join.",
      isEnabled: () => play.isOwner() && play.searchClock() === null,
      run: cycleQueue,
    },
    {
      id: "privacy",
      label: () => `Party privacy: ${isOpen() ? "Open" : "Invite only"}`,
      description: () =>
        isOpen() ? "Friends can join your party without an invite." : "Players join your party only when invited.",
      isEnabled: play.isOwner,
      run: () => void partyActions.setOpen(!isOpen()),
    },
    {
      id: "invite",
      label: () => "Invite friends",
      description: () => "Open your friends list to invite players to your party.",
      isEnabled: () => true,
      run: () => setDrawerOpen(true),
    },
  ];
  const current = () => options.find((option) => option.id === highlighted()) ?? options[0];
  return (
    <section class={styles.lobby}>
      <header class={styles.lobbyHead}>
        <span class={styles.lobbyTitle}>Matchmaking</span>
        <span class={styles.lobbySub}>
          <Show when={play.searchClock()} fallback={`${play.partySize()} of ${play.maxSize()} players`}>
            {(clock) => <span class="num">Searching for players… {clock()}</span>}
          </Show>
        </span>
      </header>
      <ul class={styles.options}>
        <For each={options}>
          {(option) => (
            <li>
              <button
                class={styles.option}
                data-part={option.id === "start" ? "play" : undefined}
                data-active={highlighted() === option.id ? "" : undefined}
                disabled={!option.isEnabled()}
                onMouseEnter={() => {
                  if (highlighted() !== option.id) playCue("hover");
                  setHighlighted(option.id);
                }}
                onFocus={() => setHighlighted(option.id)}
                onClick={() => {
                  playCue("confirm");
                  option.run();
                }}
              >
                {option.label()}
              </button>
            </li>
          )}
        </For>
      </ul>
      <p class={styles.description}>{current()?.description()}</p>
    </section>
  );
}

// ---- roster -----------------------------------------------------------------------------

/** Armour colours for the roster bands, in party order. */
const BANDS = ["#b8382c", "#2c62c4", "#c9962a", "#3a9a4f", "#7d4ac4", "#c45a8e", "#3aa3a8", "#8a8f99"];

export function HaloRoster(props: PieceProps) {
  const title = () => (typeof props.piece.props["title"] === "string" && props.piece.props["title"]) || "Party";
  const members = () => party()?.members ?? [];
  const openSlots = () => Math.max(0, (party()?.max_size ?? 5) - members().length);
  return (
    <section class={styles.roster}>
      <header class={styles.rosterHead}>
        <span>{title()}</span>
        <span class="num">
          {members().length}/{party()?.max_size ?? 5}
        </span>
      </header>
      <ol class={styles.rows}>
        {/* By position: party events bring new objects, and rows must not replay their entry. */}
        <Index each={members()}>
          {(member, index) => (
            <li class={styles.row} style={{ "--band": BANDS[index % BANDS.length] }} data-self={member().is_self ? "" : undefined}>
              <span class={styles.emblem}>
                <Art src={member().card_small ?? member().card_tall} class={styles.emblemImage} fallback={<span data-sensitive>{member().game_name.slice(0, 1)}</span>} />
              </span>
              <span class={styles.gamertag} data-sensitive>
                {member().game_name}
                <Show when={member().is_owner}>
                  <Crown size={13} />
                </Show>
              </span>
              <span class={styles.serviceTag} data-sensitive>{member().tag_line.slice(0, 4).toUpperCase()}</span>
              <span class={`${styles.level} num`}>{member().account_level ?? "–"}</span>
              <span class={styles.rank} title={member().rank.name}>
                <Art src={member().rank.icon} class={styles.rankIcon} fallback={<span class={styles.rankEmpty} />} />
              </span>
            </li>
          )}
        </Index>
        <Index each={Array.from({ length: openSlots() })}>{() => <li class={styles.openRow}>Open slot</li>}</Index>
      </ol>
      <footer class={styles.network}>
        Network: {connection().state === "connected" ? "Online" : "Offline"} · Party: {party()?.is_open ? "Open" : "Invite only"}
      </footer>
    </section>
  );
}

// ---- playlist preview: the lobby's map shot with the playlist and its rotation ----------

const ROTATE_MS = 7000;

export function HaloPreview(_props: PieceProps) {
  const play = usePlay();
  const [turn, setTurn] = createSignal(0);
  const timer = window.setInterval(() => setTurn((value) => value + 1), ROTATE_MS);
  onCleanup(() => window.clearInterval(timer));
  const maps = () => catalog().maps.filter((map) => map.splash && !map.is_team_deathmatch);
  const map = () => {
    const pool = maps();
    return pool.length ? pool[turn() % pool.length] : undefined;
  };
  const queueId = () => play.current()?.id ?? "";
  return (
    <section class={styles.preview}>
      <div class={styles.previewShot}>
        <Show when={map()} keyed>
          {(shown) => <Art src={shown.splash} class={styles.previewImage} fallback={null} />}
        </Show>
      </div>
      <div class={styles.previewText}>
        <span class={styles.previewKicker}>Playlist</span>
        <span class={styles.previewTitle}>{play.current()?.label ?? "None"}</span>
        <span class={styles.previewMap}>
          on <b>{map()?.display_name ?? "—"}</b>
        </span>
        <p class={styles.previewBlurb}>{QUEUE_BLURBS[queueId()] ?? "Matchmade games with your party."}</p>
        <span class={styles.previewFoot}>Map rotation · {maps().length} maps</span>
      </div>
    </section>
  );
}
