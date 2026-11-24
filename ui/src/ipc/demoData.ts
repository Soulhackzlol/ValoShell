// Demo backend fixtures: the agents, maps, queues, cards, players and weapons the browser
// preview shows, and the art URLs for them (valorant-api.com's media host). No state here.
import type { AgentCard } from "~/bindings/AgentCard";
import type { FriendView } from "~/bindings/FriendView";
import type { MapCard } from "~/bindings/MapCard";
import type { MemberView } from "~/bindings/MemberView";
import type { PartyView } from "~/bindings/PartyView";
import type { QueueOption } from "~/bindings/QueueOption";
import type { RankBadge } from "~/bindings/RankBadge";
import { DEMO_WEAPON_ART, type DemoSkin } from "./demoArt";

export const MEDIA = "https://media.valorant-api.com";

export const TIERS = `${MEDIA}/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04`;

/** A player card's three crops, as the party and friends views carry them. */
export function playerCard(uuid: string): Pick<MemberView, "card_tall" | "card_wide" | "card_small"> {
  return {
    card_tall: `${MEDIA}/playercards/${uuid}/largeart.png`,
    card_wide: `${MEDIA}/playercards/${uuid}/wideart.png`,
    card_small: `${MEDIA}/playercards/${uuid}/smallart.png`,
  };
}

export const CARDS = {
  champions: "7ae0ca6c-44fc-9fe2-9361-9abaecee53bb",
  reyna: "e9dcc215-4b83-90e4-ba3b-4f8d32568eb6",
  oni: "aeca98db-4737-5e0f-3476-7eb8a16eb696",
  clove: "faa3c3b5-4b0b-1f20-b383-01b7b83126ff",
  neon: "cec2424b-483e-da2e-4369-f0a8822f96b5",
  glitchpop: "df3adf8c-4fa3-5f57-544d-eabf8b68713d",
  spectrum: "006e03e5-4fdb-c400-4c5b-5f815980f403",
  jett: "ab5a453a-f726-4e04-b277-f30d56a8b152",
  prime: "d93ad22d-4db7-b6bc-5e9c-e5959bb9dd76",
  rgx: "cada2e3f-4b1d-8279-3e1a-49984a71d4d3",
  hush: "d1794848-4323-429a-269a-83b81a87a4c6",
};

/** Every demo skin by name, with the weapon it belongs to. */
export const SKINS_BY_NAME = new Map<string, DemoSkin>(Object.values(DEMO_WEAPON_ART).flatMap(([, skins]) => skins.map((skin) => [skin[0], skin] as const)));

export function skinArt(name: string): string | null {
  const skin = SKINS_BY_NAME.get(name);
  return skin ? `${MEDIA}/${skin[1]}` : null;
}

export const DEMO_LOCKED_AGENTS: readonly string[] = ["FADE", "HARBOR", "OMEN", "VYSE"];

