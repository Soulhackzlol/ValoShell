// Demo backend read-only views: the store, progress, stats, history, cosmetics and skin
// lists the preview answers with. Built from demoData; nothing here changes over time.
import type { AgentOfferView } from "~/bindings/AgentOfferView";
import type { CareerView } from "~/bindings/CareerView";
import type { HistoryView } from "~/bindings/HistoryView";
import type { CosmeticKind } from "~/bindings/CosmeticKind";
import type { CosmeticOption } from "~/bindings/CosmeticOption";
import type { IdentityView } from "~/bindings/IdentityView";
import type { LeaderboardView } from "~/bindings/LeaderboardView";
import type { NewsView } from "~/bindings/NewsView";
import type { MatchRow } from "~/bindings/MatchRow";
import type { MemberView } from "~/bindings/MemberView";
import type { PregamePlayerView } from "~/bindings/PregamePlayerView";
import type { ProgressView } from "~/bindings/ProgressView";
import type { SkinCard } from "~/bindings/SkinCard";
import type { SkinOption } from "~/bindings/SkinOption";
import type { StatLine } from "~/bindings/StatLine";
import type { StatsView } from "~/bindings/StatsView";
import type { StoreItem } from "~/bindings/StoreItem";
import type { StoreView } from "~/bindings/StoreView";
import { MEDIA, playerCard, CARDS, SKINS_BY_NAME, skinArt, title, rank, mapArt, LEADER_NAMES, HISTORY_MAPS, DEMO_PARTY_SIZES, WEAPONS, chromaArt, weaponSkins } from "./demoData";

export function storeItem(name: string, price: number, discounted: number | null = null, currency = "vp", edition: string | null = null, image: string | null = skinArt(name)): StoreItem {
  const slug = name.toLowerCase().replace(/\W+/g, "-");
  return {
    id: `demo-${slug}`,
    skin_id: currency === "vp" ? `demo-skin-${slug}` : null,
    name,
    image,
    price,
    discounted_price: discounted,
    discount_percent: discounted === null ? null : Math.round((1 - discounted / price) * 100),
    currency,
    edition,
  };
}

export function demoStore(): StoreView {
  return {
    daily: [
      storeItem("Reaver Vandal", 1775, null, "vp", "Premium"),
      storeItem("Prime Spectre", 1775, null, "vp", "Premium"),
      storeItem("Oni Phantom", 1775, null, "vp", "Premium"),
      storeItem("Glitchpop Odin", 2175, null, "vp", "Exclusive"),
    ],
    daily_ends_in_s: 9 * 3600 + 1234,
    bundles: [
      {
        name: "Neo Frontier",
        image: `${MEDIA}/bundles/4d368017-4f98-1e89-dbec-31abd2533eb9/displayicon.png`,
        price: 8700,
        discounted_price: 5829,
        ends_in_s: 5 * 86400 + 3600,
        items: [storeItem("Neo Frontier Sheriff", 2175, 1458), storeItem("Neo Frontier Phantom", 2175, 1458), storeItem("Neo Frontier Axe", 4350, 2915, "vp", null, `${MEDIA}/weaponskins/cdcfab50-425d-6410-7a54-6aa913b7ce48/displayicon.png`)],
      },
      {
        name: "VCT x LOUD",
        image: `${MEDIA}/bundles/8feb9ed1-441a-73b6-55ed-ff836011701e/displayicon.png`,
        price: 2175,
        discounted_price: null,
        ends_in_s: 9 * 86400,
        items: [storeItem("VCT x LOUD Classic", 2175, null, "vp", null, `${MEDIA}/weaponskins/0aa66a21-41d9-8c50-f2ef-3988b57bfd52/displayicon.png`)],
      },
    ],
    night_market: [storeItem("Elderflame Operator", 2475, 1237), storeItem("Ion Phantom", 1775, 1065), storeItem("Sakura Classic", 875, 525)],
    night_market_ends_in_s: 6 * 86400,
    accessories: [
      storeItem("Hush Card", 4000, null, "kc", null, `${MEDIA}/playercards/${CARDS.hush}/largeart.png`),
      storeItem("Clutch Spray", 2000, null, "kc", null, `${MEDIA}/sprays/890c4f6d-4794-3d88-617b-1b906c7a8ea6/fulltransparenticon.png`),
      storeItem("The Spike Buddy", 3000, null, "kc", null, `${MEDIA}/buddies/0ec28d81-498c-af58-722c-baa60a84151c/displayicon.png`),
    ],
    accessories_end_in_s: 3 * 86400,
    observed_at_ms: Date.now(),
  };
}

