// Demo backend for a plain browser: answers every command with believable local data and
// plays a short match loop (queue -> agent select -> match -> menus) so the whole menu,
// including the Studio, can be explored and filmed without VALORANT.
// Loaded only outside Tauri (dynamic import in `call`).
import type { AgentCard } from "~/bindings/AgentCard";
import type { AppEvent } from "~/bindings/AppEvent";
import type { ChatMessageView } from "~/bindings/ChatMessageView";
import type { ChatView } from "~/bindings/ChatView";
import type { Catalog } from "~/bindings/Catalog";
import type { CollectionView } from "~/bindings/CollectionView";
import type { ConnectionStatus } from "~/bindings/ConnectionStatus";
import type { FriendRequestView } from "~/bindings/FriendRequestView";
import type { CosmeticKind } from "~/bindings/CosmeticKind";
import type { IdentityChange } from "~/bindings/IdentityChange";
import type { IdentityView } from "~/bindings/IdentityView";
import type { GameSnapshot } from "~/bindings/GameSnapshot";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";
import type { LobbyView } from "~/bindings/LobbyView";
import type { PartyView } from "~/bindings/PartyView";
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import type { PostMatchView } from "~/bindings/PostMatchView";
import type { PregameView } from "~/bindings/PregameView";
import type { Settings } from "~/bindings/Settings";
import type { WalletView } from "~/bindings/WalletView";
import type { InstantCloneState } from "~/bindings/InstantCloneState";
import type { ArgsOf, Command, ResultOf } from "./commands";
import { withDefaults } from "./demoSettings";
import { demoCommunityLook, demoCommunityLooks, demoCommunityThumb } from "./demoCommunity";
import { forcedViewState } from "./demoStates";
import { isLookPreview } from "./runtime";
import { demoCheckForUpdate, demoInstallUpdate, demoUpdate } from "./demoUpdate";
import { dispatchAppEvent } from "./events";
import { MEDIA, playerCard, CARDS, DEMO_LOCKED_AGENTS, AGENTS, MAPS, QUEUES, demoCustomLobby, title, agentCard, mapCard, type ApiAgent, rank, mapArt, member, WEAPONS, EQUIPPED, weaponSkins, FRIENDS } from "./demoData";
import { demoStore, demoCareer, demoLeaderboard, demoCosmeticOptions, initialDemoIdentity, demoProgress, demoNews, demoStats, demoSkinCards, demoSearchSkins, demoHistory, demoSkinOptions, pregamePlayer, demoAgentStore } from "./demoViews";

const STORAGE_PREFIX = "valoshell.demo.";

let catalog: Catalog = {
  agents: AGENTS.map(agentCard),
  maps: MAPS.map(mapCard),
};

/** The real bios, colours and abilities from valorant-api.com, the same source the app's asset
 *  cache reads; offline, the demo keeps its placeholders. */
const fullCatalog: Promise<Catalog> = fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
  .then((response) => (response.ok ? (response.json() as Promise<{ data: ApiAgent[] }>) : null))
  .then((json) => {
    const byUuid = new Map((json?.data ?? []).map((agent) => [agent.uuid, agent]));
    catalog = {
      ...catalog,
      agents: catalog.agents.map((agent) => {
        const api = byUuid.get(agent.uuid);
        if (!api) return agent;
        return {
          ...agent,
          description: api.description ?? agent.description,
          colors: (api.backgroundGradientColors ?? []).map((color) => `#${color.slice(0, 6).toLowerCase()}`),
          role_icon: api.role?.displayIcon ?? null,
          abilities: (api.abilities ?? [])
            .filter((ability) => ability.slot !== "Passive")
            .map((ability) => ({ slot: ability.slot, name: ability.displayName, description: ability.description ?? "", icon: ability.displayIcon ?? null })),
        };
      }),
    };
    return catalog;
  })
  .catch(() => catalog);

function load<T>(key: string, fallback: T): T {
  // A gallery preview starts from the demo's defaults, whatever the browser preview saved.
  if (isLookPreview) return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown): void {
  if (isLookPreview) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode); the demo just forgets.
  }
}

