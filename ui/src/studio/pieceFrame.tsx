// What the frame around every piece knows and tells it: its size, shape and place
// (pieceContext.ts), the style it is drawn in, the game moment (state/moment.ts) and how it
// moves (motion.ts). CSS reads these as data attributes on the piece body; components read
// them with usePieceContext() when they need to change structure, not just look.
import { type Accessor, type JSX, createContext, useContext } from "solid-js";
import { moment, partySize } from "~/state/moment";
import { type GameMoment, isShownAt } from "~/state/momentRules";
import { type PxRect } from "./geometry";
import { resolveMotion } from "./motion";
import { type PieceContext, pieceContextOf } from "./pieceContext";
import { doc } from "./store";
import type { Piece, Skin } from "./types";

export interface FrameContext extends PieceContext {
  skin: Skin;
  moment: GameMoment;
}

const FALLBACK: FrameContext = { size: "medium", shape: "square", anchor: "center", skin: "modern", moment: "idle" };
const Context = createContext<Accessor<FrameContext>>(() => FALLBACK);

/** The piece's context; outside a frame (previews, tests) a medium centred piece. */
export function usePieceContext(): Accessor<FrameContext> {
  return useContext(Context);
}

export function PieceContextProvider(props: { value: Accessor<FrameContext>; children: JSX.Element }) {
  return <Context.Provider value={props.value}>{props.children}</Context.Provider>;
}

/** The context of `piece` drawn at `rect` px, read live. */
export function frameContextOf(piece: Piece, rect: PxRect): FrameContext {
  return { ...pieceContextOf(piece.rect, rect.w, rect.h), skin: doc.theme.skin, moment: moment() };
}

/** Whether the piece's show rule lets it on screen at this moment. */
export function isShownNow(piece: Piece): boolean {
  return isShownAt(piece.showWhen, moment(), partySize());
}

/** The data attributes the frame sets on a piece's body. */
export function frameAttributes(piece: Piece, context: FrameContext, isShown: boolean): Record<string, string | undefined> {
  const motion = resolveMotion(piece.style, context.skin, context.anchor);
  return {
    "data-size": context.size,
    "data-shape": context.shape,
    "data-anchor": context.anchor,
    "data-enter": motion.enter,
    "data-from": motion.from,
    "data-idle": piece.style.idle === "none" ? undefined : piece.style.idle,
    "data-hover": motion.hover === "none" ? undefined : motion.hover,
    "data-away": isShown ? undefined : "",
  };
}
