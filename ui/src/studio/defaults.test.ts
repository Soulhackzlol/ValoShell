import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, normalizeDoc } from "./defaults";

describe("normalizeDoc", () => {
  it("gives an empty or broken document the default theme", () => {
    expect(normalizeDoc(null).theme).toEqual(DEFAULT_THEME);
  });

  it("keeps the style's own Play colour for documents saved before it existed", () => {
    expect(normalizeDoc({ theme: { skin: "csgo" } }).theme.play).toBe("");
  });

  it("drops a Play colour that is not a string (a malformed pasted look)", () => {
    expect(normalizeDoc({ theme: { play: ["#ffffff"] } }).theme.play).toBe("");
  });

  it("copies style colours instead of sharing the loaded object", () => {
    const palette = { "csgo-ink": "#ffaa00" };
    const theme = normalizeDoc({ theme: { palette } }).theme;
    expect(theme.palette).toEqual(palette);
    expect(theme.palette).not.toBe(palette);
  });

  it("refuses colours that are not #rrggbb, so a shared look cannot load anything from the web", () => {
    const theme = normalizeDoc({ theme: { accent: "url(https://example.com/beacon)", text: 3 } }).theme;
    expect(theme.accent).toBe(DEFAULT_THEME.accent);
    expect(theme.text).toBe(DEFAULT_THEME.text);
  });

  it("keeps only real colours among style colours", () => {
    const palette = normalizeDoc({ theme: { palette: { "csgo-ink": "#ffaa00", "csgo-bar": "url(x)" } } }).theme.palette;
    expect(palette).toEqual({ "csgo-ink": "#ffaa00" });
  });

  it("falls back to known ids for a style, font or backdrop it does not know", () => {
    const theme = normalizeDoc({ theme: { skin: "evil", displayFont: "comic", backdrop: { kind: "iframe" } } }).theme;
    expect([theme.skin, theme.displayFont, theme.backdrop.kind]).toEqual([
      DEFAULT_THEME.skin,
      DEFAULT_THEME.displayFont,
      DEFAULT_THEME.backdrop.kind,
    ]);
  });

  it("repairs a shared backdrop's pick, figure look, texts and switches", () => {
    const backdrop = normalizeDoc({
      theme: { backdrop: { pick: "everything", figureLook: "evil", mapId: 7, isNameOn: "yes", figureScale: "big" } },
    }).theme.backdrop;
    const base = DEFAULT_THEME.backdrop;
    expect([backdrop.pick, backdrop.figureLook, backdrop.mapId, backdrop.isNameOn, backdrop.figureScale]).toEqual([
      base.pick,
      base.figureLook,
      base.mapId,
      base.isNameOn,
      base.figureScale,
    ]);
  });

  it("drops pieces the stage cannot draw instead of failing on them", () => {
    const good = { id: "a", kind: "clock", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, z: 1, style: {}, props: {} };
    const stages = normalizeDoc({ stages: { home: [{}, { id: "b", kind: "clock", rect: { x: "1" } }, good] } }).stages;
    expect(stages.home?.map((piece) => piece.id)).toEqual(["a"]);
  });

  it("clears a piece accent that is not a colour", () => {
    const piece = { id: "a", kind: "clock", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, style: { accent: "red;x" } };
    expect(normalizeDoc({ stages: { home: [piece] } }).stages.home?.[0]?.style.accent).toBe("");
  });

  it("stills a piece saved with the retired 3D tilt or style's-own hover", () => {
    const saved = (hover: string) => ({ id: "a", kind: "clock", rect: { x: 0, y: 0, w: 0.2, h: 0.1 }, style: { hover } });
    const hovers = normalizeDoc({ stages: { home: [saved("tilt"), saved("auto"), saved("lift")] } }).stages.home?.map((piece) => piece.style.hover);
    expect(hovers).toEqual(["none", "none", "lift"]);
  });

  it("keeps only real stages, never a shared file's own keys", () => {
    const good = { id: "a", kind: "clock", rect: { x: 0, y: 0, w: 0.2, h: 0.1 } };
    const raw = JSON.parse(`{"stages":{"home":[],"__proto__":[${JSON.stringify(good)}],"evil":[]}}`);
    expect(Object.keys(normalizeDoc(raw).stages)).toEqual(["home"]);
  });

  it("keeps style layout revisions only as numbers under known styles", () => {
    const layouts = normalizeDoc({ layouts: { csgo: 3, evil: 1, cs2: "x" } }).layouts;
    expect(layouts).toEqual({ csgo: 3 });
  });
});
