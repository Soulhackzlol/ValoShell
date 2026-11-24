import { describe, expect, it } from "vitest";
import { defaultDoc, defaultStage, piece } from "./defaults";
import { SKINS } from "./skins";
import { switchStyle } from "./styleSwitch";
import type { Skin, StageId, StudioDoc } from "./types";

function styled(id: Skin, doc: StudioDoc = defaultDoc()): StudioDoc {
  const skin = SKINS.find((option) => option.id === id);
  if (!skin) throw new Error(`no style ${id}`);
  switchStyle(doc, skin);
  return doc;
}

const kinds = (doc: StudioDoc, stage: StageId) => (doc.stages[stage] ?? defaultStage(stage)).map((placed) => placed.kind);

describe("switchStyle", () => {
  it("swaps the match screens' standard pieces for the style's own looks", () => {
    const doc = styled("minecraft");
    expect(kinds(doc, "agent-select")).toContain("mc-pick");
    expect(kinds(doc, "live")).toContain("mc-match");
    expect(kinds(doc, "post-match")).toContain("mc-results");
  });

  it("goes back to the standard pieces for a style without looks of its own", () => {
    const doc = styled("modern", styled("minecraft"));
    expect(kinds(doc, "post-match")).toContain("post-match");
    expect(kinds(doc, "post-match")).not.toContain("mc-results");
  });

  it("keeps a look the player took from a third style", () => {
    const doc = styled("minecraft");
    doc.stages["post-match"] = [piece("glass-results", { x: 0, y: 0, w: 1, h: 1 }, 1)];
    expect(kinds(styled("halo", doc), "post-match")).toEqual(["glass-results"]);
  });

  it("puts the style's own chat line on Home, once", () => {
    const doc = styled("fortnite");
    const home = kinds(doc, "home");
    expect(home.filter((kind) => kind.endsWith("-chat"))).toEqual(["fn-chat"]);
  });

  it("adds no chat line for a style without one of its own", () => {
    expect(kinds(styled("modern"), "home").some((kind) => kind.endsWith("-chat"))).toBe(false);
  });
});