let settings: Settings = withDefaults(load<Partial<Settings>>("settings", {}));
const connection: ConnectionStatus = { state: "connected", riot_id: "s1moscs#EUW", region: "eu" };
let game: GameSnapshot = {
  phase: "menus",
  map_name: "",
  ally_score: null,
  enemy_score: null,
  party_size: 3,
  queue: "",
  side: null,
};
const wallet: WalletView = { valorant_points: 1844, radianite_points: 770, kingdom_credits: 6179 };
// InstantClone streaming to two destinations, no delay yet: the stream delay widget's preview.
let demoDelay: InstantCloneState = {
  phase: "idle",
  armed_delay_ms: 0,
  current_delay_ms: 0,
  buffer_fill_ms: 0,
  ingest_alive: true,
  destinations_alive: 2,
  destinations_total: 2,
};
let party: PartyView = {
  party_id: "demo-party",
  is_owner: true,
  is_open: false,
  is_queueing: false,
  is_custom_game: false,
  queue: QUEUES[1] ?? { id: "competitive", label: "Competitive", art: null, icon: null },
  queue_entry_time: null,
  eligible_queues: QUEUES,
  invite_code: null,
  members: [
    member("s1moscs", "EUW", { puuid: "demo-self", is_self: true, is_owner: true, rank: rank(18, "Diamond 1", "b87de8ff"), title: "Say It With Your Chest", ...playerCard(CARDS.champions) }),
    member("Nova", "4242", { rank: rank(16, "Platinum 2", "4fbfd4ff"), ping_ms: 31, title: "Braba", ...playerCard(CARDS.reyna) }),
    member("Kite", "777", { rank: rank(19, "Diamond 2", "b87de8ff"), is_ready: false, ping_ms: 18, title: "Cooked", ...playerCard(CARDS.oni) }),
  ],
  max_size: 5,
  restricted_seconds: 0,
  custom: null,
};
let pregame: PregameView | null = null;
const timers: number[] = [];

function emit(event: AppEvent): void {
  dispatchAppEvent(event);
}

function later(ms: number, run: () => void): void {
  timers.push(window.setTimeout(run, ms));
}

function setParty(next: Partial<PartyView>): void {
  party = { ...party, ...next };
  emit({ type: "party", data: party });
}

function setGame(next: Partial<GameSnapshot>): void {
  game = { ...game, ...next };
  emit({ type: "game_state", data: game });
}

// ---- store and career -------------------------------------------------------------------

let demoIdentityState: IdentityView | null = null;

function demoIdentity(): IdentityView {
  demoIdentityState ??= initialDemoIdentity();
  return demoIdentityState;
}

/** Like the backend: swap the one thing the change names and answer the new identity. */
function demoEquipIdentity(change: IdentityChange): IdentityView {
  let next = demoIdentity();
  const find = (kind: CosmeticKind, id: string | null) => demoCosmeticOptions(kind).find((option) => option.id === id) ?? null;
  if (change.kind === "card") next = { ...next, card: find("card", change.id) };
  if (change.kind === "title") next = { ...next, title: find("title", change.id) };
  if (change.kind === "expression") {
    const expressions = next.expressions.map((slot) => (slot.slot === change.slot ? { ...slot, item: find(slot.kind, change.id) } : slot));
    next = { ...next, expressions };
  }
  if (change.kind === "buddy") {
    const buddies = next.buddies.map((line) => (line.weapon_id === change.weapon_id ? { ...line, buddy: find("buddy", change.id) } : line));
    next = { ...next, buddies };
  }
  demoIdentityState = next;
  return next;
}

let collection: CollectionView = {
  weapons: WEAPONS.map(([name, category]) => {
    const [weaponUuid, skins] = weaponSkins(name);
    const skin = skins[EQUIPPED[name] ?? -1];
    if (!skin) {
      const image = weaponUuid ? `${MEDIA}/weapons/${weaponUuid}/displayicon.png` : null;
      return { weapon_id: `w-${name.toLowerCase()}`, weapon_name: name, category, skin_id: `s-${name}`, skin_name: name, chroma_id: `c-${name}-0`, image, edition: null };
    }
    const chroma = skin[4][0]?.[1] ?? "";
    return { weapon_id: `w-${name.toLowerCase()}`, weapon_name: name, category, skin_id: `s-${skin[0]}`, skin_name: skin[0], chroma_id: chroma, image: `${MEDIA}/${skin[1]}`, edition: skin[2] };
  }),
};

// ---- match loop -------------------------------------------------------------------------

function demoAgent(name: string): AgentCard | undefined {
  return catalog.agents.find((agent) => agent.upper_name === name);
}

function setPregame(next: PregameView | null): void {
  const isStarting = pregame === null && next !== null;
  pregame = next;
  emit({ type: "pregame", data: next });
  // Like Riot: the team chat exists only during agent select (one teammate hides their name).
  if (next === null) setDemoChat({ team: [], is_team_open: false });
  else if (isStarting) later(2500, () => setDemoChat({ is_team_open: true, team: [chatLine("i'll smoke", { author_agent: "Omen" })] }));
}