export function demoCareer(): CareerView {
  const diamond = rank(18, "Diamond 1", "b87de8ff");
  const plat = rank(17, "Platinum 3", "4fbfd4ff");
  const maps = ["Ascent", "Bind", "Lotus", "Haven", "Split", "Sunset", "Icebox", "Pearl"];
  const earned = [21, -14, 18, 23, -9, 17, -19, 24, 15, -12];
  let rr = 41;
  const updates = earned.map((delta, index) => {
    const after = rr;
    rr -= delta;
    return {
      match_id: `demo-match-${index}`,
      map_name: maps[index % maps.length] ?? "Ascent",
      map_image: mapArt(maps[index % maps.length] ?? "Ascent", "listviewicon"),
      started_at_ms: Date.now() - index * 20 * 3600 * 1000,
      rr_earned: delta,
      rr_after: after < 0 ? after + 100 : after,
      rank_after: after < 0 ? plat : diamond,
      is_promotion: index === 3,
      is_demotion: false,
      afk_penalty: 0,
    };
  });
  return { rank: diamond, rr: 41, leaderboard_rank: 0, wins: 34, games: 61, peak: rank(19, "Diamond 2", "b87de8ff"), placements_left: 0, updates, premier: { name: "SinMira", tag: "SM", is_enrolled: true, division: 7, wins: 9, games: 12 } };
}

/** EU's top 50 with a few hidden names; the demo player sits lower and is pinned below. */
export function demoLeaderboard(): LeaderboardView {
  const radiant = rank(27, "Radiant", "ffffaaff");
  const immortal = rank(26, "Immortal 3", "bb3d65ff");
  const cards = Object.values(CARDS);
  const rows = Array.from({ length: 50 }, (_, index) => ({
    rank: index + 1,
    game_name: index % 7 === 3 ? "" : `${LEADER_NAMES[index % LEADER_NAMES.length]}${index >= LEADER_NAMES.length ? index : ""}`,
    tag_line: index % 7 === 3 ? "" : "EUW",
    is_anonymized: index % 7 === 3,
    is_self: false,
    rr: 1180 - index * 9,
    wins: 240 - index * 2,
    tier: index < 30 ? radiant : immortal,
    card_small: playerCard(cards[index % cards.length] ?? CARDS.prime).card_small,
  }));
  const own = { rank: 812, game_name: "s1moscs", tag_line: "EUW", is_anonymized: false, is_self: true, rr: 281, wins: 96, tier: immortal, card_small: playerCard(CARDS.hush).card_small };
  return { region: "EU", total_players: 15_420, rows, own_row: own };
}

export const DEMO_SPRAYS: ReadonlyArray<[string, string]> = [
  ["0eb56d06-474d-fbec-372f-069286388bc5", "G.O.A.T. Spray"],
  ["d52d5d56-46a7-957d-418d-e3b2b3bd6938", "Sad Crab Spray"],
  ["677dc003-4dbf-66a8-9116-4f8d7a9fb8d5", "No Time Spray"],
  ["2b2ae992-403a-f063-64e6-1dbaee43c95a", "No Toxicity Spray"],
  ["d4ceef7f-4e99-70d8-ac85-14850ac08cd3", "Dap Team Spray"],
];

