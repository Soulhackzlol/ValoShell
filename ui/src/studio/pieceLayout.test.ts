import { describe, expect, it } from "vitest";
import { carriedProps, layoutOf, minPxOf } from "./pieceLayout";

const def = { layouts: [{ value: "card", label: "Card" }, { value: "strip", label: "Strip" }] };

describe("layoutOf", () => {
  it("draws the saved layout", () => {
    expect(layoutOf(def, { props: { layout: "strip" } })).toBe("strip");
  });

  it("falls back to the first layout when none or an unknown one is saved", () => {
    expect(layoutOf(def, { props: {} })).toBe("card");
    expect(layoutOf(def, { props: { layout: "gone" } })).toBe("card");
  });

  it("under Auto, draws the layout the piece's size suits", () => {
    const sized = { ...def, autoLayouts: { tiny: "strip" } };
    expect([layoutOf(sized, { props: {} }, "tiny"), layoutOf(sized, { props: {} }, "large")]).toEqual(["strip", "card"]);
  });

  it("keeps a picked layout whatever the size", () => {
    expect(layoutOf({ ...def, autoLayouts: { tiny: "strip" } }, { props: { layout: "card" } }, "tiny")).toBe("card");
  });

  it("has nothing to draw for pieces without layouts", () => {
    expect(layoutOf({}, { props: { layout: "strip" } })).toBeNull();
  });
});

describe("minPxOf", () => {
  const sized = { ...def, minPx: { w: 400, h: 240 }, layoutMinPx: { strip: { w: 300, h: 60 } }, autoLayouts: { small: "strip" } };

  it("lets a layout that needs less room shrink further", () => {
    expect(minPxOf(sized, { props: { layout: "strip" } })).toEqual({ w: 300, h: 60 });
  });

  it("keeps the kind's minimum for a picked layout without one of its own", () => {
    expect(minPxOf(sized, { props: { layout: "card" } })).toEqual({ w: 400, h: 240 });
  });

  it("under Auto, shrinks as far as its size layouts go", () => {
    expect(minPxOf(sized, { props: {} })).toEqual({ w: 300, h: 60 });
  });
});

describe("carriedProps", () => {
  const glass = { ...def, defaults: { ring: "", showRanks: true } };

  it("keeps the layout the new look offers and the settings both share", () => {
    expect(carriedProps(glass, { layout: "strip", showRanks: false, label: "Go" })).toEqual({ ring: "", showRanks: false, layout: "strip" });
  });

  it("drops a layout the new look lacks, so it goes back to Auto", () => {
    expect(carriedProps(glass, { layout: "steps" })).toEqual({ ring: "", showRanks: true });
  });

  it("drops a shared name holding another kind of value", () => {
    expect(carriedProps(glass, { ring: 3 })).toEqual({ ring: "", showRanks: true });
  });
});
