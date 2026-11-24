import { describe, expect, it } from "vitest";
import type { StoreItem } from "~/bindings/StoreItem";
import type { StoreView } from "~/bindings/StoreView";
import { bundleOff, clock, cost, isOnSale, shelvesOf } from "./storeShelves";

const item = (id: string): StoreItem => ({
  id,
  skin_id: null,
  name: id,
  image: null,
  price: 1775,
  discounted_price: null,
  discount_percent: null,
  currency: "vp",
  edition: null,
});

const view = (overrides: Partial<StoreView>): StoreView => ({
  daily: [item("a")],
  daily_ends_in_s: 100,
  bundles: [],
  night_market: null,
  night_market_ends_in_s: 0,
  accessories: [],
  accessories_end_in_s: 0,
  observed_at_ms: 0,
  ...overrides,
});

describe("shelvesOf", () => {
  it("always has today's offers and leaves out empty sections", () => {
    expect(shelvesOf(view({ night_market: [] })).map((shelf) => shelf.id)).toEqual(["daily"]);
  });

  it("lists the bundle under its own name, then the night market and accessories", () => {
    const bundle = { name: "Reaver", image: null, price: 7100, discounted_price: null, ends_in_s: 5, items: [item("b")] };
    const shelves = shelvesOf(view({ bundles: [bundle], night_market: [item("n")], accessories: [item("c")] }));
    expect(shelves.map((shelf) => shelf.label)).toEqual(["Daily offers", "Reaver", "Night market", "Accessories"]);
  });
});

describe("clock", () => {
  it("pads hours, minutes and seconds and counts whole days apart", () => {
    expect([clock(3725), clock(90061), clock(-5)]).toEqual(["01:02:05", "1d 01:01:01", "00:00:00"]);
  });
});

describe("prices", () => {
  it("charges the discounted price and calls it a sale only when it differs", () => {
    const sale = { price: 100, discounted_price: 70 };
    expect([cost(sale), isOnSale(sale), isOnSale({ price: 100, discounted_price: 100 })]).toEqual([70, true, false]);
  });

  it("rounds a bundle's discount to whole percent", () => {
    const bundle = { name: "", image: null, price: 300, discounted_price: 200, ends_in_s: 0, items: [] };
    expect(bundleOff(bundle)).toBe(33);
  });
});
