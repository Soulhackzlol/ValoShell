import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, defaultDoc, defaultStage, piece } from "../defaults";
import { SKIN_IDS, type Skin, type StageId, type StudioDoc } from "../types";
import { SKINS, applySkin, pieceFamily, refreshLayouts, tabLabel } from "./index";
import { LAYOUTS, LAYOUT_REVISIONS, STYLED_STAGES } from "./layouts";

// Read as text: tests run without the JSX transform, so the registry cannot be imported here.
const REGISTRY = Object.values(
  import.meta.glob<string>("../registry/**/*.tsx", { query: "?raw", import: "default", eager: true }),
).join("\n");
const REGISTERED = new Set([...REGISTRY.matchAll(/kind: "([^"]+)"/g)].map((match) => match[1]));
/** Rects are fractions of the stage; a hair over 1 is rounding in the client-measured layouts. */
const EDGE = 1.001;

function bundle(id: Skin) {
  const found = SKINS.find((skin) => skin.id === id);
  if (!found) throw new Error(`no bundle for ${id}`);
  return found;
}

function docWith(skin: Skin): StudioDoc {
  const doc = defaultDoc();
  applySkin(doc, bundle(skin));
  return doc;
}

const laidOut = (skin: Skin) =>
  STYLED_STAGES.flatMap((stage) => (LAYOUTS[skin][stage]?.() ?? []).map((entry) => ({ stage, entry })));

describe("style bundles", () => {
  it("every style id has exactly one bundle", () => {
    expect(SKINS.map((skin) => skin.id).sort()).toEqual([...SKIN_IDS].sort());
  });

  it("every bundle colour is #rrggbb", () => {
    const colours = SKINS.flatMap((skin) => [skin.accent, skin.accent2, skin.ground, skin.text, skin.play]);
    expect(colours.filter((colour) => !/^#[0-9a-f]{6}$/i.test(colour))).toEqual([]);
  });
});

describe("style layouts", () => {
  it("place only registered pieces", () => {
    const unknown = SKIN_IDS.flatMap((skin) => laidOut(skin).filter(({ entry }) => !REGISTERED.has(entry.kind)).map(({ entry }) => `${skin}:${entry.kind}`));
    expect(unknown).toEqual([]);
  });

  it("place pieces inside the screen", () => {
    const outside = SKIN_IDS.flatMap((skin) =>
      laidOut(skin)
        .filter(({ entry: { rect } }) => rect.x < 0 || rect.y < 0 || rect.x + rect.w > EDGE || rect.y + rect.h > EDGE)
        .map(({ stage, entry }) => `${skin}/${stage}:${entry.kind}`),
    );
    expect(outside).toEqual([]);
  });

  it("use only their own style's pieces or the menu's shared ones", () => {
    const borrowed = SKIN_IDS.flatMap((skin) =>
      laidOut(skin)
        .filter(({ entry }) => ![null, skin].includes(pieceFamily(entry.kind)))
        .map(({ entry }) => `${skin}:${entry.kind}`),
    );
    expect(borrowed).toEqual([]);
  });

  it("give every piece on a screen its own id and stacking place", () => {
    for (const skin of SKIN_IDS) {
      for (const stage of STYLED_STAGES) {
        const pieces = LAYOUTS[skin][stage]?.() ?? [];
        expect(new Set(pieces.map((entry) => entry.id)).size, `${skin}/${stage} ids`).toBe(pieces.length);
        expect(new Set(pieces.map((entry) => entry.z)).size, `${skin}/${stage} z`).toBe(pieces.length);
      }
    }
  });
});

describe("the menu's default screens", () => {
  const STAGES: readonly StageId[] = ["home", "play", "agents", "collection", "career", "store", "agent-select", "live", "post-match", "ingame"];

  it("place only registered pieces, inside the screen, each with its own id and stacking place", () => {
    for (const stage of STAGES) {
      const pieces = defaultStage(stage);
      expect(pieces.filter((entry) => !REGISTERED.has(entry.kind)).map((entry) => entry.kind), stage).toEqual([]);
      expect(pieces.filter(({ rect }) => rect.x < 0 || rect.y < 0 || rect.x + rect.w > EDGE || rect.y + rect.h > EDGE).length, stage).toBe(0);
      expect(new Set(pieces.map((entry) => entry.z)).size, `${stage} z`).toBe(pieces.length);
    }
  });
});

describe("applySkin", () => {
  it("puts back the backdrop fields the previous style forced", () => {
    const forcing = SKINS.find((skin) => skin.id !== "modern" && skin.backdrop && Object.keys(skin.backdrop).length > 0);
    expect(forcing).toBeDefined();
    const doc = docWith(forcing?.id ?? "modern");
    applySkin(doc, bundle("modern"));
    for (const key of Object.keys(forcing?.backdrop ?? {}) as (keyof typeof DEFAULT_THEME.backdrop)[]) {
      expect(doc.theme.backdrop[key], key).toEqual(DEFAULT_THEME.backdrop[key]);
    }
  });

  it("clears a screen the previous style laid out but keeps one the player built", () => {
    const own: StageId = "collection";
    const doc = docWith("phantom");
    doc.stages[own] = [piece("clock", { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, 1)];
    applySkin(doc, bundle("modern"));
    expect(doc.stages.home).toBeUndefined();
    expect(doc.stages[own]?.map((entry) => entry.kind)).toEqual(["clock"]);
  });

  it("switching between any two styles leaves only the new style's screens", () => {
    for (const from of SKIN_IDS) {
      for (const to of SKIN_IDS) {
        const doc = docWith(from);
        applySkin(doc, bundle(to));
        for (const stage of STYLED_STAGES) {
          const expected = LAYOUTS[to][stage]?.().map((entry) => entry.kind);
          expect(doc.stages[stage]?.map((entry) => entry.kind), `${from} -> ${to} ${stage}`).toEqual(expected);
        }
      }
    }
  });

  it("takes the style's colours and leaves PLAY to the style's own", () => {
    const doc = defaultDoc();
    doc.theme.play = "#123456";
    applySkin(doc, bundle("nightcity"));
    expect([doc.theme.skin, doc.theme.accent, doc.theme.play]).toEqual(["nightcity", bundle("nightcity").accent, ""]);
  });
});

describe("refreshLayouts", () => {
  const [revised, revision] = Object.entries(LAYOUT_REVISIONS)[0] as [Skin, number];

  it("re-lays a document saved before its style's layouts changed", () => {
    const doc = docWith(revised);
    doc.layouts = { [revised]: revision - 1 };
    doc.stages.home = [];
    expect(refreshLayouts(doc)).toBe(true);
    expect(doc.stages.home?.length).toBeGreaterThan(0);
  });

  it("leaves an up-to-date document alone", () => {
    expect(refreshLayouts(docWith(revised))).toBe(false);
  });
});

describe("names", () => {
  it("a style's tab name replaces the default, others keep it", () => {
    expect(tabLabel("fortnite", "store", "Store")).toBe("Item Shop");
    expect(tabLabel("modern", "store", "Store")).toBe("Store");
  });

  it("a piece belongs to the style its prefix names", () => {
    expect([pieceFamily("ph-menu"), pieceFamily("nc-hub"), pieceFamily("play-bar")]).toEqual(["phantom", "nightcity", null]);
  });
});
