import { describe, expect, it, vi } from "vitest";

vi.mock("~/ipc/commands", () => ({ call: () => Promise.resolve(["SKIN-GAME"]) }));
vi.mock("~/ipc/events", () => ({ onAppEvent: () => undefined }));
vi.mock("./settings", () => ({
  settings: () => ({ collection: { favorite_skins: ["skin-local"] } }),
  updateSettings: () => undefined,
}));

const { isFavoriteSkin, isGameFavoriteSkin, refreshGameFavorites } = await import("./favorites");

describe("isFavoriteSkin", () => {
  it("counts ValoShell's stars and VALORANT's favourites, in any case", async () => {
    await refreshGameFavorites();
    expect(isFavoriteSkin("SKIN-LOCAL")).toBe(true);
    expect(isFavoriteSkin("skin-game")).toBe(true);
    expect(isFavoriteSkin("other")).toBe(false);
  });
});

describe("isGameFavoriteSkin", () => {
  it("is true only for VALORANT's own favourites", async () => {
    await refreshGameFavorites();
    expect(isGameFavoriteSkin("Skin-Game")).toBe(true);
    expect(isGameFavoriteSkin("skin-local")).toBe(false);
  });
});
