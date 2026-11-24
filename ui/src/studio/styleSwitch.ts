// Switching style: the style's colours and its designed screens (skins/index.ts applySkin), then
// its own looks everywhere else. The screens a style doesn't design (agent select, the live
// match, the match report) keep the player's pieces but swap the job's standard piece, or the
// previous style's look of it, for the new style's own (a Minecraft match report in Minecraft),
// keeping place, size and settings; a look the player took from a third style stays. Home gets
// the style's own party chat line where the menu's floating chat button sits, which then steps
// aside (ChatDock), so every style can be chatted from in its own clothes.
import { defaultStage, piece } from "./defaults";
import { JOBS, jobOf, kindForJob } from "./registry/jobs";
import { applySkin, pieceFamily } from "./skins";
import type { SkinBundle } from "./skins/bundles";
import { LAYOUTS } from "./skins/layouts";
import type { Piece, Skin, StageId, StudioDoc } from "./types";

/** Bottom-left, where the floating chat button sits: the client's own place for party chat. */
const CHAT_RECT = { x: 0.012, y: 0.945, w: 0.23, h: 0.04 };
const CHAT_JOB = JOBS.find((job) => job.id === "chat");
/** The match screens no style designs; an unedited one is read from its defaults. */
const MATCH_STAGES: readonly StageId[] = ["agent-select", "live", "post-match"];
/** Each look decides for itself which screens it suits; a swap never moves a piece. */
const anywhere = () => true;

/** The kind `piece` becomes in `skin`, or null when it stays as it is. */
function swappedKind(kind: string, previous: Skin, skin: Skin): string | null {
  const job = jobOf(kind);
  if (!job || (kind !== job.standard && pieceFamily(kind) !== previous)) return null;
  const target = kindForJob(job, skin, anywhere);
  return target && target !== kind ? target : null;
}

/** On the screens the new style doesn't design, its own looks replace the standard ones. */
function useStyleLooks(doc: StudioDoc, previous: Skin, skin: Skin): void {
  const designed = LAYOUTS[skin] ?? {};
  const stages = new Set<StageId>([...(Object.keys(doc.stages) as StageId[]), ...MATCH_STAGES]);
  for (const stage of stages) {
    if (designed[stage]) continue;
    const pieces: Piece[] = doc.stages[stage] ?? defaultStage(stage);
    let isChanged = false;
    for (const placed of pieces) {
      const kind = swappedKind(placed.kind, previous, skin);
      if (!kind) continue;
      placed.kind = kind;
      isChanged = true;
    }
    // An unedited stage is stored only once it differs from its defaults.
    if (isChanged) doc.stages[stage] = pieces;
  }
}

/** The style's own chat line on Home, unless Home already has one. */
function placeChatLine(doc: StudioDoc, skin: Skin): void {
  if (!CHAT_JOB) return;
  const kind = kindForJob(CHAT_JOB, skin, anywhere);
  if (!kind || pieceFamily(kind) !== skin) return;
  const home = doc.stages.home ?? defaultStage("home");
  if (home.some((placed) => jobOf(placed.kind)?.id === "chat")) return;
  const top = Math.max(0, ...home.map((placed) => placed.z));
  doc.stages.home = [...home, piece(kind, CHAT_RECT, top + 1)];
}

/** Switch `doc` to `skin`: colours and designed screens, then the style's own looks. */
export function switchStyle(doc: StudioDoc, skin: SkinBundle): void {
  const previous = doc.theme.skin;
  applySkin(doc, skin);
  useStyleLooks(doc, previous, skin.id);
  placeChatLine(doc, skin.id);
}
