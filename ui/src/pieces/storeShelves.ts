// What every store front reads from the store view: its sections ("shelves") with their own
// countdowns, and the price helpers. View only: prices are labels, buying happens in VALORANT.
import { createSignal } from "solid-js";
import type { BundleView } from "~/bindings/BundleView";
import type { StoreItem } from "~/bindings/StoreItem";
import type { StoreView } from "~/bindings/StoreView";

export type ShelfId = "daily" | "featured" | "night" | "accessories";

/** One section of the store with its own countdown. */
export interface Shelf {
  id: ShelfId;
  label: string;
  items: StoreItem[];
  endsInS: number;
}

/** What each store front is given. */
export interface FrontProps {
  view: StoreView;
  /** Seconds left on a section, live. */
  left: (endsInS: number) => number;
}

/** The sections on sale now, in the client's order; empty ones are left out. */
export function shelvesOf(view: StoreView): Shelf[] {
  const shelves: Shelf[] = [{ id: "daily", label: "Daily offers", items: view.daily, endsInS: view.daily_ends_in_s }];
  const bundle = view.bundles[0];
  if (bundle) shelves.push({ id: "featured", label: bundle.name, items: bundle.items, endsInS: bundle.ends_in_s });
  if (view.night_market?.length) {
    shelves.push({
      id: "night",
      label: "Night market",
      items: view.night_market,
      endsInS: view.night_market_ends_in_s,
    });
  }
  if (view.accessories.length) {
    shelves.push({
      id: "accessories",
      label: "Accessories",
      items: view.accessories,
      endsInS: view.accessories_end_in_s,
    });
  }
  return shelves;
}

/** One item on sale, knowing the shelf (and clock) it came from. */
export interface Stock {
  item: StoreItem;
  shelf: Shelf;
}

/** Every item on sale, in shelf order. */
export function stockOf(shelves: Shelf[]): Stock[] {
  return shelves.flatMap((shelf) => shelf.items.map((item) => ({ item, shelf })));
}

/** The item a list-and-detail store shows: the one last pointed at or focused, else the first.
 *  `onChange` runs only when the pick really changes, so a hover cue doesn't repeat. */
export function usePickedStock(stock: () => Stock[], onChange: () => void) {
  const [pickedId, setPickedId] = createSignal<string | null>(null);
  const picked = () => stock().find((entry) => entry.item.id === pickedId()) ?? stock()[0];
  const pick = (entry: Stock) => {
    if (picked()?.item.id === entry.item.id) return;
    onChange();
    setPickedId(entry.item.id);
  };
  return { picked, pick };
}

/** `09:20:14`, or `5d 01:00:00` past a day: the clocks consoles and old menus show. */
export function clock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const pad = (value: number) => value.toString().padStart(2, "0");
  const time = `${pad(Math.floor((seconds % 86400) / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return days > 0 ? `${days}d ${time}` : time;
}

export function cost(item: { price: number; discounted_price: number | null }): number {
  return item.discounted_price ?? item.price;
}

export function isOnSale(item: { price: number; discounted_price: number | null }): boolean {
  return item.discounted_price !== null && item.discounted_price !== item.price;
}

/** Whole percent off a bundle, or null at full price. */
export function bundleOff(bundle: BundleView): number | null {
  return isOnSale(bundle) ? Math.round((1 - cost(bundle) / bundle.price) * 100) : null;
}
