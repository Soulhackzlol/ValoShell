// Pieces that do the same job in different styles' looks: Glass agents, the CS2 agent inventory
// and the Night City merc database are all "Agents". Studio offers each job once (adding it
// places the current style's look) and lets a placed piece switch looks in place, instead of
// listing every style's copy separately. A style's piece with no job here is one of its extras.
import {
  Backpack,
  ClipboardList,
  Crosshair,
  Gauge,
  IdCard,
  LayoutList,
  MessageSquare,
  MousePointerClick,
  Newspaper,
  Play,
  ShoppingBag,
  Swords,
  Target,
  Trophy,
  Users,
  UsersRound,
} from "lucide-solid";
import type { Component } from "solid-js";
import { pieceFamily, skinShortLabel } from "../skins";
import type { Skin } from "../types";
import type { PieceDef } from "./types";

/** Whether a kind may go on the screen being edited (registry/index.ts `isKindAllowedOn`). */
export type IsAllowed = (kind: string) => boolean;

export type JobId =
  | "party"
  | "play"
  | "modes"
  | "agents"
  | "friends"
  | "rank"
  | "store"
  | "career"
  | "profile"
  | "news"
  | "pick"
  | "lobby"
  | "results"
  | "collection"
  | "progress"
  | "chat";

export interface Job {
  id: JobId;
  label: string;
  icon: Component<{ size?: number }>;
  /** The look used where a style has none of its own. */
  standard: string;
  /** Every style's own look of it. */
  looks: readonly string[];
}

export const JOBS: readonly Job[] = [
  {
    id: "party",
    label: "Party",
    icon: Users,
    standard: "party-lineup",
    looks: [
      "glass-party",
      "beta-lineup",
      "val-lineup",
      "v22-party",
      "cs16-party",
      "cs2-party",
      "csgo-party",
      "fn-party",
      "halo-roster",
      "lol-party",
      "mc-party",
      "nc-party",
      "ph-party",
      "pip-party",
      "terminal-party",
    ],
  },
  {
    id: "play",
    label: "Play button",
    icon: Play,
    standard: "play-bar",
    looks: [
      "glass-play",
      "beta-play",
      "v22-play",
      "cs16-play",
      "cs2-play",
      "csgo-play",
      "val-find",
      "fn-play",
      "nc-play",
      "terminal-play",
      "mc-play",
      "halo-play",
      "pip-play",
      "lol-play",
      "ph-play",
    ],
  },
  {
    id: "modes",
    label: "Modes",
    icon: LayoutList,
    standard: "queue-picker",
    looks: [
      "glass-modes",
      "val-modes",
      "halo-playlists",
      "fn-discover",
      "nc-gigs",
      "ph-missions",
      "pip-quests",
      "terminal-queue",
      "mc-worlds",
      "beta-modes",
      "v22-modes",
      "csgo-modes",
      "cs2-modes",
      "cs16-modes",
      "lol-modes",
    ],
  },
  {
    id: "agents",
    label: "Agents",
    icon: Crosshair,
    standard: "val-agents",
    looks: [
      "glass-agents",
      "beta-agents",
      "v22-agents",
      "cs16-agents",
      "cs2-agents",
      "csgo-agents",
      "fn-agents",
      "halo-agents",
      "lol-agents",
      "mc-agents",
      "nc-agents",
      "ph-agents",
      "pip-agents",
      "terminal-agents",
    ],
  },
  {
    id: "friends",
    label: "Friends",
    icon: UsersRound,
    standard: "friends",
    looks: [
      "glass-friends",
      "beta-social",
      "v22-friends",
      "cs16-browser",
      "cs2-friends",
      "csgo-social",
      "fn-friends",
      "halo-friends",
      "lol-friends",
      "mc-friends",
      "nc-friends",
      "ph-friends",
      "pip-friends",
      "terminal-friends",
    ],
  },
  {
    id: "rank",
    label: "Rank",
    icon: Gauge,
    standard: "rank-card",
    looks: [
      "glass-rank",
      "val-rank",
      "beta-rank",
      "v22-rank",
      "cs2-rating",
      "csgo-skill",
      "cs16-rank",
      "terminal-rank",
      "fn-rank",
      "mc-rank",
      "halo-rank",
      "pip-rank",
      "lol-rank",
      "ph-rank",
      "nc-rank",
    ],
  },
  {
    id: "store",
    label: "Store",
    icon: ShoppingBag,
    standard: "store-front",
    looks: ["val-store", "csgo-store", "fn-shop", "mc-trades"],
  },
  { id: "career", label: "Career", icon: Trophy, standard: "service-record", looks: ["val-career", "mc-stats"] },
  {
    id: "profile",
    label: "Profile",
    icon: IdCard,
    standard: "identity",
    looks: [
      "glass-hello",
      "csgo-profile",
      "beta-dossier",
      "val-profile",
      "v22-profile",
      "cs2-profile",
      "cs16-profile",
      "terminal-profile",
      "fn-profile",
      "mc-profile",
      "halo-profile",
      "pip-profile",
      "lol-profile",
      "ph-profile",
      "nc-profile",
    ],
  },
  {
    id: "news",
    label: "News",
    icon: Newspaper,
    standard: "val-news",
    looks: [
      "csgo-news",
      "beta-news",
      "v22-news",
      "cs2-news",
      "cs16-news",
      "terminal-news",
      "fn-news",
      "mc-news",
      "halo-news",
      "pip-news",
      "lol-news",
      "ph-news",
      "nc-news",
      "glass-news",
    ],
  },
  {
    id: "pick",
    label: "Agent select",
    icon: MousePointerClick,
    standard: "agent-picker",
    looks: [
      "glass-pick",
      "val-pick",
      "beta-pick",
      "v22-pick",
      "csgo-pick",
      "cs2-pick",
      "cs16-pick",
      "terminal-pick",
      "fn-pick",
      "mc-pick",
      "halo-pick",
      "pip-pick",
      "lol-pick",
      "ph-pick",
      "nc-pick",
    ],
  },
  {
    id: "lobby",
    label: "Lobby",
    icon: Swords,
    standard: "lobby",
    looks: [
      "glass-lobby",
      "val-match",
      "beta-match",
      "v22-match",
      "csgo-match",
      "cs2-match",
      "cs16-match",
      "terminal-match",
      "fn-match",
      "mc-match",
      "halo-match",
      "pip-match",
      "lol-match",
      "ph-match",
      "nc-match",
    ],
  },
  {
    id: "results",
    label: "Match results",
    icon: Target,
    standard: "post-match",
    looks: [
      "glass-results",
      "beta-results",
      "v22-results",
      "csgo-results",
      "cs2-results",
      "cs16-results",
      "terminal-results",
      "fn-results",
      "mc-results",
      "halo-results",
      "pip-results",
      "lol-results",
      "ph-results",
      "nc-results",
    ],
  },
  { id: "collection", label: "Collection", icon: Backpack, standard: "weapon-wall", looks: ["val-collection"] },
  {
    id: "progress",
    label: "Progress",
    icon: ClipboardList,
    standard: "val-progress",
    looks: [
      "glass-progress",
      "beta-progress",
      "v22-progress",
      "csgo-progress",
      "cs2-progress",
      "cs16-progress",
      "terminal-progress",
      "fn-progress",
      "mc-progress",
      "halo-progress",
      "pip-progress",
      "lol-progress",
      "ph-progress",
      "nc-progress",
    ],
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    standard: "val-chat",
    looks: [
      "glass-chat",
      "beta-chat",
      "v22-chat",
      "csgo-chat",
      "cs2-chat",
      "cs16-chat",
      "terminal-chat",
      "fn-chat",
      "mc-chat",
      "halo-chat",
      "pip-chat",
      "lol-chat",
      "ph-chat",
      "nc-chat",
    ],
  },
];

