// Every piece kind, assembled: the menu's own pieces, each style's pieces (styles/, one file per
// style) and the free widgets. Adding a piece = one entry in the file it belongs to; adding a
// style = one file in styles/ and one line here.
import type { StageId } from "../types";
import { MENU_PIECES } from "./menuPieces";
import { GLASS_PIECES } from "./styles/glass";
import { CURRENT_PIECES } from "./styles/current";
import { FORTNITE_PIECES } from "./styles/fortnite";
import { MINECRAFT_PIECES } from "./styles/minecraft";
import { HALO_PIECES } from "./styles/halo";
import { PIPBOY_PIECES } from "./styles/pipboy";
import { PHANTOM_PIECES } from "./styles/phantom";
import { NIGHTCITY_PIECES } from "./styles/nightcity";
import { BETA_PIECES } from "./styles/beta";
import { CSGO_PIECES } from "./styles/csgo";
import { CS16_PIECES } from "./styles/cs16";
import { TERMINAL_PIECES } from "./styles/terminal";
import { CS2_PIECES } from "./styles/cs2";
import { WIDGET_PIECES } from "./widgets";
import { LEAGUE_PIECES } from "./styles/league";
import { V22_PIECES } from "./styles/valnow";
import { withSharedLayouts } from "./jobs";
import type { PieceDef } from "./types";

export type { FieldType, PieceDef, PieceProps, PropField } from "./types";
export { ORIGINAL_LAYOUT, drawnDef } from "./jobs";

export const PIECES: readonly PieceDef[] = [
  ...MENU_PIECES,
  ...GLASS_PIECES,
  ...CURRENT_PIECES,
  ...FORTNITE_PIECES,
  ...MINECRAFT_PIECES,
  ...HALO_PIECES,
  ...PIPBOY_PIECES,
  ...PHANTOM_PIECES,
  ...NIGHTCITY_PIECES,
  ...BETA_PIECES,
  ...CSGO_PIECES,
  ...CS16_PIECES,
  ...TERMINAL_PIECES,
  ...CS2_PIECES,
  ...WIDGET_PIECES,
  ...LEAGUE_PIECES,
  ...V22_PIECES,
];

const RAW_BY_KIND = new Map(PIECES.map((def) => [def.kind, def]));
const BY_KIND = new Map(PIECES.map((def) => [def.kind, withSharedLayouts(def, RAW_BY_KIND)]));


export function pieceDef(kind: string): PieceDef | undefined {
  return BY_KIND.get(kind);
}

export function allowedOn(def: PieceDef, stage: StageId): boolean {
  return def.stages === null || def.stages.includes(stage);
}

/** Whether a kind exists and may go on `stage`. */
export function isKindAllowedOn(kind: string, stage: StageId): boolean {
  const def = BY_KIND.get(kind);
  return def !== undefined && allowedOn(def, stage);
}
