// Store wishlist: skins the player wants, kept in ValoShell's settings (in-app only), and the
// ones today's store or Night Market is selling.
import { createMemo, createRoot } from "solid-js";
import type { StoreItem } from "~/bindings/StoreItem";
import { settings, updateSettings } from "./settings";
import { storeView } from "./views";

const wishedIds = createRoot(() => createMemo(() => settings()?.collection.wishlist_skins ?? []));
const wishedSet = createRoot(() => createMemo(() => new Set(wishedIds())));

/** Wished skin ids, oldest first. */
export { wishedIds };

export function isWished(skinId: string): boolean {
  return wishedSet().has(skinId.toLowerCase());
}

export function toggleWish(skinId: string): void {
  const id = skinId.toLowerCase();
  updateSettings((draft) => {
    const current = draft.collection.wishlist_skins;
    draft.collection.wishlist_skins = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
  });
}

/** Offers in the loaded store (daily and Night Market) that sell a wished skin. */
export const wishedOnSale = createRoot(() =>
  createMemo((): StoreItem[] => {
    const view = storeView.value();
    if (!view) return [];
    return [...view.daily, ...(view.night_market ?? [])].filter((item) => item.skin_id !== null && isWished(item.skin_id));
  }),
);
