// How the look gallery talks to its live preview frame (the app itself, run with
// `?look-preview`): the gallery sends the look and the page to show; the frame says when it
// is ready. Same origin only, and both sides check the message's shape before using it.

export const PREVIEW_WIDTH = 1600;
export const PREVIEW_HEIGHT = 900;

/** The pages the preview can show, in the order of its page chips. */
export const PREVIEW_PAGES = [
  { id: "home", label: "Home" },
  { id: "play", label: "Play" },
  { id: "agent-select", label: "Agent select" },
  { id: "live", label: "In match" },
  { id: "post-match", label: "After match" },
  { id: "store", label: "Store" },
  { id: "career", label: "Career" },
] as const;

export type PreviewPage = (typeof PREVIEW_PAGES)[number]["id"];

const SHOW_KIND = "valoshell-preview-show";
const READY_KIND = "valoshell-preview-ready";

export interface ShowMessage {
  kind: typeof SHOW_KIND;
  /** A look document; the frame repairs it with normalizeDoc like any outside look. */
  doc: unknown;
  page: PreviewPage;
}

export function showMessage(doc: unknown, page: PreviewPage): ShowMessage {
  return { kind: SHOW_KIND, doc, page };
}

export const READY_MESSAGE = { kind: READY_KIND } as const;

function isPreviewPage(value: unknown): value is PreviewPage {
  return PREVIEW_PAGES.some((page) => page.id === value);
}

export function isShowMessage(data: unknown): data is ShowMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as Record<string, unknown>;
  return message["kind"] === SHOW_KIND && isPreviewPage(message["page"]) && typeof message["doc"] === "object";
}

export function isReadyMessage(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as Record<string, unknown>)["kind"] === READY_KIND;
}
