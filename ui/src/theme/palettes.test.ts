import { describe, expect, it } from "vitest";
import type { Skin } from "~/studio/types";
import { PALETTES, paletteOf, paletteVars } from "./palettes";

// Every stylesheet a style can paint from: its own piece sheets plus shared theme sheets
// (theme/league.css frames the core pieces in League). Needs `test.css` in vite.config.ts.
const SHEETS = import.meta.glob<string>(["../pieces/styled/*.module.css", "./*.css"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const ALL_TOKENS = Object.values(PALETTES).flatMap((entries) => (entries ?? []).map((entry) => entry.token));

/** The sheets a style owns: `current.module.css`, `currentStore.module.css`... and `theme/<skin>.css`. */
function sheetsOf(skin: string): string {
  const own = Object.entries(SHEETS).filter(
    ([path]) => path.startsWith(`../pieces/styled/${skin}`) || path === `./${skin}.css`,
  );
  return own.map(([, text]) => text).join("\n");
}

describe("PALETTES", () => {
  it("names every token after its style, so one saved record serves every style", () => {
    for (const [skin, entries] of Object.entries(PALETTES)) {
      for (const entry of entries ?? []) expect(entry.token.startsWith(`${skin}-`)).toBe(true);
    }
  });

  it("gives every role a full hex default", () => {
    const values = Object.values(PALETTES).flatMap((entries) => (entries ?? []).map((entry) => entry.value));
    expect(values.every((value) => /^#[0-9a-f]{6}$/i.test(value))).toBe(true);
  });

  it("lists only roles the style's stylesheets paint with, so no control does nothing", () => {
    for (const [skin, entries] of Object.entries(PALETTES)) {
      const sheet = sheetsOf(skin);
      const unused = (entries ?? []).filter((entry) => !sheet.includes(`var(--${entry.token},`));
      expect(unused.map((entry) => entry.token)).toEqual([]);
    }
  });

  it("never declares a role inside a stylesheet, which would shadow or loop on the player's colour", () => {
    const all = Object.values(SHEETS).join("\n");
    expect(ALL_TOKENS.filter((token) => new RegExp(`--${token}\\s*:`).test(all))).toEqual([]);
  });

  it("marks exactly one main panel colour per style, for look previews", () => {
    for (const entries of Object.values(PALETTES)) {
      expect((entries ?? []).filter((entry) => entry.isSurface).length).toBe(1);
    }
  });

  it("gives each role of a style its own label", () => {
    for (const entries of Object.values(PALETTES)) {
      const labels = (entries ?? []).map((entry) => entry.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("paletteOf", () => {
  it("has nothing for a style without a palette", () => {
    expect(paletteOf("terminal" as Skin)).toEqual([]);
  });
});

describe("paletteVars", () => {
  it("sets only the active style's overridden roles", () => {
    const vars = paletteVars("csgo", { "csgo-ink": "#FFAA00", "cs2-ink": "#000000" });
    expect(vars).toEqual({ "--csgo-ink": "#ffaa00" });
  });

  it("skips anything that is not a colour", () => {
    expect(paletteVars("csgo", { "csgo-ink": "red; background: url(x)" })).toEqual({});
  });

  it("skips shorthand hex, which the colour inputs never write", () => {
    expect(paletteVars("csgo", { "csgo-ink": "#fff" })).toEqual({});
  });

  it("skips non-string values from a malformed shared look", () => {
    // A pasted look is parsed JSON, so its types are not guaranteed at runtime.
    const malformed = { "csgo-ink": ["#ffffff"] } as unknown as Record<string, string>;
    expect(paletteVars("csgo", malformed)).toEqual({});
  });
});