export const AGENTS: ReadonlyArray<[string, string, string]> = [
  ["ASTRA", "41fb69c1-4189-7b37-f117-bcaf1e96f1bf", "Controller"],
  ["BREACH", "5f8d3a7f-467b-97f3-062c-13acf203c006", "Initiator"],
  ["BRIMSTONE", "9f0d8ba9-4140-b941-57d3-a7ad57c6b417", "Controller"],
  ["CHAMBER", "22697a3d-45bf-8dd7-4fec-84a9e28c69d7", "Sentinel"],
  ["CLOVE", "1dbf2edd-4729-0984-3115-daa5eed44993", "Controller"],
  ["CYPHER", "117ed9e3-49f3-6512-3ccf-0cada7e3823b", "Sentinel"],
  ["DEADLOCK", "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235", "Sentinel"],
  ["FADE", "dade69b4-4f5a-8528-247b-219e5a1facd6", "Initiator"],
  ["GEKKO", "e370fa57-4757-3604-3648-499e1f642d3f", "Initiator"],
  ["HARBOR", "95b78ed7-4637-86d9-7e41-71ba8c293152", "Controller"],
  ["ISO", "0e38b510-41a8-5780-5e8f-568b2a4f2d6c", "Duelist"],
  ["JETT", "add6443a-41bd-e414-f6ad-e58d267f4e95", "Duelist"],
  ["KAY/O", "601dbbe7-43ce-be57-2a40-4abd24953621", "Initiator"],
  ["KILLJOY", "1e58de9c-4950-5125-93e9-a0aee9f98746", "Sentinel"],
  ["NEON", "bb2a4828-46eb-8cd1-e765-15848195d751", "Duelist"],
  ["OMEN", "8e253930-4c05-31dd-1b6c-968525494517", "Controller"],
  ["PHOENIX", "eb93336a-449b-9c1b-0a54-a891f7921d69", "Duelist"],
  ["RAZE", "f94c3b30-42be-e959-889c-5aa313dba261", "Duelist"],
  ["REYNA", "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc", "Duelist"],
  ["SAGE", "569fdd95-4d10-43ab-ca70-79becc718b46", "Sentinel"],
  ["SKYE", "6f2a04ca-43e0-be17-7f36-b3908627744d", "Initiator"],
  ["SOVA", "320b2a48-4d9b-a075-30f1-1f93a9b638fa", "Initiator"],
  ["TEJO", "b444168c-4e35-8076-db47-ef9bf368f384", "Initiator"],
  ["VIPER", "707eab51-4836-f488-046a-cda6bf494859", "Controller"],
  ["VYSE", "efba5359-4016-a1e5-7626-b1ae76895940", "Sentinel"],
  ["WAYLAY", "df1cb487-4902-002e-5c17-d28e83e78588", "Duelist"],
  ["YORU", "7f94d92c-4234-0a36-9646-3a87eb8b5c89", "Duelist"],
];

export const MAPS: ReadonlyArray<[string, string, string]> = [
  ["ABYSS", "Infinity", "224b0a95-48b9-f703-1bd8-67aca101a61f"],
  ["ASCENT", "Ascent", "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319"],
  ["BIND", "Duality", "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba"],
  ["BREEZE", "Foxtrot", "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53"],
  ["CORRODE", "Rook", "1c18ab1f-420d-0d8b-71d0-77ad3c439115"],
  ["FRACTURE", "Canyon", "b529448b-4d60-346e-e89e-00a4c527a405"],
  ["HAVEN", "Triad", "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047"],
  ["ICEBOX", "Port", "e2ad5c54-4114-a870-9641-8ea21279579a"],
  ["LOTUS", "Jam", "2fe4ed3a-450a-948b-6d6b-e89a78e680a9"],
  ["PEARL", "Pitt", "fd267378-4d1d-484f-ff52-77821ed10dc2"],
  ["SPLIT", "Bonsai", "d960549e-485c-e861-8d71-aa9d1aed12a2"],
  ["SUNSET", "Juliett", "92584fbe-486a-b1b2-9faa-39b0f486b498"],
];

/** A demo queue with the asset tables' card art and glyph (valorant-api queue uuids). */
export function demoQueue(id: string, label: string, uuid: string, hasIcon: boolean): QueueOption {
  const base = `${MEDIA}/gamemodequeues/${uuid}`;
  return { id, label, art: `${base}/listviewicontall.png`, icon: hasIcon ? `${base}/displayicon.png` : null };
}

export const QUEUES: QueueOption[] = [
  demoQueue("unrated", "Unrated", "494b69f1-4e3a-1b03-c2cd-a4875d6e9cb6", false),
  demoQueue("competitive", "Competitive", "d2faff85-4964-f52e-b6b5-73a5d66ccad6", true),
  demoQueue("swiftplay", "Swiftplay", "2d257217-464c-7c4b-efc6-51a55365d44a", true),
  demoQueue("spikerush", "Spike Rush", "3938d5da-43bf-1e8c-f09f-858caf145975", true),
  demoQueue("deathmatch", "Deathmatch", "f3126c5e-4a6c-1f02-b216-cb9bf58df856", false),
  demoQueue("hurm", "Team Deathmatch", "1400f385-4905-96ff-8e1e-f8a4acb8c64d", true),
  demoQueue("custom", "Custom", "63d60a3e-4838-695d-9077-e9af5ed523ca", false),
];

