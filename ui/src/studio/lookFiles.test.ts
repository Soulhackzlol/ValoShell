import { describe, expect, it } from "vitest";
import { defaultDoc, piece } from "./defaults";
import { isLookFile, isLookShape, remoteHosts } from "./lookFiles";

describe("isLookFile", () => {
  it("takes .json files whatever their case", () => {
    expect(isLookFile(new File(["{}"], "Sakura.JSON"))).toBe(true);
  });

  it("leaves images to the image drop", () => {
    expect(isLookFile(new File([""], "banner.png", { type: "image/png" }))).toBe(false);
  });
});

describe("isLookShape", () => {
  it("accepts a Studio document", () => {
    expect(isLookShape(JSON.parse(JSON.stringify(defaultDoc())))).toBe(true);
  });

  it("refuses unrelated JSON, so it is never applied as a look", () => {
    expect(isLookShape({ name: "package", version: "1.0.0" })).toBe(false);
    expect(isLookShape([1, 2, 3])).toBe(false);
    expect(isLookShape(null)).toBe(false);
  });

  it("refuses a look whose parts are missing or null", () => {
    expect(isLookShape({ theme: null, stages: {} })).toBe(false);
  });
});

describe("remoteHosts", () => {
  it("names each site a look loads from once, from widgets and the backdrop", () => {
    const doc = defaultDoc();
    doc.theme.backdrop.url = "https://images.example.com/bg.png";
    doc.stages.home = [
      piece("web", { x: 0, y: 0, w: 0.3, h: 0.3 }, 1, { url: "https://www.youtube.com/embed/x" }),
      piece("image", { x: 0, y: 0, w: 0.3, h: 0.3 }, 2, { url: "https://images.example.com/a.gif" }),
    ];

    expect(remoteHosts(doc)).toEqual(["images.example.com", "www.youtube.com"]);
  });

  it("finds links in any widget field and protocol-relative links", () => {
    const doc = defaultDoc();
    doc.stages.home = [
      piece("collage", { x: 0, y: 0, w: 0.3, h: 0.3 }, 1, { image1: "https://cdn.example.org/a.png" }),
      piece("sprays", { x: 0, y: 0, w: 0.3, h: 0.3 }, 2, { spray1: "//tracker.example.net/p.gif" }),
    ];

    expect(remoteHosts(doc)).toEqual(["cdn.example.org", "tracker.example.net"]);
  });

  it("ignores inline images and anything that is not a web link", () => {
    const doc = defaultDoc();
    doc.stages.home = [piece("image", { x: 0, y: 0, w: 0.3, h: 0.3 }, 1, { url: "data:image/png;base64,AAAA" })];

    expect(remoteHosts(doc)).toEqual([]);
  });
});
