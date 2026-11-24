import { describe, expect, it } from "vitest";
import { defaultDoc } from "../defaults";
import { communityFile, fileIdOf, shareProblems, uniqueFileId } from "./communityShare";

const META = { name: "Neon Night", author: "Mia", description: "Pink and black." };

describe("fileIdOf", () => {
  it("turns a name into a lowercase dashed file id", () => {
    expect(fileIdOf("  Neon Night 2!  ")).toBe("neon-night-2");
  });

  it("drops accents instead of splitting words on them", () => {
    expect(fileIdOf("Crème Brûlée")).toBe("creme-brulee");
  });

  it("falls back to a fixed id when nothing usable is left", () => {
    expect(fileIdOf("★★★")).toBe("my-look");
  });
});

describe("uniqueFileId", () => {
  it("adds a short random part so equal names get different files", () => {
    expect(uniqueFileId("Neon Night", () => 0)).toBe("neon-night-0000");
    expect(uniqueFileId("Neon Night", () => 0.5)).not.toBe(uniqueFileId("Neon Night", () => 0.25));
  });

  it("stays within the 64-character id limit for long names", () => {
    expect(uniqueFileId("x".repeat(100)).length).toBeLessThanOrEqual(64);
  });
});

describe("shareProblems", () => {
  it("accepts a named look that loads nothing from the web", () => {
    expect(shareProblems(META, defaultDoc())).toEqual([]);
  });

  it("asks for a name", () => {
    expect(shareProblems({ ...META, name: "  " }, defaultDoc())).toEqual(["Give the look a name."]);
  });

  it("refuses a look with an image backdrop from the web, naming the site", () => {
    const look = defaultDoc();
    look.theme.backdrop.url = "https://example.com/bg.png";
    expect(shareProblems(META, look).join(" ")).toContain("example.com");
  });
});

describe("communityFile", () => {
  it("puts the trimmed credit block before the look", () => {
    const file = JSON.parse(communityFile({ ...META, author: " Mia " }, defaultDoc()));
    expect(Object.keys(file)[0]).toBe("community");
    expect(file.community).toEqual(META);
    expect(file.theme).toBeTypeOf("object");
  });
});
