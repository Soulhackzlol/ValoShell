import { describe, expect, it } from "vitest";
import type { StoreItem } from "~/bindings/StoreItem";
import { rarityOf } from "./nightcityStore";

const item = (price: number, currency = "vp"): StoreItem => ({
  id: String(price),
  skin_id: null,
  name: "Skin",
  image: null,
  price,
  discounted_price: null,
  discount_percent: null,
  currency,
  edition: null,
});

describe("rarityOf", () => {
  it("maps VALORANT's editions onto Cyberpunk's rarity tiers", () => {
    expect(rarityOf(item(875))).toBe("common");
    expect(rarityOf(item(1275))).toBe("uncommon");
    expect(rarityOf(item(1775))).toBe("rare");
    expect(rarityOf(item(2175))).toBe("epic");
    expect(rarityOf(item(2475))).toBe("legendary");
  });

  it("treats accessories as common", () => {
    expect(rarityOf(item(4000, "kc"))).toBe("common");
  });
});