function updateAlly(puuid: string, agentName: string, selection: "selected" | "locked"): void {
  if (!pregame) return;
  const agent = demoAgent(agentName);
  const allies = pregame.allies.map((ally) =>
    ally.puuid === puuid && agent
      ? { ...ally, agent_uuid: agent.uuid, agent_name: agent.display_name, agent_icon: agent.icon, selection }
      : ally,
  );
  const own = allies.find((ally) => ally.is_self);
  setPregame({
    ...pregame,
    allies,
    own_agent_uuid: own?.agent_uuid ?? null,
    is_own_locked: own?.selection === "locked",
    taken_agents: allies.filter((ally) => !ally.is_self && ally.selection === "locked").flatMap((ally) => (ally.agent_uuid ? [ally.agent_uuid] : [])),
  });
}

function startAgentSelect(): void {
  setParty({ is_queueing: false, queue_entry_time: null });
  setGame({ phase: "pregame", map_name: "Ascent", queue: party.queue.id });
  emit({ type: "match_flow", data: { kind: "enter_scene", scene: "agent-select" } });
  setPregame({
    match_id: `demo-${Date.now()}`,
    map_name: "Ascent",
    map_splash: mapArt("Ascent", "splash"),
    queue_label: party.queue.label,
    is_ranked: party.queue.id === "competitive",
    team_id: "Blue",
    time_remaining_s: 85,
    observed_at_ms: Date.now(),
    allies: [
      ...party.members.map(pregamePlayer),
      pregamePlayer(member("Echo", "11", { puuid: "demo-echo", rank: rank(17, "Platinum 3", "4fbfd4ff") })),
      pregamePlayer(member("Byte", "22", { puuid: "demo-byte", rank: rank(15, "Gold 3", "e5c46bff") })),
    ],
    enemy_lock_count: 0,
    enemy_team_size: 5,
    own_agent_uuid: null,
    is_own_locked: false,
    taken_agents: [],
  });
  later(2500, () => updateAlly("demo-nova", "OMEN", "selected"));
  later(4200, () => updateAlly("demo-kite", "SOVA", "locked"));
  later(5200, () => updateAlly("demo-nova", "OMEN", "locked"));
  later(7800, () => updateAlly("demo-echo", "KILLJOY", "locked"));
  later(9600, () => updateAlly("demo-byte", "BREACH", "locked"));
  later(1200, () => setLobby(demoLobby(true)));
}

let lobby: LobbyView | null = null;

function lobbyPlayer(name: string, tag: string, isAlly: boolean, agent: string, tier: number, rankName: string, color: string, extra: Partial<LobbyPlayerView> = {}): LobbyPlayerView {
  const card = demoAgent(agent);
  return {
    puuid: `demo-${name.toLowerCase()}`,
    game_name: name,
    tag_line: tag,
    is_self: false,
    is_ally: isAlly,
    is_incognito: false,
    agent_name: card?.display_name ?? null,
    agent_icon: card?.icon ?? null,
    account_level: 40 + ((name.length * 37) % 300),
    is_loaded: true,
    is_rank_hidden: false,
    rank: rank(tier, rankName, color),
    rr: (name.length * 13) % 100,
    peak: rank(Math.min(27, tier + 1), rankName.replace(/\d$/, (digit) => String(Math.min(3, Number(digit) + 1))), color),
    win_rate: 42 + ((name.length * 7) % 20),
    games: 20 + ((name.length * 11) % 60),
    is_placement: false,
    leaderboard_rank: 0,
    stack_size: 1,
    stack_group: null,
    ...extra,
  };
}

function demoLobby(isPregame: boolean): LobbyView {
  const stack = { stack_size: 3, stack_group: 0 };
  const allies = [
    lobbyPlayer("s1moscs", "EUW", true, "JETT", 18, "Diamond 1", "b87de8ff", { is_self: true, ...stack }),
    lobbyPlayer("Kite", "777", true, "SOVA", 19, "Diamond 2", "b87de8ff", stack),
    lobbyPlayer("Nova", "4242", true, "OMEN", 16, "Platinum 2", "4fbfd4ff", stack),
    lobbyPlayer("Echo", "11", true, "KILLJOY", 17, "Platinum 3", "4fbfd4ff"),
    lobbyPlayer("Byte", "22", true, "BREACH", 15, "Gold 3", "e5c46bff"),
  ];
  const duo = { stack_size: 2, stack_group: 1 };
  const enemies = isPregame
    ? []
    : [
        lobbyPlayer("Vortex", "EU1", false, "RAZE", 19, "Diamond 2", "b87de8ff", duo),
        lobbyPlayer("Mirage", "EU1", false, "VIPER", 18, "Diamond 1", "b87de8ff", duo),
        lobbyPlayer("", "", false, "CYPHER", 17, "Platinum 3", "4fbfd4ff", { is_incognito: true }),
        lobbyPlayer("Hex", "404", false, "SKYE", 21, "Ascendant 1", "2fc46bff"),
        lobbyPlayer("Pulse", "99", false, "NEON", 16, "Platinum 2", "4fbfd4ff"),
      ];
  return {
    match_id: pregame?.match_id ?? "demo-match",
    is_pregame: isPregame,
    is_live: true,
    map_name: "Ascent",
    queue_label: party.queue.label,
    allies,
    enemies,
    ally_average: rank(17, "Platinum 3", "4fbfd4ff"),
    enemy_average: isPregame ? null : rank(18, "Diamond 1", "b87de8ff"),
    is_complete: true,
  };
}

