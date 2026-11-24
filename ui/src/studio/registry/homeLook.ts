// Registry entries for a style's own Play, Modes, Rank, Profile, Agent select, Lobby, News,
// Progress, Chat and Results looks.
// Each look does its job's standard piece's work, so it takes that piece's screens and sizes from here instead of
// every style file repeating them (and drifting from the standard piece when it changes).
import type { Component } from "solid-js";
import type { PieceDef, PieceProps } from "./types";

export type HomeJob =
  | "play"
  | "modes"
  | "rank"
  | "profile"
  | "pick"
  | "lobby"
  | "news"
  | "progress"
  | "chat"
  | "results";

type Frame = Pick<PieceDef, "stages" | "size" | "minPx"> &
  Partial<Pick<PieceDef, "category" | "defaults" | "fields" | "layouts" | "autoLayouts" | "layoutMinPx">>;

/** Every party chat line's arrangements (pieces/styled/chatLayouts.module.css); a tall piece
 *  shows the chat box on its own, a tiny one its icon. */
export const CHAT_LAYOUTS: Pick<PieceDef, "layouts" | "autoLayouts" | "layoutMinPx"> = {
  layouts: [
    { value: "line", label: "Line" },
    { value: "box", label: "Chat box" },
    { value: "icon", label: "Icon" },
  ],
  autoLayouts: { large: "box", tiny: "icon" },
  layoutMinPx: { box: { w: 220, h: 140 }, icon: { w: 32, h: 32 } },
};

/** Screens and sizes of the standard play-bar, queue-picker, rank-card, identity, agent-picker
 *  and lobby pieces; news, progress and chat are widgets like the standard ones, at the sizes
 *  of the CS:GO news and glass progress and chat looks (a list needs more room than tiles). */
const JOB_FRAME: Record<HomeJob, Frame> = {
  play: { stages: ["home", "play", "agents"], size: { w: 0.32, h: 0.14 }, minPx: { w: 220, h: 64 } },
  modes: { stages: ["play", "home"], size: { w: 0.5, h: 0.6 }, minPx: { w: 260, h: 200 } },
  rank: { stages: null, size: { w: 0.3, h: 0.24 }, minPx: { w: 220, h: 120 } },
  profile: { stages: null, size: { w: 0.28, h: 0.2 }, minPx: { w: 220, h: 96 } },
  pick: { stages: ["agent-select"], size: { w: 0.62, h: 0.78 }, minPx: { w: 360, h: 320 } },
  lobby: { stages: null, size: { w: 0.6, h: 0.6 }, minPx: { w: 260, h: 200 } },
  news: { stages: null, size: { w: 0.42, h: 0.62 }, minPx: { w: 240, h: 200 }, category: "widget" },
  progress: { stages: null, size: { w: 0.7, h: 0.7 }, minPx: { w: 480, h: 300 }, category: "widget" },
  results: { stages: ["post-match", "career", "home", "live"], size: { w: 0.94, h: 0.94 }, minPx: { w: 520, h: 360 } },
  chat: {
    stages: null,
    size: { w: 0.23, h: 0.04 },
    minPx: { w: 180, h: 32 },
    category: "widget",
    // The standard chat line's label, so it survives switching looks.
    defaults: { label: "" },
    fields: [{ key: "label", label: "Label", type: "text", placeholder: "Party:" }],
    ...CHAT_LAYOUTS,
  },
};

export interface HomeLookSpec {
  kind: string;
  job: HomeJob;
  label: string;
  description: string;
  icon: Component<{ size?: number }>;
  component: Component<PieceProps>;
}

/** A style's look of a home job, registered like any core piece. */
export function homeLook(spec: HomeLookSpec): PieceDef {
  return {
    kind: spec.kind,
    label: spec.label,
    description: spec.description,
    icon: spec.icon,
    category: "core",
    defaults: {},
    fields: [],
    ...JOB_FRAME[spec.job],
    component: spec.component,
  };
}
