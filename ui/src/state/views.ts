// Read-only views loaded on demand (store, career): fetched when a scene needs them and again
// when the player comes back to the menus after a match.
import { createRoot, createSignal } from "solid-js";
import type { CareerView } from "~/bindings/CareerView";
import type { CollectionView } from "~/bindings/CollectionView";
import type { HistoryView } from "~/bindings/HistoryView";
import type { IdentityView } from "~/bindings/IdentityView";
import type { LeaderboardView } from "~/bindings/LeaderboardView";
import type { NewsView } from "~/bindings/NewsView";
import type { ProgressView } from "~/bindings/ProgressView";
import type { StatsView } from "~/bindings/StatsView";
import type { StoreView } from "~/bindings/StoreView";
import { call, errorText } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { valLang } from "~/pieces/styled/valText";

export interface Loadable<T> {
  value: () => T | null;
  error: () => string | null;
  isLoading: () => boolean;
  load: (isForced?: boolean) => Promise<void>;
  /** Replace the value with a newer answer (e.g. the result of an action). */
  set: (next: T) => void;
}

function loadable<T>(fetcher: (isForced: boolean) => Promise<T>): Loadable<T> {
  return createRoot(() => {
    const [value, setValue] = createSignal<T | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [isLoading, setLoading] = createSignal(false);
    const load = async (isForced = false) => {
      if (isLoading()) return;
      setLoading(true);
      try {
        const next = await fetcher(isForced);
        setValue(() => next);
        setError(null);
      } catch (failure) {
        setError(errorText(failure));
      } finally {
        setLoading(false);
      }
    };
    return { value, error, isLoading, load, set: (next: T) => setValue(() => next) };
  });
}

export const storeView = loadable<StoreView>((isForced) => call("get_store", { isForced }));
export const careerView = loadable<CareerView>((isForced) => call("get_career", { isForced }));
export const progressView = loadable<ProgressView>((isForced) => call("get_progress", { isForced }));
export const leaderboardView = loadable<LeaderboardView>((isForced) => call("get_leaderboard", { isForced }));
export const statsView = loadable<StatsView>((isForced) => call("get_stats", { isForced }));
export const historyView = loadable<HistoryView>((isForced) => call("get_match_history", { isForced }));
export const collectionView = loadable<CollectionView>(() => call("get_collection", {}));
export const identityView = loadable<IdentityView>(() => call("get_identity", {}));
/** VALORANT's news in the style's language (null when the site cannot be read). */
export const newsView = loadable<NewsView | null>(() => call("get_news", { locale: valLang() === "es" ? "es-es" : "en-us" }));

// After a match, rank, RR, XP and missions changed: refresh what was already loaded.
let lastPhase = "";
onAppEvent("game_state", (snapshot) => {
  if (snapshot.phase === "menus" && lastPhase === "ingame") {
    if (careerView.value()) void careerView.load(true);
    if (progressView.value()) void progressView.load(true);
    if (statsView.value()) void statsView.load(true);
  }
  lastPhase = snapshot.phase;
});
onAppEvent("connection", (status) => {
  if (status.state === "connected") {
    if (careerView.value() || careerView.error()) void careerView.load(true);
    if (storeView.value() || storeView.error()) void storeView.load(true);
    if (progressView.value() || progressView.error()) void progressView.load(true);
    if (leaderboardView.value() || leaderboardView.error()) void leaderboardView.load(true);
    if (statsView.value() || statsView.error()) void statsView.load(true);
    // Identity reloads itself (state/identity.ts).
    if (collectionView.value() || collectionView.error()) void collectionView.load(true);
  }
});
