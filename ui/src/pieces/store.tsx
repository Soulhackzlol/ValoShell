// Store pieces (view only): today's four skins, the featured bundle, the night market and the
// accessory rotation, each with a live countdown to the next refresh.
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { RefreshCw } from "lucide-solid";
import type { StoreItem } from "~/bindings/StoreItem";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { storeView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty } from "~/ui/controls";
import { ViewStatus } from "~/ui/ViewStatus";
import styles from "./store.module.css";

export function useNow(intervalMs = 1000): () => number {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => window.clearInterval(timer));
  return now;
}

/** `12h 04m` / `3d 2h` from seconds. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${(seconds % 60).toString().padStart(2, "0")}s`;
}

/** Seconds left on a section, counting down from when the store answered. */
export function remaining(endsInS: number, observedAtMs: number, now: number): number {
  return endsInS - (now - observedAtMs) / 1000;
}

export function useStore(): void {
  onMount(() => {
    if (!storeView.value()) void storeView.load();
  });
}

function Price(props: { item: StoreItem }) {
  return (
    <span class={styles.price}>
      <Show when={props.item.discounted_price !== null && props.item.discounted_price !== props.item.price}>
        <s class="num">{props.item.price.toLocaleString()}</s>
      </Show>
      <b class="num">{(props.item.discounted_price ?? props.item.price).toLocaleString()}</b>
      <span class={styles.currency}>{props.item.currency.toUpperCase()}</span>
    </span>
  );
}

function ItemCard(props: { item: StoreItem; index: number; isWide?: boolean }) {
  return (
    <article class={styles.item} data-wide={props.isWide ? "" : undefined} style={{ "--stagger": props.index }} onMouseEnter={() => playCue("hover")}>
      <Show when={props.item.discount_percent}>
        {(percent) => <span class={styles.discount}>-{percent()}%</span>}
      </Show>
      <div class={styles.itemArt}>
        <Art src={props.item.image} fallback={<span class={styles.noArt}>{props.item.name.slice(0, 1)}</span>} />
      </div>
      <div class={styles.itemInfo}>
        <span class={styles.itemName}>{props.item.name}</span>
        <Price item={props.item} />
      </div>
    </article>
  );
}

export function Status(props: { what: string }) {
  return <ViewStatus view={storeView} title={props.what} loading="Opening the store…" idle="Connect to VALORANT to see the store." />;
}

export function StoreDaily(_props: PieceProps) {
  useStore();
  const now = useNow();
  return (
    <Show when={storeView.value()} fallback={<Status what="Daily offers" />}>
      {(view) => (
        <section class={styles.section}>
          <header class={styles.header}>
            <h2 class={styles.title}>Daily offers</h2>
            <span class={`${styles.timer} num`}>{formatDuration(remaining(view().daily_ends_in_s, view().observed_at_ms, now()))}</span>
            <button
              class={styles.refresh}
              title="Refresh"
              disabled={storeView.isLoading()}
              onClick={() => void storeView.load(true)}
            >
              <RefreshCw size={14} />
            </button>
          </header>
          <div class={styles.dailyGrid}>
            <For each={view().daily}>{(item, index) => <ItemCard item={item} index={index()} isWide />}</For>
          </div>
        </section>
      )}
    </Show>
  );
}

export function StoreBundle(_props: PieceProps) {
  useStore();
  const now = useNow();
  const [shown, setShown] = createSignal(0);
  return (
    <Show when={storeView.value()} fallback={<Status what="Featured" />}>
      {(view) => (
        <Show when={view().bundles[shown()] ?? view().bundles[0]} fallback={<Empty title="Featured">No bundle right now.</Empty>}>
          {(bundle) => (
            <section class={styles.bundle}>
              {/* Keyed on the art, so switching bundles fades the new one in. */}
              <Show keyed when={bundle().image ?? ""}>
                <div class={styles.bundleArt}>
                  <Art src={bundle().image} fallback={<span />} />
                </div>
              </Show>
              <div class={styles.bundleShade} />
              <div class={styles.bundleInfo}>
                <span class="overline">Featured · {formatDuration(remaining(bundle().ends_in_s, view().observed_at_ms, now()))}</span>
                <h2 class={styles.bundleName}>{bundle().name}</h2>
                <span class={styles.price}>
                  <Show when={bundle().discounted_price !== null}>
                    <s class="num">{bundle().price.toLocaleString()}</s>
                  </Show>
                  <b class="num">{(bundle().discounted_price ?? bundle().price).toLocaleString()}</b>
                  <span class={styles.currency}>VP</span>
                </span>
                <Show when={view().bundles.length > 1}>
                  <div class={styles.dots}>
                    <For each={view().bundles}>
                      {(_, index) => (
                        <button class={styles.dot} data-active={index() === shown() ? "" : undefined} onClick={() => setShown(index())} />
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class={styles.bundleItems}>
                <For each={bundle().items}>{(item, index) => <ItemCard item={item} index={index()} />}</For>
              </div>
            </section>
          )}
        </Show>
      )}
    </Show>
  );
}

export function NightMarket(_props: PieceProps) {
  useStore();
  const now = useNow();
  return (
    <Show when={storeView.value()} fallback={<Status what="Night market" />}>
      {(view) => (
        <Show when={view().night_market} fallback={<Empty title="Night market">Not open right now.</Empty>}>
          {(items) => (
            <section class={`${styles.section} ${styles.night}`}>
              <header class={styles.header}>
                <h2 class={styles.title}>Night market</h2>
                <span class={`${styles.timer} num`}>
                  {formatDuration(remaining(view().night_market_ends_in_s, view().observed_at_ms, now()))}
                </span>
              </header>
              <div class={styles.nightGrid}>
                <For each={items()}>{(item, index) => <ItemCard item={item} index={index()} />}</For>
              </div>
            </section>
          )}
        </Show>
      )}
    </Show>
  );
}

export function StoreAccessories(_props: PieceProps) {
  useStore();
  const now = useNow();
  return (
    <Show when={storeView.value()} fallback={<Status what="Accessories" />}>
      {(view) => (
        <section class={styles.section}>
          <header class={styles.header}>
            <h2 class={styles.title}>Accessories</h2>
            <span class={`${styles.timer} num`}>{formatDuration(remaining(view().accessories_end_in_s, view().observed_at_ms, now()))}</span>
          </header>
          <div class={styles.accessoryGrid}>
            <For each={view().accessories}>{(item, index) => <ItemCard item={item} index={index()} />}</For>
          </div>
        </section>
      )}
    </Show>
  );
}
