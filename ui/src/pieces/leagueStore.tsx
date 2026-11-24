// The store in the League style, after the client's Store: gold serif tabs along the top (the
// night market as "Your Shop", League's own personal-discount shelf), the featured bundle as a
// framed banner, and items as tall gold-rimmed cards with the price beside a small coin. View
// only: buying happens in VALORANT.
import { For, Show, createMemo, createSignal } from "solid-js";
import { playCue } from "~/menu/sound";
import { BundleArt, ItemArt, gradeOf } from "./storeArt";
import { type FrontProps, type ShelfId, clock, cost, isOnSale, shelvesOf } from "./storeShelves";
import styles from "./leagueStore.module.css";

const TAB_NAMES: Record<ShelfId, string> = {
  featured: "Featured",
  daily: "Skins",
  night: "Your shop",
  accessories: "Accessories",
};

/** The client opens on Featured; the shelves keep their order after it. */
const TAB_ORDER: readonly ShelfId[] = ["featured", "daily", "night", "accessories"];

function Price(props: { item: { price: number; discounted_price: number | null }; currency: string }) {
  return (
    <span class={styles.price}>
      <i class={styles.coin} data-currency={props.currency} aria-hidden="true" />
      <Show when={isOnSale(props.item)}>
        <s>{props.item.price.toLocaleString()}</s>
      </Show>
      <b>{cost(props.item).toLocaleString()}</b>
    </span>
  );
}

export function LeagueFront(props: FrontProps) {
  const shelves = createMemo(() => [...shelvesOf(props.view)].sort((a, b) => TAB_ORDER.indexOf(a.id) - TAB_ORDER.indexOf(b.id)));
  const [picked, setPicked] = createSignal<ShelfId | null>(null);
  const shelf = () => shelves().find((option) => option.id === picked()) ?? shelves()[0];
  const pick = (id: ShelfId) => {
    playCue("tab");
    setPicked(id);
  };
  return (
    <section class={styles.store} data-own-frame>
      <nav class={styles.tabs}>
        <For each={shelves()}>
          {(option) => (
            <button class={styles.tab} data-on={shelf()?.id === option.id ? "" : undefined} onClick={() => pick(option.id)}>
              {TAB_NAMES[option.id]}
            </button>
          )}
        </For>
        <Show when={shelf()}>{(current) => <span class={`${styles.timer} num`}>Ends in {clock(props.left(current().endsInS))}</span>}</Show>
      </nav>
      <div class={styles.body}>
        <Show when={shelf()?.id === "featured" ? props.view.bundles[0] : undefined}>
          {(bundle) => (
            <article class={styles.banner}>
              <BundleArt bundle={bundle()} class={styles.bannerArt} />
              <div class={styles.bannerText}>
                <span class={styles.kicker}>Bundle</span>
                <h3>{bundle().name}</h3>
                <Price item={bundle()} currency="vp" />
              </div>
            </article>
          )}
        </Show>
        <div class={styles.grid}>
          <For each={shelf()?.items ?? []}>
            {(item) => (
              <article class={styles.card} onMouseEnter={() => playCue("hover")}>
                <div class={styles.cardArt}>
                  <ItemArt item={item} class={styles.cardImage} />
                </div>
                <span class={styles.cardName}>{item.name}</span>
                <span class={styles.cardMeta}>
                  {gradeOf(item).name}
                  <Price item={item} currency={item.currency} />
                </span>
              </article>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