function setLobby(next: LobbyView | null): void {
  lobby = next;
  emit({ type: "lobby", data: next });
}

let matchStarted = false;

function afterOwnLock(): void {
  if (matchStarted) return;
  matchStarted = true;
  later(4000, () => {
    setPregame(null);
    setGame({ phase: "ingame", ally_score: 0, enemy_score: 0, side: "attack" });
    setLobby(demoLobby(false));
    emit({ type: "match_flow", data: { kind: "hide_menu" } });
    playRounds(0);
  });
}

let postMatch: PostMatchView | null = null;

/** One scoreboard line, with numbers loosely tied to the seat for believability. */
function postMatchLine(player: LobbyPlayerView, rounds: number, seed: number): PostMatchPlayer {
  const kills = Math.max(2, Math.round(rounds * (0.55 + ((seed * 37) % 50) / 100)));
  const deaths = Math.max(3, Math.round(rounds * (0.5 + ((seed * 53) % 40) / 100)));
  const score = Math.round(kills * 190 + rounds * 55 + ((seed * 71) % 600));
  return {
    puuid: player.puuid,
    game_name: player.is_incognito ? "" : player.game_name,
    tag_line: player.is_incognito ? "" : player.tag_line,
    is_self: player.is_self,
    is_ally: player.is_ally,
    is_incognito: player.is_incognito,
    team_id: player.is_ally ? "Blue" : "Red",
    agent_name: player.agent_name,
    agent_icon: player.agent_icon,
    kills,
    deaths,
    assists: (seed * 13) % 9,
    score,
    acs: Math.round((score / rounds) * 10) / 10,
    stack_size: player.stack_size,
    stack_group: player.stack_group,
  };
}

function resultOf(won: number, lost: number): PostMatchView["result"] {
  if (won === lost) return "draw";
  return won > lost ? "victory" : "defeat";
}

function demoPostMatch(won: number, lost: number): PostMatchView {
  const rounds = Math.max(1, won + lost);
  const roster = lobby ?? demoLobby(false);
  const players = [...roster.allies, ...roster.enemies]
    .map((player, index) => postMatchLine(player, rounds, index + 3))
    .sort((a, b) => b.score - a.score);
  const me = players.find((player) => player.is_self);
  const jett = demoAgent("JETT");
  return {
    match_id: `demo-post-${Date.now()}`,
    result: resultOf(won, lost),
    rounds_won: won,
    rounds_lost: lost,
    map_name: "Ascent",
    map_splash: `${MEDIA}/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png`,
    queue_id: party.queue.id,
    queue_label: party.queue.label,
    is_ranked: party.queue.id === "competitive",
    started_at_ms: Date.now() - rounds * 100_000,
    agent_name: jett?.display_name ?? "Jett",
    agent_icon: jett?.icon ?? null,
    agent_portrait: jett?.portrait ?? null,
    stats: {
      kills: me?.kills ?? 0,
      deaths: me?.deaths ?? 0,
      assists: me?.assists ?? 0,
      combat_score: me?.score ?? 0,
      rounds_played: rounds,
      acs: me?.acs ?? 0,
      adr: 142.6,
      headshot_percent: 27.4,
      first_bloods: 3,
      first_deaths: 2,
    },
    rr_change: null,
    rr_after: null,
    rank_after: null,
    players,
    is_seen: false,
  };
}

