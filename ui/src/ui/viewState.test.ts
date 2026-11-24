import { describe, expect, it } from "vitest";
import { viewStateOf } from "./viewState";

function source(isLoading: boolean, error: string | null) {
  return { isLoading: () => isLoading, error: () => error };
}

describe("viewStateOf", () => {
  it("reads loading first, even over an old error", () => {
    expect(viewStateOf(source(true, "offline"))).toBe("loading");
  });

  it("reads an error once loading stops", () => {
    expect(viewStateOf(source(false, "offline"))).toBe("error");
  });

  it("reads idle with neither", () => {
    expect(viewStateOf(source(false, null))).toBe("idle");
  });
});
