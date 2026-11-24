// Favourite skins: starred in the skin picker, listed first there. Two sources count: the
// stars kept in ValoShell's own settings (they follow the settings file) and the player's
// in-game VALORANT favourites, read once on connect. Riot's list is read only: starring here
// never writes to the account.
import { createMemo, createRoot, createSignal } from "solid-js";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { settings, updateSettings } from "./settings";

const [gameFavorites, setGameFavorites] = createSignal<readonly string[]>([]);

const favoriteSkins = createRoot(() =>
  createMemo(
    () =>
      new Set([
        ...(settings()?.collection.favorite_skins ?? []),
        ...gameFavorites(),
      ]),
  ),
);

/** Starred here or in VALORANT. */
export function isFavoriteSkin(skinId: string): boolean {
  return favoriteSkins().has(skinId.toLowerCase());
}

/** Starred in VALORANT itself: unstarring here cannot clear it (the picker can say so). */
export function isGameFavoriteSkin(skinId: string): boolean {
  return gameFavorites().includes(skinId.toLowerCase());
}

/** Star or unstar one skin in ValoShell's own list; VALORANT's favourites stay untouched. */
export function toggleFavoriteSkin(skinId: string): void {
  const id = skinId.toLowerCase();
  updateSettings((draft) => {
    const current = draft.collection.favorite_skins;
    draft.collection.favorite_skins = current.includes(id)
      ? current.filter((entry) => entry !== id)
      : [...current, id];
  });
}

/** Read the in-game favourites; a failed read keeps the last answer. */
export async function refreshGameFavorites(): Promise<void> {
  try {
    setGameFavorites(
      (await call("get_favorite_skins", {})).map((id) => id.toLowerCase()),
    );
  } catch (error) {
    // The local stars still work; only VALORANT's own are missing.
    console.warn("favorite_skins_read_failed", error);
  }
}

void refreshGameFavorites();
onAppEvent("connection", (status) => {
  if (status.state === "connected") void refreshGameFavorites();
  else setGameFavorites([]);
});