/** A past match from the demo history or the demo RR list, as the backend would build it. */
function demoMatchSummary(matchId: string): PostMatchView {
  const row = demoHistory().rows.find((entry) => entry.match_id === matchId);
  const update = demoCareer().updates.find((entry) => entry.match_id === matchId);
  const mapName = row?.map_name ?? update?.map_name;
  if (!mapName) throw new Error("Could not open that match: Riot has no details for it.");
  const isWin = row ? row.result === "victory" : (update?.rr_earned ?? 0) >= 0;
  const base = demoPostMatch(row?.rounds_won ?? (isWin ? 13 : 9), row?.rounds_lost ?? (isWin ? 9 : 13));
  const queueId = row?.queue_id ?? "competitive";
  return {
    ...base,
    match_id: matchId,
    map_name: mapName,
    map_splash: mapArt(mapName, "splash"),
    queue_id: queueId,
    queue_label: row?.queue_label ?? "Competitive",
    is_ranked: queueId === "competitive",
    started_at_ms: row?.started_at_ms ?? update?.started_at_ms ?? base.started_at_ms,
    rr_change: update?.rr_earned ?? row?.rr_change ?? null,
    rr_after: update?.rr_after ?? null,
    rank_after: update?.rank_after ?? null,
    is_seen: true,
  };
}

/** The demo player's RR before a match; the RR change of a ranked result adds to it. */
const DEMO_RR_BEFORE = 41;

/** The preview's sample match: a 13-9 win worth a typical ranked gain. */
const PREVIEW_SCORE = { won: 13, lost: 9, rr: 21 } as const;

/** The gallery preview: set the demo's state for `page` at once, instead of playing the match
 * loop up to it (that takes a minute). Pages outside a match get the menus' state back. */
export function prepareDemoPage(page: string): void {
  if (page === "agent-select") {
    if (!pregame) startAgentSelect();
    updateAlly("demo-self", "JETT", "selected");
    return;
  }
  setPregame(null);
  if (page === "live") {
    setGame({ phase: "ingame", map_name: "Ascent", ally_score: 7, enemy_score: 5, side: "attack" });
    setLobby(demoLobby(false));
    return;
  }
  setGame({ phase: "menus", map_name: "", ally_score: null, enemy_score: null, side: null, queue: "" });
  if (page !== "post-match") return;
  const rank_after = rank(18, "Diamond 1", "b87de8ff");
  const summary = demoPostMatch(PREVIEW_SCORE.won, PREVIEW_SCORE.lost);
  postMatch = { ...summary, rr_change: PREVIEW_SCORE.rr, rr_after: DEMO_RR_BEFORE + PREVIEW_SCORE.rr, rank_after };
  emit({ type: "post_match", data: postMatch });
}

/** Like the backend: the summary a moment after the menus return, the RR change later. */
function announcePostMatch(won: number, lost: number): void {
  later(1800, () => {
    postMatch = demoPostMatch(won, lost);
    emit({ type: "post_match", data: postMatch });
    if (!postMatch.is_ranked) return;
    later(2600, () => {
      if (!postMatch) return;
      const delta = { victory: 21, defeat: -16, draw: 2 }[postMatch.result];
      postMatch = { ...postMatch, rr_change: delta, rr_after: DEMO_RR_BEFORE + delta, rank_after: rank(18, "Diamond 1", "b87de8ff") };
      emit({ type: "post_match", data: postMatch });
    });
  });
}

function playRounds(round: number): void {
  if (round >= 9) {
    later(2500, () => {
      matchStarted = false;
      const won = game.ally_score ?? 0;
      const lost = game.enemy_score ?? 0;
      setGame({ phase: "menus", map_name: "", ally_score: null, enemy_score: null, side: null, queue: "" });
      if (lobby) setLobby({ ...lobby, is_live: false });
      emit({ type: "match_flow", data: { kind: "show_menu" } });
      emit({ type: "match_flow", data: { kind: "enter_scene", scene: "home" } });
      announcePostMatch(won, lost);
    });
    return;
  }
  later(2200, () => {
    const isWin = Math.random() < 0.6;
    setGame({
      ally_score: (game.ally_score ?? 0) + (isWin ? 1 : 0),
      enemy_score: (game.enemy_score ?? 0) + (isWin ? 0 : 1),
    });
    playRounds(round + 1);
  });
}

// ---- commands ---------------------------------------------------------------------------

type Handler<C extends Command> = (args: ArgsOf<C>) => ResultOf<C> | Promise<ResultOf<C>>;
type HandlerTable = { [C in Command]: Handler<C> };