export const DEMO_BUDDIES: ReadonlyArray<[string, string]> = [
  ["427fdd9a-41b7-5adb-729e-9ab323b26061", "Frequency Buddy"],
  ["f9e33f95-4d17-cd7e-3291-85b7f56bf183", "Anansi Buddy"],
  ["f3b997d0-439d-eaa2-5d82-0392e75e2fb1", "Araxys Buddy"],
];

export const DEMO_FLEX: ReadonlyArray<[string, string]> = [["fc33f376-4a58-687c-6961-bd8a7e529346", "ORA by OneTap Flex"]];

export const DEMO_TITLES: ReadonlyArray<[string, string]> = [
  ["a65074fd-4937-734e-20fe-3cafa842c631", "Catalyst"],
  ["2d284b12-4536-1d0e-b08c-e58850b2a76e", "Chicken"],
  ["326c3796-43c0-4aca-cd5e-53b3ccf8c507", "Foxy"],
];

/** One demo cosmetic with its valorant-api art, as the backend names it. */
export function demoCosmetic(kind: CosmeticKind, [id, name]: readonly [string, string]): CosmeticOption {
  const art: Record<CosmeticKind, string | null> = {
    card: `${MEDIA}/playercards/${id}/smallart.png`,
    title: null,
    spray: `${MEDIA}/sprays/${id}/fulltransparenticon.png`,
    flex: `${MEDIA}/flex/${id}/displayicon.png`,
    buddy: `${MEDIA}/buddies/${id}/displayicon.png`,
  };
  return { id, name, image: art[kind], wide_image: kind === "card" ? `${MEDIA}/playercards/${id}/wideart.png` : null };
}

export function demoCosmeticOptions(kind: CosmeticKind): CosmeticOption[] {
  const cards = Object.entries(CARDS).map(([name, uuid]): [string, string] => [uuid, `${name[0]?.toUpperCase() ?? ""}${name.slice(1)} Card`]);
  const all: Record<CosmeticKind, ReadonlyArray<[string, string]>> = { card: cards, title: DEMO_TITLES, spray: DEMO_SPRAYS, flex: DEMO_FLEX, buddy: DEMO_BUDDIES };
  return all[kind].map((entry) => demoCosmetic(kind, entry));
}

/** Built on first use: it reads `WEAPONS`, declared further down. */
export function initialDemoIdentity(): IdentityView {
  return {
    card: demoCosmeticOptions("card").find((card) => card.id === CARDS.hush) ?? null,
    title: demoCosmeticOptions("title")[0] ?? null,
    expressions: [
      { slot: 0, kind: "spray", item: demoCosmeticOptions("spray")[0] ?? null },
      { slot: 1, kind: "spray", item: demoCosmeticOptions("spray")[1] ?? null },
      { slot: 2, kind: "flex", item: demoCosmeticOptions("flex")[0] ?? null },
      { slot: 3, kind: "spray", item: null },
    ],
    buddies: WEAPONS.filter(([, category]) => category !== "Melee").map(([name], index) => ({
      weapon_id: `w-${name.toLowerCase()}`,
      weapon_name: name,
      buddy: index === 12 ? (demoCosmeticOptions("buddy")[0] ?? null) : null,
    })),
  };
}