/** The custom lobby the demo opens: you defending on Ascent, Nova attacking, Kite watching. */
export function demoCustomLobby(): NonNullable<PartyView["custom"]> {
  return {
    map_name: "Ascent",
    map_splash: mapArt("Ascent", "splash"),
    mode_name: "Standard",
    server_name: "Madrid",
    attackers: ["demo-nova"],
    defenders: ["demo-self"],
    spectators: ["demo-kite"],
    is_autobalance_on: true,
    autobalance_min_players: 6,
  };
}

export function title(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase().replace(/\/(.)/, (_, letter: string) => `/${letter.toUpperCase()}`);
}

/** Page tints by role for the demo; the real ones come per agent from the asset tables. */
export const DEMO_TINTS: Record<string, string[]> = {
  Duelist: ["#5e2a3c", "#3a1a2a", "#8a3a52", "#21101a"],
  Controller: ["#4b2a7a", "#2c1a52", "#6a3fa8", "#170f2e"],
  Initiator: ["#2a5a4a", "#183a30", "#3f7a62", "#0c1f1a"],
  Sentinel: ["#2a4a6a", "#1a2e44", "#3f6a90", "#0f1a28"],
};

export function agentCard([name, uuid, role]: readonly [string, string, string]): AgentCard {
  return {
    uuid,
    display_name: title(name),
    upper_name: name,
    role,
    icon: `${MEDIA}/agents/${uuid}/displayicon.png`,
    portrait: `${MEDIA}/agents/${uuid}/fullportrait.png`,
    background: `${MEDIA}/agents/${uuid}/background.png`,
    description: `${title(name)} brings their own toolkit to every round. The full bio shows when ValoShell has the game's asset tables.`,
    colors: DEMO_TINTS[role] ?? ["#2a3c52", "#1b2a3a", "#3d5570", "#0f1923"],
    role_icon: null,
    abilities: [],
  };
}

export function mapCard([name, internalId, uuid]: readonly [string, string, string]): MapCard {
  return {
    internal_id: internalId,
    display_name: title(name),
    upper_name: name,
    splash: `${MEDIA}/maps/${uuid}/splash.png`,
    list_icon: `${MEDIA}/maps/${uuid}/listviewicon.png`,
    is_team_deathmatch: false,
  };
}

export interface ApiAgent {
  uuid: string;
  description?: string;
  backgroundGradientColors?: string[];
  role?: { displayIcon?: string } | null;
  abilities?: { slot: string; displayName: string; description?: string; displayIcon?: string | null }[];
}

export function rank(tier: number, name: string, color: string): RankBadge {
  return { tier, name, icon: `${TIERS}/${tier}/largeicon.png`, color };
}

export function mapArt(name: string, crop: "splash" | "listviewicon"): string | null {
  const map = MAPS.find(([upperName]) => upperName === name.toUpperCase());
  return map ? `${MEDIA}/maps/${map[2]}/${crop}.png` : null;
}

export function member(name: string, tag: string, extra: Partial<MemberView>): MemberView {
  return {
    puuid: `demo-${name.toLowerCase()}`,
    game_name: name,
    tag_line: tag,
    is_self: false,
    is_owner: false,
    is_ready: true,
    account_level: 120,
    card_tall: null,
    card_wide: null,
    card_small: null,
    title: null,
    title_es: null,
    level_border: `${MEDIA}/levelborders/7e7feff1-44c2-301e-767d-d9b2b1cd9051/smallplayercardappearance.png`,
    rank: rank(14, "Gold 2", "e5c46bff"),
    ping_ms: 24,
    ...extra,
  };
}