/** The demo party's chat; agent select adds a team chat with a hidden-name teammate. */
let demoChat: ChatView = {
  party: [
    { id: "c1", author: "nyxie", author_agent: null, is_self: false, is_system: false, body: "one more?", sent_at_ms: Date.now() - 90_000 },
    { id: "c2", author: "s1moscs", author_agent: null, is_self: true, is_system: false, body: "yes, queueing", sent_at_ms: Date.now() - 60_000 },
  ],
  team: [],
  // Whispers; Luna's reply arrives a moment after launch (demoWhisperReply), so it is unread.
  direct: [
    {
      puuid: "f-luna",
      game_name: "Luna",
      tag_line: "EUW",
      messages: [
        { id: "d1", author: "", author_agent: null, is_self: true, is_system: false, body: "you on tonight?", sent_at_ms: Date.now() - 600_000 },
      ],
    },
    {
      puuid: "f-mia",
      game_name: "Mia",
      tag_line: "FR",
      messages: [{ id: "d3", author: "Mia", author_agent: null, is_self: false, is_system: false, body: "gg last night", sent_at_ms: Date.now() - 3_600_000 }],
    },
  ],
  is_party_open: true,
  is_team_open: false,
};

function chatLine(body: string, extra: Partial<ChatMessageView>): ChatMessageView {
  return { id: `c-${Date.now()}-${Math.random()}`, author: "", author_agent: null, is_self: false, is_system: false, body, sent_at_ms: Date.now(), ...extra };
}

function setDemoChat(next: Partial<ChatView>): void {
  demoChat = { ...demoChat, ...next };
  emit({ type: "chat", data: demoChat });
}

/** Luna answers the demo's open whisper shortly after launch, so an unread whisper shows. */
const LUNA_REPLY_DELAY_MS = 1500;
setTimeout(() => {
  const reply = chatLine("yes! invite me when you queue", { author: "Luna" });
  setDemoChat({ direct: demoChat.direct.map((thread) => (thread.puuid === "f-luna" ? { ...thread, messages: [...thread.messages, reply] } : thread)) });
}, LUNA_REPLY_DELAY_MS);

/** One request each way, so both rows can be designed without a second account. */
let demoRequests: FriendRequestView[] = [
  { puuid: "req-nova", game_name: "Nova", tag_line: "EUW", is_incoming: true },
  { puuid: "req-kite", game_name: "Kite", tag_line: "0451", is_incoming: false },
];

function dropRequest(puuid: string): null {
  if (!demoRequests.some((request) => request.puuid === puuid)) throw new Error("Could not answer: that request is no longer pending.");
  demoRequests = demoRequests.filter((request) => request.puuid !== puuid);
  return null;
}

function needPregame(): PregameView {
  if (!pregame) throw new Error("Could not pick: you are not in agent select.");
  return pregame;
}