/** A mid-act account: tier 16 of 55, two weekly missions under way and one done. */
export function demoProgress(): ProgressView {
  const weekly = (title: string, done: number, goal: number) => ({ title, done, goal, xp: 23_800, is_complete: done >= goal });
  return {
    account_level: 142,
    account_xp: 3100,
    battle_pass: {
      name: "Season 2026 // Act VI",
      tier: 16,
      tier_count: 55,
      xp_left: 7450,
      ends_at: new Date(Date.now() + 41 * 86_400_000).toISOString(),
      is_premium_owned: false,
      next_reward: { name: "Prime Spectre", image: skinArt("Prime Spectre") },
    },
    weekly_missions: [weekly("Use Your Abilities", 35, 200), weekly("Deal Damage", 1274, 18_000), weekly("Kill Enemies", 100, 100)],
    daily_missions: [],
    weekly_refill_at: "",
    recruitment: { agent_id: VYSE, agent_name: "Vyse", agent_icon: agentIcon(VYSE), xp: 86_400, xp_goal: 200_000, ends_at: new Date(Date.now() + 9 * 86_400_000).toISOString() },
    agent_contracts: [
      { agent_id: BRIMSTONE, agent_name: "Brimstone", agent_icon: agentIcon(BRIMSTONE), level: 7, level_count: 10 },
      { agent_id: SAGE, agent_name: "Sage", agent_icon: agentIcon(SAGE), level: 3, level_count: 10 },
    ],
  };
}

const VYSE = "efba5359-4016-a1e5-7626-b1ae76895940";
const FADE = "dade69b4-4f5a-8528-247b-219e5a1facd6";
const HARBOR = "95b78ed7-4637-86d9-7e41-71ba8c293152";
const BRIMSTONE = "9f0d8ba9-4140-b941-57d3-a7ad57c6b417";
const SAGE = "569fdd95-4d10-43ab-ca70-79becc718b46";

function agentIcon(uuid: string): string {
  return `${MEDIA}/agents/${uuid}/displayicon.png`;
}

/** Two of the demo's locked agents on sale (view only, like the real store). */
export function demoAgentStore(): AgentOfferView[] {
  const prices = [
    { currency: "vp", amount: 1000 },
    { currency: "kc", amount: 8000 },
  ];
  return [
    { agent_id: FADE, name: "Fade", image: agentIcon(FADE), prices },
    { agent_id: HARBOR, name: "Harbor", image: agentIcon(HARBOR), prices },
  ];
}

/** playvalorant.com's news as the app reads it (October 2026, Spanish). */
export function demoNews(): NewsView {
  const image = (id: string) => `https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/${id}.jpg?accountingTag=VAL&w=640`;
  const item = (title: string, category: string, id: string, url: string, published_at: string, summary: string) => ({ title, category, summary, image: image(id), url, published_at });
  return {
    items: [
      item("VOCÊ É BRABA // Game Changers Championship", "esports", "549e358e98eb8249c230b805a493bb11ec65b765-3840x2160", "https://www.youtube.com/watch?v=69sKYwsxUM8", "2026-10-20T15:00:00.000Z", "VCT Game Changers Championship 2026: del 22 de octubre al 1 de noviembre en São Paulo, Brasil."),
      item("¡ÁLZATE Y CAE! // Tráiler de Hush - VALORANT", "game_updates", "511ed3c6f31074a8225f6b9597d686f17eeef8d3-1920x1080", "https://www.youtube.com/watch?v=pyir73S9kFU", "2026-10-18T06:00:00.000Z", "Nueva agente duelista disponible en la Temporada 26 // ACTO VI"),
      item("Clasificatorias del Kickoff de VCT EMEA 2027", "esports", "a12af144cabbe2b642e799a596ed2d69c2712a25-3840x2160", "https://valorantesports.com/es-es/news/2027-vct-emea-kickoff-qualifiers", "2026-10-15T16:00:00.000Z", "Dad el primer paso hacia el VCT EMEA 2027. Inscribíos ya en las clasificatorias abiertas de EMEA"),
      item("LA ÚLTIMA PALABRA // Avance de agente - VALORANT", "game_updates", "561c2fe972b26b563bf2a0c58c329de7d234082a-1920x1080", "https://www.youtube.com/watch?v=kiaLEAFx_FA", "2026-10-15T12:00:00.000Z", "Pronto descubriréis quién tiene la última palabra."),
      item("VCT 2027: la gira mundial", "esports", "3ac79a3f7c8f8e4c452febf366629442e0ba2a87-1920x1080", "https://valorantesports.com/es-es/news/vct-2027-the-global-tour/", "2026-10-15T13:00:00.000Z", "El VALORANT Champions Tour se va de gira en 2027 con más torneos, más formas de competir y más VCT cerca de vosotros."),
    ],
    patch_version: "13.08",
    patch_url: "https://playvalorant.com/es-es/news/game-updates/valorant-patch-notes-13-08",
  };
}

