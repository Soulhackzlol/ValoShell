import { describe, expect, it } from "vitest";
import { anchorOf, pieceContextOf, shapeOf, sizeTierOf } from "./pieceContext";

describe("sizeTierOf", () => {
  it("calls a corner badge tiny", () => {
    expect(sizeTierOf(160, 90)).toBe("tiny");
  });

  it("calls a compact card small", () => {
    expect(sizeTierOf(320, 180)).toBe("small");
  });

  it("needs both room across and room down to be large", () => {
    expect([sizeTierOf(900, 300), sizeTierOf(900, 500)]).toEqual(["medium", "large"]);
  });
});

describe("shapeOf", () => {
  it("tells strips, columns and blocks apart", () => {
    expect([shapeOf(800, 120), shapeOf(200, 600), shapeOf(400, 360)]).toEqual(["wide", "tall", "square"]);
  });
});

describe("anchorOf", () => {
  it("names the corner a piece sits in", () => {
    expect(anchorOf({ x: 0.02, y: 0.8, w: 0.2, h: 0.15 })).toBe("bottom-left");
  });

  it("names an edge when the piece is centred on the other axis", () => {
    expect(anchorOf({ x: 0.3, y: 0.02, w: 0.4, h: 0.1 })).toBe("top");
  });

  it("calls a piece over the middle centred", () => {
    expect(anchorOf({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 })).toBe("center");
  });
});

describe("pieceContextOf", () => {
  it("puts size, shape and place together", () => {
    expect(pieceContextOf({ x: 0.8, y: 0.05, w: 0.18, h: 0.1 }, 280, 90)).toEqual({ size: "tiny", shape: "wide", anchor: "top-right" });
  });
});
