// Each menu style's own screens: which pieces Home, Play, Career and Store hold and where. A style
// that leaves a screen out keeps whatever the player built there.
import { piece } from "../defaults";
import type { Piece, Skin, StageId } from "../types";

/** Stages a style may lay out; any it doesn't keep whatever the player made. */
export const STYLED_STAGES: readonly StageId[] = ["home", "play", "agents", "collection", "career", "store"];

/** The current client's scene is the screen minus its 60 px social strip (--nav-right). */
const VAL_W = 1860 / 1920;

/** A rect measured on the whole 1920-wide client screen, as a fraction of that scene. */
function onClient(x: number, y: number, w: number, h: number) {
  return { x: x / VAL_W, y, w: w / VAL_W, h };
}

export type Layout = Partial<Record<StageId, () => Piece[]>>;

/** Where a style's store front sits: nearly the whole screen; the piece picks the look. */
const FRONT_RECT = { x: 0.03, y: 0.04, w: 0.94, h: 0.92 };

export const LAYOUTS: Record<Skin, Layout> = {
  // Modern uses the default stages.
  modern: {},
  glass: {
    agents: () => [piece("glass-agents", { x: 0.03, y: 0.03, w: 0.72, h: 0.94 }, 1), piece("glass-friends", { x: 0.775, y: 0.03, w: 0.205, h: 0.94 }, 2)],
    home: () => [
      piece("glass-hello", { x: 0.03, y: 0.03, w: 0.5, h: 0.12 }, 1),
      piece("glass-rank", { x: 0.535, y: 0.04, w: 0.215, h: 0.1 }, 6),
      piece("glass-party", { x: 0.03, y: 0.18, w: 0.72, h: 0.58 }, 2),
      piece("glass-play", { x: 0.17, y: 0.79, w: 0.44, h: 0.18 }, 3),
      piece("glass-friends", { x: 0.775, y: 0.03, w: 0.205, h: 0.94 }, 4),
    ],
    play: () => [
      piece("glass-modes", { x: 0.03, y: 0.03, w: 0.72, h: 0.72 }, 1),
      piece("glass-play", { x: 0.17, y: 0.79, w: 0.44, h: 0.18 }, 2),
      piece("glass-friends", { x: 0.775, y: 0.03, w: 0.205, h: 0.94 }, 3),
    ],
    career: () => [
      piece("glass-hello", { x: 0.03, y: 0.03, w: 0.6, h: 0.12 }, 1),
      piece("service-record", { x: 0.03, y: 0.18, w: 0.94, h: 0.78 }, 2),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  // Measured off the 1920x1080 client: 48 px top bar, 60 px social strip on the right.
  current: {
    home: () => [
      piece("val-banner", onClient(0, 0, 0.2405, 0.4118), 1),
      piece("val-corner", onClient(0.78125, 0.6783, 0.1875, 0.3217), 2),
      piece("val-dailies", onClient(0.4, 0.0445, 0.17, 0.06), 3),
      piece("val-mode", onClient(0.0208, 0.2907, 0.125, 0.42), 4),
      piece("val-lineup", onClient(0.223, 0.2043, 0.522, 0.581), 5),
      // Only drawn in a custom lobby, where the lineup steps aside: 353, 307, 1150 x 496 px on
      // screen, so y counts from under the 48 px bar (1032 px tall).
      piece("val-custom", onClient(0.18385, 0.25097, 0.59896, 0.48062), 6),
      piece("val-find", onClient(0.427, 0.8858, 0.114, 0.0484), 7),
      piece("val-news", onClient(0.823, 0.1307, 0.124, 0.688), 8),
      piece("val-chat", onClient(0, 0.961, 0.232, 0.039), 9),
    ],
    play: () => [
      piece("val-modes", onClient(0.06, 0.06, 0.86, 0.72), 1),
      piece("val-find", onClient(0.427, 0.8858, 0.114, 0.0484), 2),
      piece("val-chat", onClient(0, 0.961, 0.232, 0.039), 3),
    ],
    agents: () => [piece("val-agents", { x: 0, y: 0, w: 1, h: 1 }, 1)],
    collection: () => [
      piece("val-collection", { x: 0, y: 0, w: 1, h: 1 }, 1),
      piece("val-chat", onClient(0, 0.965, 0.232, 0.035), 2),
    ],
    career: () => [
      piece("val-career", { x: 0, y: 0, w: 1, h: 1 }, 1),
      piece("val-chat", onClient(0, 0.961, 0.232, 0.039), 2),
    ],
    store: () => [
      piece("val-store", { x: 0, y: 0, w: 1, h: 1 }, 1),
      piece("val-chat", onClient(0, 0.961, 0.232, 0.039), 2),
    ],
  },
  beta: {
    home: () => [
      piece("beta-pills", { x: 0.36, y: 0.12, w: 0.24, h: 0.05 }, 1),
      piece("beta-lineup", { x: 0.11, y: 0.22, w: 0.74, h: 0.64 }, 2),
      piece("beta-social", { x: 0.885, y: 0, w: 0.115, h: 1 }, 3),
    ],
    play: () => [
      piece("queue-picker", { x: 0.04, y: 0.2, w: 0.5, h: 0.74 }, 1),
      piece("party-tools", { x: 0.57, y: 0.2, w: 0.28, h: 0.74 }, 2),
      piece("beta-social", { x: 0.885, y: 0, w: 0.115, h: 1 }, 3),
    ],
    career: () => [
      piece("service-record", { x: 0.04, y: 0.15, w: 0.81, h: 0.8 }, 1),
      piece("beta-social", { x: 0.885, y: 0, w: 0.115, h: 1 }, 3),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  valnow: {
    // The 2022 home: PLAY top-centre over the party, the social panel down the right.
    home: () => [
      piece("v22-play", { x: 0.25, y: 0.02, w: 0.3, h: 0.16 }, 1),
      piece("v22-party", { x: 0.03, y: 0.21, w: 0.74, h: 0.74 }, 2),
      piece("v22-friends", { x: 0.8, y: 0.02, w: 0.18, h: 0.96 }, 3),
    ],
    agents: () => [
      piece("v22-agents", { x: 0.03, y: 0.04, w: 0.74, h: 0.92 }, 1),
      piece("v22-friends", { x: 0.8, y: 0.02, w: 0.18, h: 0.96 }, 2),
    ],
    play: () => [
      piece("queue-picker", { x: 0.03, y: 0.04, w: 0.62, h: 0.9 }, 1),
      piece("party-tools", { x: 0.68, y: 0.04, w: 0.29, h: 0.9 }, 2),
    ],
    career: () => [
      piece("service-record", { x: 0.03, y: 0.04, w: 0.94, h: 0.9 }, 1),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  csgo: {
    agents: () => [piece("csgo-agents", FRONT_RECT, 1)],
    home: () => [
      piece("csgo-profile", { x: 0.146, y: 0.1, w: 0.203, h: 0.17 }, 1),
      piece("csgo-store", { x: 0.364, y: 0.1, w: 0.487, h: 0.17 }, 2),
      piece("csgo-social", { x: 0.146, y: 0.3, w: 0.203, h: 0.615 }, 3),
      piece("csgo-news", { x: 0.364, y: 0.3, w: 0.487, h: 0.67 }, 4),
      // Panorama keeps party chat under the friends list, not in the corner.
      piece("csgo-chat", { x: 0.146, y: 0.93, w: 0.203, h: 0.04 }, 5),
    ],
    play: () => [
      piece("csgo-play", { x: 0.146, y: 0.1, w: 0.42, h: 0.82 }, 1, { showModes: true }),
      piece("party-tools", { x: 0.58, y: 0.1, w: 0.27, h: 0.56 }, 2),
      piece("csgo-skill", { x: 0.58, y: 0.69, w: 0.27, h: 0.23 }, 3),
    ],
    career: () => [
      piece("csgo-profile", { x: 0.146, y: 0.1, w: 0.3, h: 0.2 }, 1),
      piece("csgo-skill", { x: 0.146, y: 0.33, w: 0.3, h: 0.24 }, 2),
      piece("rr-history", { x: 0.47, y: 0.1, w: 0.38, h: 0.82 }, 3),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  cs2: {
    agents: () => [piece("cs2-agents", FRONT_RECT, 1)],
    home: () => [
      piece("cs2-rating", { x: 0.015, y: 0.03, w: 0.22, h: 0.24 }, 1),
      piece("store-bundle", { x: 0.015, y: 0.3, w: 0.22, h: 0.42 }, 2),
      piece("party-lineup", { x: 0.26, y: 0.04, w: 0.66, h: 0.68 }, 3),
      piece("cs2-friends", { x: 0.945, y: 0.03, w: 0.045, h: 0.7 }, 4),
      piece("cs2-play", { x: 0.48, y: 0.8, w: 0.5, h: 0.15 }, 5, { showMaps: false }),
    ],
    play: () => [
      piece("cs2-play", { x: 0.03, y: 0.04, w: 0.64, h: 0.92 }, 1, { showMaps: true }),
      piece("party-tools", { x: 0.7, y: 0.04, w: 0.22, h: 0.62 }, 2),
      piece("cs2-rating", { x: 0.7, y: 0.7, w: 0.22, h: 0.26 }, 3),
      piece("cs2-friends", { x: 0.945, y: 0.04, w: 0.045, h: 0.7 }, 4),
    ],
    career: () => [
      piece("cs2-rating", { x: 0.04, y: 0.04, w: 0.36, h: 0.3 }, 1),
      piece("rank-card", { x: 0.04, y: 0.38, w: 0.36, h: 0.34 }, 2),
      piece("rr-history", { x: 0.44, y: 0.04, w: 0.52, h: 0.9 }, 3),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  cs16: {
    home: () => [
      piece("cs16-browser", { x: 0.42, y: 0.06, w: 0.52, h: 0.42 }, 1),
      piece("cs16-play", { x: 0.6, y: 0.52, w: 0.34, h: 0.42 }, 2),
    ],
    play: () => [
      piece("cs16-play", { x: 0.06, y: 0.12, w: 0.36, h: 0.6 }, 1),
      piece("cs16-browser", { x: 0.46, y: 0.12, w: 0.48, h: 0.6 }, 2),
    ],
    agents: () => [piece("cs16-agents", { x: 0.2, y: 0.08, w: 0.72, h: 0.8 }, 1)],
    career: () => [
      piece("service-record", { x: 0.08, y: 0.08, w: 0.82, h: 0.82 }, 1),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  // The console stops short of the bottom-left corner, where the chat chip sits.
  terminal: {
    home: () => [
      piece("terminal-console", { x: 0.02, y: 0.03, w: 0.4, h: 0.87 }, 1),
      piece("terminal-party", { x: 0.44, y: 0.03, w: 0.54, h: 0.87 }, 2),
    ],
    play: () => [
      piece("terminal-console", { x: 0.02, y: 0.03, w: 0.5, h: 0.87 }, 1),
      piece("terminal-queue", { x: 0.54, y: 0.03, w: 0.44, h: 0.93 }, 2),
    ],
    agents: () => [piece("terminal-agents", { x: 0.02, y: 0.03, w: 0.96, h: 0.93 }, 1)],
    career: () => [
      piece("terminal-console", { x: 0.02, y: 0.03, w: 0.34, h: 0.87 }, 1),
      piece("service-record", { x: 0.38, y: 0.03, w: 0.6, h: 0.93 }, 2),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  fortnite: {
    home: () => [
      piece("fn-party", { x: 0.12, y: 0.05, w: 0.76, h: 0.62 }, 1),
      piece("fn-play", { x: 0.66, y: 0.7, w: 0.32, h: 0.27 }, 2),
    ],
    play: () => [
      piece("fn-discover", { x: 0.03, y: 0.04, w: 0.6, h: 0.92 }, 1),
      piece("party-tools", { x: 0.66, y: 0.04, w: 0.32, h: 0.58 }, 2),
      piece("fn-play", { x: 0.66, y: 0.67, w: 0.32, h: 0.29 }, 3),
    ],
    agents: () => [piece("fn-agents", { x: 0.03, y: 0.04, w: 0.94, h: 0.92 }, 1)],
    career: () => [
      piece("service-record", { x: 0.03, y: 0.04, w: 0.94, h: 0.92 }, 1),
    ],
    store: () => [piece("fn-shop", { x: 0.03, y: 0.04, w: 0.94, h: 0.92 }, 1, { showBundle: true })],
  },
  minecraft: {
    agents: () => [piece("mc-agents", { x: 0.12, y: 0.05, w: 0.76, h: 0.88 }, 1)],
    home: () => [
      piece("mc-menu", { x: 0.3, y: 0.02, w: 0.4, h: 0.94 }, 1),
      piece("mc-party", { x: 0.015, y: 0.64, w: 0.27, h: 0.3 }, 2),
    ],
    play: () => [piece("mc-worlds", { x: 0.22, y: 0.03, w: 0.56, h: 0.93 }, 1)],
    career: () => [piece("mc-stats", { x: 0.22, y: 0.03, w: 0.56, h: 0.93 }, 1)],
    store: () => [piece("mc-trades", { x: 0.2, y: 0.08, w: 0.6, h: 0.8 }, 1)],
  },
  halo: {
    home: () => [
      piece("halo-lobby", { x: 0.03, y: 0.06, w: 0.36, h: 0.56 }, 1),
      piece("halo-roster", { x: 0.6, y: 0.06, w: 0.37, h: 0.6 }, 2),
      piece("halo-preview", { x: 0.03, y: 0.66, w: 0.36, h: 0.29 }, 4),
    ],
    play: () => [
      piece("halo-playlists", { x: 0.03, y: 0.06, w: 0.34, h: 0.86 }, 1),
      piece("halo-preview", { x: 0.42, y: 0.06, w: 0.55, h: 0.34 }, 2),
      piece("halo-roster", { x: 0.42, y: 0.43, w: 0.55, h: 0.51 }, 3),
    ],
    agents: () => [piece("halo-agents", { x: 0.03, y: 0.06, w: 0.94, h: 0.88 }, 1)],
    career: () => [
      piece("service-record", { x: 0.03, y: 0.06, w: 0.94, h: 0.88 }, 1),
    ],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  // The STAT screen: figure and limb bars in the middle, actions over the status bar.
  pipboy: {
    home: () => [
      piece("pip-stat", { x: 0.2, y: 0.02, w: 0.6, h: 0.76 }, 1),
      piece("pip-hints", { x: 0.03, y: 0.8, w: 0.6, h: 0.07 }, 2),
      piece("pip-bar", { x: 0.03, y: 0.895, w: 0.94, h: 0.075 }, 3),
      // COMMS beside the hints: the status bar under it spans the whole screen.
      piece("pip-chat", { x: 0.64, y: 0.815, w: 0.33, h: 0.04 }, 4),
    ],
    play: () => [
      piece("pip-quests", { x: 0.03, y: 0.03, w: 0.94, h: 0.74 }, 1),
      piece("pip-hints", { x: 0.03, y: 0.8, w: 0.94, h: 0.07 }, 2),
      piece("pip-bar", { x: 0.03, y: 0.895, w: 0.94, h: 0.075 }, 3),
    ],
    agents: () => [
      piece("pip-agents", { x: 0.03, y: 0.03, w: 0.94, h: 0.84 }, 1),
      piece("pip-bar", { x: 0.03, y: 0.895, w: 0.94, h: 0.075 }, 2),
    ],
    career: () => [
      piece("service-record", { x: 0.03, y: 0.03, w: 0.94, h: 0.84 }, 1),
      piece("pip-bar", { x: 0.03, y: 0.895, w: 0.94, h: 0.075 }, 2),
    ],
    store: () => [piece("store-front", { x: 0.03, y: 0.03, w: 0.94, h: 0.84 }, 1, { layout: "auto" }), piece("pip-bar", { x: 0.03, y: 0.895, w: 0.94, h: 0.075 }, 2)],
  },
  // The client's home hub and lobby fill the space between the bar and the social column.
  league: {
    home: () => [
      piece("lol-home", { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }, 1),
    ],
    play: () => [piece("lol-lobby", { x: 0, y: 0, w: 1, h: 1 }, 1)],
    agents: () => [piece("lol-agents", { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }, 1)],
    career: () => [piece("service-record", { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }, 1)],
    store: () => [piece("store-front", { x: 0.02, y: 0.03, w: 0.96, h: 0.94 }, 1, { layout: "auto" })],
  },
  // The calling card on the left, the main menu as huge slanted words down the right.
  phantom: {
    home: () => [
      piece("ph-card", { x: 0.04, y: 0.1, w: 0.38, h: 0.78 }, 1),
      piece("ph-menu", { x: 0.48, y: 0.05, w: 0.49, h: 0.9 }, 2),
    ],
    play: () => [
      piece("ph-missions", { x: 0.03, y: 0.06, w: 0.62, h: 0.88 }, 1),
      piece("ph-card", { x: 0.68, y: 0.08, w: 0.29, h: 0.78 }, 2),
    ],
    agents: () => [piece("ph-agents", { x: 0.03, y: 0.05, w: 0.94, h: 0.9 }, 1)],
    career: () => [piece("service-record", { x: 0.03, y: 0.04, w: 0.94, h: 0.9 }, 1)],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
  // The party link down the left, the breach panel (mode and PLAY) bottom right.
  nightcity: {
    home: () => [
      piece("nc-hub", { x: 0.03, y: 0.06, w: 0.42, h: 0.86 }, 1),
      piece("nc-play", { x: 0.55, y: 0.5, w: 0.42, h: 0.42 }, 2),
    ],
    play: () => [
      piece("nc-gigs", { x: 0.03, y: 0.04, w: 0.6, h: 0.9 }, 1),
      piece("nc-hub", { x: 0.66, y: 0.04, w: 0.31, h: 0.56 }, 2),
      piece("nc-play", { x: 0.66, y: 0.64, w: 0.31, h: 0.3 }, 3),
    ],
    agents: () => [piece("nc-agents", { x: 0.03, y: 0.04, w: 0.94, h: 0.9 }, 1)],
    career: () => [piece("service-record", { x: 0.03, y: 0.04, w: 0.94, h: 0.9 }, 1)],
    store: () => [piece("store-front", FRONT_RECT, 1, { layout: "auto" })],
  },
};

/** Bumped when a style's built-in layouts change, so saved documents pick the new ones up. */
export const LAYOUT_REVISIONS: Partial<Record<Skin, number>> = { glass: 3, current: 4, csgo: 2, cs16: 3, minecraft: 3, halo: 4, nightcity: 1, fortnite: 1, pipboy: 1, terminal: 3, phantom: 1, league: 1, cs2: 1, valnow: 1 };