/** One stats line: matches, wins, K/D/A, ACS, headshot %, ADR. */
export function statLine(name: string, icon: string | null, numbers: [number, number, number, number, number, number, number, number]): StatLine {
  const [matches, wins, kills, deaths, assists, acs, headshot, adr] = numbers;
  const kd = Math.round((kills / Math.max(1, deaths)) * 10) / 10;
  return { name, icon, matches, wins, win_rate: Math.round((wins / matches) * 1000) / 10, kills, deaths, assists, kd, acs, headshot_percent: headshot, adr };
}

/** The demo history's standard matches (deathmatch left out, like the backend). */
export function demoStats(): StatsView {
  const agent = (uuid: string) => `${MEDIA}/agents/${uuid}/displayicon.png`;
  const brimstone = agent("9f0d8ba9-4140-b941-57d3-a7ad57c6b417");
  return {
    overall: statLine("Overall", null, [8, 4, 66, 47, 49, 346, 24.6, 151.2]),
    by_agent: [statLine("Brimstone", brimstone, [8, 4, 66, 47, 49, 346, 24.6, 151.2])],
    by_map: [
      statLine("Abyss", mapArt("Abyss", "splash"), [2, 1, 13, 10, 4, 237, 21.0, 118.4]),
      statLine("Haven", mapArt("Haven", "splash"), [1, 1, 10, 6, 9, 424, 28.3, 176.0]),
      statLine("Bind", mapArt("Bind", "splash"), [1, 1, 10, 2, 4, 494, 31.2, 188.5]),
      statLine("Ascent", mapArt("Ascent", "splash"), [1, 1, 15, 9, 11, 358, 25.9, 160.1]),
      statLine("Lotus", mapArt("Lotus", "splash"), [1, 0, 11, 6, 5, 436, 22.4, 171.3]),
      statLine("Pearl", mapArt("Pearl", "splash"), [1, 0, 8, 10, 13, 253, 19.7, 120.9]),
      statLine("Corrode", mapArt("Corrode", "splash"), [1, 0, 3, 5, 2, 243, 18.0, 102.6]),
    ],
  };
}

