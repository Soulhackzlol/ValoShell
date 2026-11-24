import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The store runs in the browser: it schedules saves on `window` and animates through
// `document`. Without view transitions the change is applied at once, which is what a test
// wants; saves are timers that never fire under fake timers, so nothing is written.
const ignore = () => undefined;
vi.stubGlobal("window", {
  setTimeout,
  clearTimeout,
  location: { search: "" },
  addEventListener: ignore,
  removeEventListener: ignore,
  matchMedia: () => ({ matches: false, addEventListener: ignore }),
});
vi.stubGlobal("document", { documentElement: { dataset: {} }, addEventListener: ignore });
vi.useFakeTimers();

type Store = typeof import("./store");
let store: Store;

beforeAll(async () => {
  store = await import("./store");
});

/** Undo steps are told apart by time; each test starts past the coalescing window. */
beforeEach(() => {
  vi.advanceTimersByTime(1_000);
  vi.setSystemTime(Date.now() + 1_000);
});

const ACCENTS = ["#112233", "#445566", "#778899"];

describe("undo and redo", () => {
  it("undo puts the previous value back and redo applies it again", () => {
    store.updateTheme((theme) => void (theme.accent = ACCENTS[0] ?? ""));
    const before = store.doc.theme.accent;
    vi.advanceTimersByTime(1_000);
    store.updateTheme((theme) => void (theme.accent = ACCENTS[1] ?? ""));
    store.undo();
    expect(store.doc.theme.accent).toBe(before);
    store.redo();
    expect(store.doc.theme.accent).toBe(ACCENTS[1]);
  });

  it("a new change after an undo drops what could be redone", () => {
    store.updateTheme((theme) => void (theme.accent = ACCENTS[0] ?? ""));
    store.undo();
    expect(store.historySize().future).toBeGreaterThan(0);
    store.updateTheme((theme) => void (theme.accent = ACCENTS[2] ?? ""));
    expect(store.historySize().future).toBe(0);
  });

  it("rapid changes with the same key are one undo step (a slider drag)", () => {
    store.updateTheme((theme) => void (theme.accent = ACCENTS[0] ?? ""));
    vi.advanceTimersByTime(1_000);
    const pastBefore = store.historySize().past;
    for (const accent of ACCENTS) store.updateTheme((theme) => void (theme.accent = accent), "theme.accent");
    expect(store.historySize().past).toBe(pastBefore + 1);
    store.undo();
    expect(store.doc.theme.accent).toBe(ACCENTS[0]);
  });

  it("undo with no history changes nothing", () => {
    while (store.historySize().past > 0) store.undo();
    const before = JSON.stringify(store.doc);
    store.undo();
    expect(JSON.stringify(store.doc)).toBe(before);
  });
});

describe("pieces", () => {
  const stage = "home" as const;

  it("editing a stage first copies its default pieces, then changes only the one edited", () => {
    store.resetStage(stage);
    const defaults = store.stagePieces(stage);
    const target = defaults[0];
    expect(target).toBeDefined();
    store.updatePiece(stage, target?.id ?? "", (piece) => void (piece.isHidden = true));
    const pieces = store.stagePieces(stage);
    expect(pieces.map((piece) => piece.id)).toEqual(defaults.map((piece) => piece.id));
    expect(pieces.filter((piece) => piece.isHidden).map((piece) => piece.id)).toEqual([target?.id]);
  });

  it("removing a piece takes it off the stage and clears the selection", () => {
    store.resetStage(stage);
    const target = store.stagePieces(stage)[0]?.id ?? "";
    store.setSelectedId(target);
    store.removePiece(stage, target);
    expect(store.stagePieces(stage).some((piece) => piece.id === target)).toBe(false);
    expect(store.selectedId()).toBeNull();
  });

  it("bringing a piece forward swaps it with the one above", () => {
    store.resetStage(stage);
    const [low, high] = [...store.stagePieces(stage)].sort((a, b) => a.z - b.z);
    store.restack(stage, low?.id ?? "", 1);
    const after = [...store.stagePieces(stage)].sort((a, b) => a.z - b.z).map((piece) => piece.id);
    expect(after.slice(0, 2)).toEqual([high?.id, low?.id]);
  });

  it("the top piece cannot go further forward", () => {
    store.resetStage(stage);
    const ordered = [...store.stagePieces(stage)].sort((a, b) => a.z - b.z);
    const top = ordered[ordered.length - 1];
    const before = JSON.stringify(store.stagePieces(stage));
    store.restack(stage, top?.id ?? "", 1);
    expect(JSON.stringify(store.stagePieces(stage))).toBe(before);
  });

  it("reset everything brings back the default theme and stages", () => {
    store.updateTheme((theme) => void (theme.accent = ACCENTS[2] ?? ""));
    store.resetEverything();
    expect(store.doc.theme.accent).not.toBe(ACCENTS[2]);
    expect(store.doc.stages).toEqual({});
  });
});