export const LEADER_NAMES = ["Kraken", "nyxie", "Sova Main", "tenz fan", "Zekken", "lumen", "Aspas", "keiko", "Demon1", "ripple"];

export const HISTORY_MAPS = ["Abyss", "Corrode", "Lotus", "Haven", "Bind", "Sunset", "Ascent", "Pearl", "Split"];
export const DEMO_PARTY_SIZES = [1, 2, 2, 3, 1, 5, 2];

export const WEAPONS: ReadonlyArray<[string, string]> = [
  ["Classic", "Sidearm"], ["Shorty", "Sidearm"], ["Frenzy", "Sidearm"], ["Ghost", "Sidearm"], ["Sheriff", "Sidearm"],
  ["Stinger", "SMG"], ["Spectre", "SMG"], ["Bucky", "Shotgun"], ["Judge", "Shotgun"],
  ["Bulldog", "Rifle"], ["Guardian", "Rifle"], ["Phantom", "Rifle"], ["Vandal", "Rifle"],
  ["Marshal", "Sniper"], ["Outlaw", "Sniper"], ["Operator", "Sniper"], ["Ares", "Heavy"], ["Odin", "Heavy"], ["Melee", "Melee"],
];

/** Which of a weapon's demo skins it wears (-1: the standard skin), so the loadout looks lived in. */
export const EQUIPPED: Record<string, number> = { Classic: 0, Shorty: -1, Frenzy: 2, Ghost: 1, Sheriff: 0, Stinger: -1, Spectre: 1, Bucky: -1, Judge: 1, Bulldog: 2, Guardian: 0, Phantom: 0, Vandal: 0, Marshal: 1, Outlaw: -1, Operator: 3, Ares: -1, Odin: 1, Melee: 0 };

export function chromaArt(uuid: string, crop: "swatch" | "fullrender"): string {
  return `${MEDIA}/weaponskinchromas/${uuid}/${crop}.png`;
}

export function weaponSkins(name: string): [string, DemoSkin[]] {
  return DEMO_WEAPON_ART[name] ?? ["", []];
}

export function friend(name: string, tag: string, status: FriendView["status"], card: string | null, extra: Partial<FriendView> = {}): FriendView {
  const isValorant = status !== "offline" && status !== "online";
  return {
    puuid: `f-${name.toLowerCase()}`,
    game_name: name,
    tag_line: tag,
    status,
    detail: "",
    party_size: 1,
    note: "",
    last_online_ms: null,
    card_small: card ? `${MEDIA}/playercards/${card}/smallart.png` : null,
    account_level: isValorant ? 40 + ((name.length * 53) % 300) : null,
    queue: isValorant ? "Competitive" : "",
    product: status === "offline" ? "" : status === "online" ? "league_of_legends" : "valorant",
    ...extra,
  };
}

export const FRIENDS: FriendView[] = [
  friend("Luna", "EUW", "menus", CARDS.clove),
  friend("Ghost", "0001", "menus", CARDS.neon, { party_size: 2, queue: "Unrated" }),
  friend("BoomBot", "777", "queueing", CARDS.glitchpop, { queue: "Swiftplay" }),
  friend("Skyline", "333", "in_match", CARDS.spectrum, { detail: "Lotus 9-6", party_size: 3 }),
  friend("Mia", "FR", "agent_select", CARDS.jett),
  friend("Rook", "LOL", "online", null, { detail: "league_of_legends" }),
  friend("Tom", "1312", "away", CARDS.prime),
  friend("Ivy", "IVY", "offline", CARDS.rgx, { last_online_ms: Date.now() - 5 * 3600 * 1000 }),
  friend("Max", "99", "offline", CARDS.hush, { last_online_ms: Date.now() - 3 * 86400 * 1000 }),
];
