import { describe, expect, it } from "vitest";
import { JOBS, ORIGINAL_LAYOUT, drawnDef, jobOf, kindForJob, lookLabel, looksOf, withSharedLayouts } from "./jobs";
import type { PieceDef } from "./types";

// The registry's components need a browser to load, so the kinds are read from its source.
const SOURCES = import.meta.glob<string>(["./*.tsx", "./styles/*.tsx"], { query: "?raw", import: "default", eager: true });
const registeredKinds = new Set(Object.values(SOURCES).flatMap((source) => [...source.matchAll(/^\s+kind: "([\w-]+)",$/gm)].map((match) => match[1])));

const job = (id: string) => JOBS.find((entry) => entry.id === id)!;
const everywhere = () => true;

describe("jobs", () => {
  it("only lists kinds that are registered", () => {
    const missing = JOBS.flatMap((entry) => [entry.standard, ...entry.looks]).filter((kind) => !registeredKinds.has(kind));
    expect(registeredKinds.size).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });

  it("puts every kind in at most one job", () => {
    const kinds = JOBS.flatMap((entry) => [entry.standard, ...entry.looks]);
    expect(kinds.length).toBe(new Set(kinds).size);
  });

  it("knows the job of a style's copy and leaves widgets out", () => {
    expect([jobOf("nc-agents")?.id, jobOf("clock")]).toEqual(["agents", undefined]);
  });
});

describe("kindForJob", () => {
  it("places the style's own look", () => {
    expect(kindForJob(job("agents"), "glass", everywhere)).toBe("glass-agents");
  });

  it("falls back to the standard look where the style has none", () => {
    expect(kindForJob(job("career"), "phantom", everywhere)).toBe("service-record");
  });

  it("skips a look the screen doesn't allow", () => {
    expect(kindForJob(job("party"), "glass", (kind) => kind !== "glass-party")).toBe("party-lineup");
  });

  it("offers nothing when no look may go on the screen", () => {
    expect(kindForJob(job("party"), "glass", () => false)).toBeUndefined();
  });
});

describe("looks", () => {
  it("lists the standard look first and names looks by style", () => {
    expect(looksOf(job("rank"), everywhere)[0]).toBe("rank-card");
    expect([lookLabel("rank-card"), lookLabel("glass-rank")]).toEqual(["Standard", "Glass"]);
  });
});

describe("withSharedLayouts", () => {
  const def = (kind: string, layouts?: string[]) =>
    ({ kind, minPx: { w: 300, h: 200 }, defaults: {}, layouts: layouts?.map((value) => ({ value, label: value })) }) as unknown as PieceDef;
  const standard = def("party-lineup", ["cards", "portraits", "strip"]);
  const byKind = new Map([[standard.kind, standard]]);
  const values = (piece: PieceDef) => piece.layouts?.map((option) => option.value);

  it("adds the job's shared layouts after a look's own", () => {
    expect(values(withSharedLayouts(def("glass-party", ["steps", "strip"]), byKind))).toEqual(["steps", "strip", "cards", "portraits"]);
  });

  it("gives a look without layouts its own screen first, so nothing placed changes", () => {
    expect(values(withSharedLayouts(def("halo-roster"), byKind))?.[0]).toBe(ORIGINAL_LAYOUT);
  });

  it("draws shared layouts with the standard piece and its own with the look", () => {
    const halo = withSharedLayouts(def("halo-roster"), byKind);
    expect([drawnDef(halo, "portraits"), drawnDef(halo, ORIGINAL_LAYOUT)]).toEqual([standard, halo]);
  });

  it("leaves the standard piece and widgets as they are", () => {
    const clock = def("clock");
    expect([withSharedLayouts(standard, byKind), withSharedLayouts(clock, byKind)]).toEqual([standard, clock]);
  });
});