const JOB_OF_KIND = new Map(JOBS.flatMap((job) => [job.standard, ...job.looks].map((kind) => [kind, job] as const)));

/** The job a piece kind does, or undefined for widgets and a style's extras. */
export function jobOf(kind: string): Job | undefined {
  return JOB_OF_KIND.get(kind);
}

/** Every look of a job allowed here, the standard one first. */
export function looksOf(job: Job, isAllowed: IsAllowed): string[] {
  return [job.standard, ...job.looks].filter(isAllowed);
}

/** What adding the job places: the style's own look, else the standard one, else any allowed. */
export function kindForJob(job: Job, skin: Skin, isAllowed: IsAllowed): string | undefined {
  const allowed = looksOf(job, isAllowed);
  const own = allowed.find((kind) => pieceFamily(kind) === skin);
  return own ?? allowed.find((kind) => kind === job.standard) ?? allowed[0];
}

/** A look's name in the picker: its style, or "Standard" for the menu's own piece. */
export function lookLabel(kind: string): string {
  const family = pieceFamily(kind);
  return family ? skinShortLabel(family) : "Standard";
}

/** The layout value of a look's own screen, for looks that had no layouts of their own. */
export const ORIGINAL_LAYOUT = "original";

/**
 * A style's look of a job (registry/jobs.ts) also offers the job's shared arrangements: the
 * standard piece's layouts the look doesn't draw itself. Picking one draws the standard piece
 * dressed in the look's materials (theme/materials.css), so the look (style) and the layout
 * (arrangement) stay separate choices. The look's own layouts stay first, so nothing placed
 * before changes; its size rules (autoLayouts) stay its own.
 */
export function withSharedLayouts(def: PieceDef, byKind: ReadonlyMap<string, PieceDef>): PieceDef {
  const job = jobOf(def.kind);
  const standard = job ? byKind.get(job.standard) : undefined;
  if (!standard?.layouts || standard === def) return def;
  const own = def.layouts ?? [{ value: ORIGINAL_LAYOUT, label: "Original" }];
  const shared = standard.layouts.filter((option) => !own.some((mine) => mine.value === option.value));
  if (shared.length === 0) return def;
  const minOf = (layout: string) => standard.layoutMinPx?.[layout] ?? standard.minPx;
  const sharedMin = Object.fromEntries(shared.map((option) => [option.value, minOf(option.value)]));
  return {
    ...def,
    layouts: [...own, ...shared],
    layoutMinPx: { ...sharedMin, ...def.layoutMinPx },
    shared: { def: standard, layouts: shared.map((option) => option.value) },
  };
}

/** The definition that draws `layout`: the job's standard piece for a shared arrangement. */
export function drawnDef(def: PieceDef, layout: string | null): PieceDef {
  return layout && def.shared?.layouts.includes(layout) ? def.shared.def : def;
}
