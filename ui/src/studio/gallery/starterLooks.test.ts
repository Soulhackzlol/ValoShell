import { describe, expect, it } from "vitest";
import { paletteOf } from "~/theme/palettes";
import { SKINS } from "../skins";
import { STARTER_LOOKS, starterDoc, starterThumb } from "./starterLooks";

describe("STARTER_LOOKS", () => {
  it("each uses a style that exists, with a unique id", () => {
    const ids = STARTER_LOOKS.map((look) => look.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STARTER_LOOKS.every((look) => SKINS.some((skin) => skin.id === look.skin))).toBe(true);
  });

  it("each has a screenshot (node ui/scripts/look-thumbs.mjs starters)", () => {
    expect(STARTER_LOOKS.filter((look) => !starterThumb(look)).map((look) => look.id)).toEqual([]);
  });

  it("only recolours roles its style actually has", () => {
    for (const look of STARTER_LOOKS) {
      const roles = new Set(paletteOf(look.skin).map((entry) => entry.token));
      expect(Object.keys(look.palette ?? {}).filter((token) => !roles.has(token))).toEqual([]);
    }
  });
});

describe("starterDoc", () => {
  it("applies the style's bundle and layouts, then the look's colours", () => {
    const look = STARTER_LOOKS.find((entry) => entry.id === "radiant-glass")!;

    const doc = starterDoc(look);

    expect(doc.theme.skin).toBe("glass");
    expect(doc.theme.play).toBe("#e8b04b");
    expect(doc.theme.palette["glass-ring"]).toBe("#e8b04b");
    expect(doc.stages.home?.length ?? 0).toBeGreaterThan(0);
  });

  it("builds a fresh document each time, so applying one never edits another", () => {
    const look = STARTER_LOOKS[0]!;
    expect(starterDoc(look).theme.palette).not.toBe(starterDoc(look).theme.palette);
  });
});
