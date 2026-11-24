// What a gallery card shows about a look, read from its document alone: the style, its key
// colours and where its Home pieces sit. Pure, so a look someone shared is described without
// applying it.
import { paletteOf } from "~/theme/palettes";
import { HEX_COLOR } from "../colors";
import { defaultStage } from "../defaults";
import { SKINS } from "../skins";
import type { Rect, StudioDoc } from "../types";

export type PlayEdge = "top" | "bottom";

/** Pieces holding the PLAY button, and the edge it sits on: previews draw a strip there in the
 * Play colour (Beta's PLAY block tops its social column; the others end with it). */
const PLAY_EDGES: ReadonlyMap<string, PlayEdge> = new Map([
  ["play-bar", "bottom"],
  ["val-find", "bottom"],
  ["glass-play", "bottom"],
  ["fn-play", "bottom"],
  ["beta-play", "bottom"],
  ["beta-social", "top"],
  ["cs16-play", "bottom"],
  ["cs2-play", "bottom"],
  ["csgo-play", "bottom"],
]);

export interface PreviewBox {
  rect: Rect;
  /** Where the piece's PLAY button sits; null when it has none. */
  playEdge: PlayEdge | null;
}

export interface LookSummary {
  styleLabel: string;
  /** Colours to show as swatches and to paint the preview with, all `#rrggbb`. */
  ground: string;
  text: string;
  accent: string;
  play: string;
  /** The style's main panel colour (recoloured or its own); null for styles without roles. */
  surface: string | null;
  /** Visible Home pieces, back to front. */
  boxes: PreviewBox[];
}

/** `value` when it is a full hex colour, else `fallback` (a shared look may hold anything). */
function hexOr(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

export function summarizeLook(doc: StudioDoc): LookSummary {
  const skin = SKINS.find((option) => option.id === doc.theme.skin);
  const accent = hexOr(doc.theme.accent, skin?.accent ?? "#ff4655");
  const pieces = doc.stages.home ?? defaultStage("home");
  const boxes = pieces
    .filter((piece) => !piece.isHidden)
    .sort((first, second) => first.z - second.z)
    .map((piece) => ({ rect: piece.rect, playEdge: PLAY_EDGES.get(piece.kind) ?? null }));
  return {
    styleLabel: skin?.label ?? doc.theme.skin,
    ground: hexOr(doc.theme.ground, skin?.ground ?? "#0a0a0e"),
    text: hexOr(doc.theme.text, skin?.text ?? "#ededf0"),
    accent,
    play: hexOr(doc.theme.play, skin?.play ?? accent),
    surface: surfaceOf(doc),
    boxes,
  };
}

/** The style's main panel colour: the player's recolour of that role, else the style's own. */
function surfaceOf(doc: StudioDoc): string | null {
  const role = paletteOf(doc.theme.skin).find((entry) => entry.isSurface);
  if (!role) return null;
  const palette: unknown = doc.theme.palette;
  const picked = palette && typeof palette === "object" ? (palette as Record<string, unknown>)[role.token] : undefined;
  return hexOr(picked, role.value);
}