const HANDLERS: HandlerTable = {
  get_settings: () => settings,
  save_settings: ({ settings: next }) => {
    settings = next;
    persist("settings", settings);
    return settings;
  },
  get_game_snapshot: () => game,
  get_connection: () => connection,
  get_catalog: () => fullCatalog,
  get_game_videos: () => [],
  get_ui_sounds: () => [],
  open_sounds_folder: () => null,
  // The browser preview has no file explorer; the gallery still lists the demo's saved looks.
  open_looks_folder: () => null,
  reveal_look: () => null,
  community_looks: () => demoCommunityLooks(),
  community_look: demoCommunityLook,
  community_thumb: demoCommunityThumb,
  resolve_embed_link: () => null,
  get_wallet: () => wallet,
  quit_app: () => null,
  get_store: () => demoStore(),
  get_career: () => demoCareer(),
  get_progress: () => demoProgress(),
  get_leaderboard: () => demoLeaderboard(),
  get_match_history: () => demoHistory(),
  get_match_summary: ({ matchId }) => demoMatchSummary(matchId),
  get_stats: () => demoStats(),
  get_news: () => demoNews(),
  get_lobby: () => lobby,
  // A finished match is already on record, so the screen can be designed before playing one.
  get_post_match: () =>
    (postMatch ??= { ...demoPostMatch(13, 9), is_seen: true, rr_change: 21, rr_after: 62, rank_after: rank(18, "Diamond 1", "b87de8ff") }),
  dismiss_post_match: () => {
    if (postMatch && !postMatch.is_seen) {
      postMatch = { ...postMatch, is_seen: true };
      emit({ type: "post_match", data: postMatch });
    }
    return null;
  },
  get_friends: () => FRIENDS,
  get_collection: () => collection,
  get_identity: () => demoIdentity(),
  search_store_skins: ({ query }) => demoSearchSkins(query),
  get_skin_cards: ({ skinIds }) => demoSkinCards().filter((card) => skinIds.includes(card.skin_id)),
  get_cosmetic_options: ({ kind }) => demoCosmeticOptions(kind),
  equip_identity: ({ change }) => demoEquipIdentity(change),
  get_skin_options: ({ weaponId }) => demoSkinOptions(weaponId),
  // A few agents stay locked, so locked tiles can be designed without an account.
  get_agent_progress: () => ({
    owned: AGENTS.filter(([name]) => !DEMO_LOCKED_AGENTS.includes(name)).map(([, uuid]) => uuid),
    mastery: AGENTS.map(([, uuid], index) => ({ agent_uuid: uuid, act_level: index % 5, lifetime_level: (index * 7) % 23, points: (index * 131) % 900 })),
  }),
  equip_skin: ({ weaponId, skinId, chromaId }) => {
    const option = demoSkinOptions(weaponId).find((entry) => entry.skin_id === skinId);
    if (!option) throw new Error("Could not equip that skin: you do not own it.");
    collection = {
      weapons: collection.weapons.map((weapon) =>
        weapon.weapon_id === weaponId
          ? { ...weapon, skin_id: skinId, skin_name: option.name, chroma_id: chromaId, edition: option.edition, image: option.chromas.find((chroma) => chroma.chroma_id === chromaId && chroma.image)?.image ?? option.image }
          : weapon,
      ),
    };
    return collection;
  },
  get_party: () => party,
  get_penalties: () => [],
  get_friend_requests: () => demoRequests,
  friend_request_accept: ({ puuid }) => dropRequest(puuid),
  friend_request_remove: ({ puuid }) => dropRequest(puuid),
  friend_request_send: ({ riotId }) => {
    const [name, tag] = riotId.split("#").map((part) => part.trim());
    if (!name || !tag) throw new Error("Could not add the friend: type the Riot ID as Name#Tag.");
    demoRequests = [...demoRequests, { puuid: `req-${name.toLowerCase()}`, game_name: name, tag_line: tag, is_incoming: false }];
    return null;
  },
  get_service_status: () => [],
  get_agent_store: () => demoAgentStore(),
  get_favorite_skins: () => [],
  get_chat: () => demoChat,
  get_update: demoUpdate,
  check_for_update: demoCheckForUpdate,
  install_update: demoInstallUpdate,
  chat_send: ({ scope, text }) => {
    const line = chatLine(text.trim(), { author: "s1moscs", is_self: true });
    if (scope === "team") setDemoChat({ team: [...demoChat.team, line] });
    else setDemoChat({ party: [...demoChat.party, line] });
    return null;
  },
  chat_send_direct: ({ puuid, text }) => {
    const friendView = FRIENDS.find((candidate) => candidate.puuid === puuid);
    if (!friendView) throw new Error("Could not send that: you can only message friends.");
    const addLine = (line: ChatMessageView) => {
      const thread = demoChat.direct.find((candidate) => candidate.puuid === puuid) ?? { puuid, game_name: friendView.game_name, tag_line: friendView.tag_line, messages: [] };
      const others = demoChat.direct.filter((candidate) => candidate.puuid !== puuid);
      setDemoChat({ direct: [{ ...thread, messages: [...thread.messages, line] }, ...others] });
    };
    addLine(chatLine(text.trim(), { is_self: true }));
    // Online friends answer, so the unread badge can be seen without a second account.
    if (friendView.status !== "offline") later(2000, () => addLine(chatLine("ok 👍", { author: friendView.game_name })));
    return null;
  },
  party_refresh: () => party,
  party_change_queue: ({ queueId }) => {
    const queue = QUEUES.find((option) => option.id === queueId);
    if (!queue) return null;
    const isCustom = queue.id === "custom";
    setParty({ queue, is_custom_game: isCustom, max_size: isCustom ? 12 : 5, custom: isCustom ? demoCustomLobby() : null });
    return null;
  },
  party_change_team: ({ team, puuid }) => {
    const lobby = party.custom;
    if (!lobby) throw new Error("Could not change team: the party is not in a custom game.");
    const without = (ids: string[]) => ids.filter((id) => id !== puuid);
    const next = { ...lobby, attackers: without(lobby.attackers), defenders: without(lobby.defenders), spectators: without(lobby.spectators) };
    next[team] = [...next[team], puuid];
    setParty({ custom: next });
    return null;
  },
  party_start_custom: () => {
    if (!party.custom) throw new Error("Could not start the custom game: the party is not in one.");
    later(1500, startAgentSelect);
    return null;
  },
  party_start_queue: () => {
    setParty({ is_queueing: true, queue_entry_time: new Date().toISOString() });
    later(7000, () => {
      if (party.is_queueing) startAgentSelect();
    });
    return null;
  },
  party_stop_queue: () => {
    setParty({ is_queueing: false, queue_entry_time: null });
    return null;
  },
  party_set_ready: ({ isReady }) => {
    setParty({ members: party.members.map((m) => (m.is_self ? { ...m, is_ready: isReady } : m)) });
    return null;
  },
  party_set_open: ({ isOpen }) => {
    setParty({ is_open: isOpen });
    return null;
  },
  party_invite: ({ riotId }) => {
    const [name, tag] = riotId.split("#");
    if (!name || !tag) throw new Error("Could not invite: type the Riot ID as Name#Tag.");
    if (party.members.length >= party.max_size) throw new Error("Could not send the invite: the party is full.");
    later(1600, () => setParty({ members: [...party.members, member(name, tag, { puuid: `demo-${name}`, is_ready: false })] }));
    return null;
  },
  party_kick: ({ puuid }) => {
    setParty({ members: party.members.filter((m) => m.puuid !== puuid) });
    return null;
  },
  party_leave: () => {
    setParty({ members: party.members.filter((m) => m.is_self) });
    return null;
  },
  party_generate_code: () => {
    setParty({ invite_code: "VL7Q2X" });
    return null;
  },
  party_join_code: ({ code }) => {
    if (!code.trim()) throw new Error("Could not join: type a party code.");
    return null;
  },
  get_pregame: () => pregame,
  pregame_select: ({ agentUuid }) => {
    const agent = catalog.agents.find((entry) => entry.uuid === agentUuid);
    needPregame();
    if (agent) updateAlly("demo-self", agent.upper_name, "selected");
    return null;
  },
  pregame_lock: ({ agentUuid }) => {
    const agent = catalog.agents.find((entry) => entry.uuid === agentUuid);
    needPregame();
    if (agent) updateAlly("demo-self", agent.upper_name, "locked");
    afterOwnLock();
    return null;
  },
  pregame_dodge: () => {
    needPregame();
    setPregame(null);
    setGame({ phase: "menus", map_name: "" });
    emit({ type: "match_flow", data: { kind: "enter_scene", scene: "play" } });
    return null;
  },
  list_ui_documents: ({ kind }) => load<string[]>(`docs.${kind}`, []),
  load_ui_document: ({ kind, name }) => load<unknown>(`doc.${kind}.${name}`, null),
  save_ui_document: ({ kind, name, document }) => {
    persist(`doc.${kind}.${name}`, document);
    const names = load<string[]>(`docs.${kind}`, []);
    if (!names.includes(name)) persist(`docs.${kind}`, [...names, name]);
    return null;
  },
  delete_ui_document: ({ kind, name }) => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}doc.${kind}.${name}`);
    } catch {
      // Nothing to delete.
    }
    persist(`docs.${kind}`, load<string[]>(`docs.${kind}`, []).filter((entry) => entry !== name));
    return null;
  },
  save_loadout_preset: ({ name }) => {
    const names = load<string[]>("docs.loadouts", []);
    if (!names.includes(name)) persist("docs.loadouts", [...names, name]);
    return null;
  },
  apply_loadout_preset: ({ name }) => {
    if (!load<string[]>("docs.loadouts", []).includes(name)) throw new Error(`No saved loadout is called "${name}".`);
    return { collection, skipped: 0 };
  },
  set_overlay_enabled: () => null,
  set_window_mode: () => null,
  set_overlay_preview: () => null,
  instant_clone_state: () => demoDelay,
  instant_clone_send: ({ action, delayMs }) => {
    const delay = action === "delay" ? delayMs : 0;
    demoDelay = { ...demoDelay, phase: delay > 0 ? "active" : "idle", armed_delay_ms: delay, current_delay_ms: delay, buffer_fill_ms: delay };
    return null;
  },
};

/** Answer one command like the Rust backend would (errors are thrown as messages). */
export async function handle<C extends Command>(command: C, args: ArgsOf<C>): Promise<ResultOf<C>> {
  const handler = HANDLERS[command] as Handler<C>;
  await new Promise((resolve) => setTimeout(resolve, 40));
  const forced = forcedViewState(command);
  if (forced) return forced;
  try {
    return await handler(args);
  } catch (error) {
    throw error instanceof Error ? error.message : String(error);
  }
}

// The demo announces itself like a real connection a moment after the UI starts.
setTimeout(() => {
  emit({ type: "connection", data: connection });
  emit({ type: "game_state", data: game });
  emit({ type: "party", data: party });
  emit({ type: "wallet", data: wallet });
  emit({ type: "friends", data: FRIENDS });
}, 300);
