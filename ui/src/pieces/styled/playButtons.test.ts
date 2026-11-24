import { describe, expect, it } from "vitest";

// Studio > Theme > Play button must reach every style's PLAY: a style that draws its own
// (`data-part="play"`) has to read the theme's Play colour in its sheet, either the always-set
// `--play` or the picked-only `--theme-play` with its own design as fallback (studio/theme.ts).
const PIECES = import.meta.glob<string>("./*.tsx", { query: "?raw", import: "default", eager: true });
const SHEETS = import.meta.glob<string>("./*.module.css", { query: "?raw", import: "default", eager: true });

describe("styled PLAY buttons", () => {
  it("all follow the theme's Play colour", () => {
    const withPlay = Object.entries(PIECES).filter(([, source]) => source.includes('data-part="play"'));
    const deaf = withPlay
      .map(([path]) => path.replace(/\.tsx$/, ".module.css"))
      .filter((sheet) => !/var\(--(theme-)?play[,)]/.test(SHEETS[sheet] ?? ""));
    expect(withPlay.length).toBeGreaterThan(0);
    expect(deaf).toEqual([]);
  });
});