/** Every demo skin as a wishlist card; ids match the demo store's `skin_id`. */
export function demoSkinCards(): SkinCard[] {
  return [...SKINS_BY_NAME.keys()].map((name) => ({
    skin_id: `demo-skin-${name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
    image: skinArt(name),
    weapon_name: name.split(" ").at(-1) ?? "",
    edition: null,
  }));
}

export function demoSearchSkins(query: string): SkinCard[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return demoSkinCards().filter((card) => words.every((word) => card.name.toLowerCase().includes(word)));
}

export function demoHistory(): HistoryView {
  const brimstone = "9f0d8ba9-4140-b941-57d3-a7ad57c6b417";
  const clove = "1dbf2edd-4729-0984-3115-daa5eed44993";
  const lines: [string, string, number, number, number, number, number, number, MatchRow["mvp"], number | null, number | null][] = [
    [brimstone, "swiftplay", 3, 5, 0, 231, 0, 5, null, null, null],
    [brimstone, "swiftplay", 3, 5, 2, 243, 1, 5, null, null, null],
    [brimstone, "swiftplay", 11, 6, 5, 436, 4, 5, "match", null, null],
    [brimstone, "swiftplay", 6, 4, 5, 328, 5, 4, null, null, null],
    [brimstone, "swiftplay", 10, 2, 4, 494, 5, 1, "match", null, null],
    [brimstone, "swiftplay", 10, 6, 9, 424, 4, 5, "match", null, null],
    [brimstone, "competitive", 15, 9, 11, 358, 13, 6, null, 19, null],
    [clove, "deathmatch", 5, 9, 3, 0, 0, 0, null, null, 7],
    [brimstone, "competitive", 8, 10, 13, 253, 13, 6, null, 16, null],
  ];
  const labels: Record<string, string> = { swiftplay: "Swiftplay", competitive: "Competitive", deathmatch: "Deathmatch" };
  return {
    rows: lines.map(([agent, queue, kills, deaths, assists, score, won, lost, mvp, rr, place], index) => ({
      match_id: `demo-history-${index}`,
      queue_id: queue,
      queue_label: labels[queue] ?? queue,
      map_name: HISTORY_MAPS[index % HISTORY_MAPS.length] ?? "Abyss",
      map_splash: mapArt(HISTORY_MAPS[index % HISTORY_MAPS.length] ?? "Abyss", "splash"),
      agent_name: agent === clove ? "Clove" : "Brimstone",
      agent_icon: `${MEDIA}/agents/${agent}/displayicon.png`,
      kills,
      deaths,
      assists,
      score,
      result: queue === "deathmatch" ? "defeat" : won > lost ? "victory" : won < lost ? "defeat" : "draw",
      rounds_won: won,
      rounds_lost: lost,
      placement: place,
      // Solo, duo and trio nights, so the history's party marks have something to show.
      party_size: queue === "deathmatch" ? 1 : (DEMO_PARTY_SIZES[index % DEMO_PARTY_SIZES.length] ?? 1),
      mvp: mvp ?? null,
      rr_change: rr,
      started_at_ms: Date.now() - index * 3 * 3600 * 1000,
    })),
  };
}

export function demoSkinOptions(weaponId: string): SkinOption[] {
  const name = WEAPONS.find(([weapon]) => `w-${weapon.toLowerCase()}` === weaponId)?.[0] ?? "Weapon";
  const [weaponUuid, skins] = weaponSkins(name);
  const standard: SkinOption = {
    skin_id: `s-${name}`,
    name,
    image: weaponUuid ? `${MEDIA}/weapons/${weaponUuid}/displayicon.png` : null,
    chromas: [],
    owned_levels: 1,
    total_levels: 1,
    levels: [{ level_id: `l-${name}-0`, name, effect: null, video: null, is_owned: true }],
    edition: null,
  };
  return [
    standard,
    ...skins.map(([skin, icon, edition, levelCount, chromas], index): SkinOption => {
      const owned = Math.min(levelCount, 2 + (index % 3));
      return {
        skin_id: `s-${skin}`,
        name: skin,
        image: `${MEDIA}/${icon}`,
        chromas: chromas.map(([chromaName, uuid, hasSwatch], chroma) => ({
          chroma_id: uuid,
          name: chromaName,
          swatch: hasSwatch ? chromaArt(uuid, "swatch") : null,
          image: chromaArt(uuid, "fullrender"),
          video: null,
          is_owned: chroma < 2,
        })),
        owned_levels: owned,
        total_levels: levelCount,
        levels: Array.from({ length: levelCount }, (_, level) => ({
          level_id: `l-${skin}-${level}`,
          name: level === 0 ? skin : `${skin} Level ${level + 1}`,
          effect: level === 0 ? null : (["VFX", "Animation", "Finisher", "Kill Banner"][level - 1] ?? null),
          video: null,
          is_owned: level < owned,
        })),
        edition,
      };
    }),
  ];
}

export function pregamePlayer(memberView: MemberView): PregamePlayerView {
  return {
    puuid: memberView.puuid,
    is_self: memberView.is_self,
    game_name: memberView.game_name,
    tag_line: memberView.tag_line,
    agent_uuid: null,
    agent_name: null,
    agent_icon: null,
    selection: "",
    account_level: memberView.account_level,
    rank: memberView.rank,
  };
}
