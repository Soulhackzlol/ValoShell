import { describe, expect, it } from "vitest";
import { DEFAULT_STYLE } from "./defaults";
import { PIECE_SCALE, accentOf, baseStyleOf, clampScale, pieceLookVars } from "./pieceLook";
import type { PieceStyle } from "./types";

const style = (overrides: Partial<PieceStyle>): PieceStyle => ({ ...DEFAULT_STYLE, ...overrides });

describe("pieceLookVars", () => {
  it("sets nothing for a piece drawn as its style designed it", () => {
    expect(pieceLookVars(DEFAULT_STYLE)).toEqual({});
  });

  it("sets the size, density and accent that differ", () => {
    const vars = pieceLookVars(style({ scale: 1.2, density: "compact", accent: "#FFD000" }));
    expect(vars).toEqual({
      "--piece-scale": "1.2",
      "--piece-density": "0.7",
      "--piece-accent": "#ffd000",
      "--piece-on-accent": "#0b0b0e",
    });
  });

  it("ignores an unknown density from an older or hand-edited layout", () => {
    expect(pieceLookVars(style({ density: "huge" as PieceStyle["density"] }))).toEqual({});
  });
});

describe("clampScale", () => {
  it("keeps the size inside its range", () => {
    expect(clampScale(9)).toBe(PIECE_SCALE.max);
    expect(clampScale(0.1)).toBe(PIECE_SCALE.min);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe("accentOf", () => {
  it("reads only full hex colours; anything else means the style's accent", () => {
    expect(accentOf(style({ accent: "" }))).toBeNull();
    expect(accentOf(style({ accent: "red" }))).toBeNull();
    expect(accentOf(style({ accent: "#12ab9F" }))).toBe("#12ab9f");
  });
});

describe("baseStyleOf", () => {
  it("starts from the shared defaults plus the definition's own look", () => {
    expect(baseStyleOf({ surface: "glass", radius: 10 })).toEqual({ ...DEFAULT_STYLE, surface: "glass", radius: 10 });
  });

  it("is the shared defaults for kinds without their own look", () => {
    expect(baseStyleOf(undefined)).toEqual(DEFAULT_STYLE);
  });
});
