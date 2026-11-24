// The store in the Glass style: the featured bundle as one big rounded card with its items as
// frosted tiles along its foot, today's offers down the side, each item lit by its edition's
// colour. View only, like every store front: prices are labels and buying happens in VALORANT.
import { For, Match, Show, Switch, createSignal } from "solid-js";
import type { StoreItem } from "~/bindings/StoreItem";
import type { StoreView } from "~/bindings/StoreView";
import { playCue } from "~/menu/sound";
import { formatDuration } from "./store";
import { BundleArt, EDITION_TINT, ItemArt, gradeOf, partsOf } from "./storeArt";
import { pointerGlow } from "./styled/glassMotion";
import type { FrontProps } from "./storeShelves";
import styles from "./glassStore.module.css";

type Tab = "featured" | "night" | "accessories";

interface Priced {
  price: number;
  discounted_price: number | null;
}

const hover = () => playCue("hover");

/** Price pill: the old price struck through when on sale; "Included" when the bundle gives it. */
function Price(props: { item: Priced; currency: string }) {
  const now = () => props.item.discounted_price ?? props.item.price;
  const isOnSale = () => props.item.discounted_price !== null && props.item.discounted_price !== props.item.price;
  return (
    <span class={styles.price} data-free={now() === 0 ? "" : undefined}>
      <Show when={now() > 0} fallback="Included">
        <Show when={isOnSale()}>
          <s>{props.item.price.toLocaleString()}</s>
        </Show>
        <b>{now().toLocaleString()}</b> {props.currency.toUpperCase()}
      </Show>
    </span>
  );
}

/** One item: its art on a glow of its edition colour, name, edition and price. */
function ItemTile(props: { item: StoreItem; index: number; size: "small" | "row" | "large" }) {
  const edition = () => gradeOf(props.item);
  const name = () => {
    const parts = partsOf(props.item);
    return props.size === "small" ? parts.base : props.item.name;
  };
  return (
    <article
      class={styles.tile}
      data-size={props.size}
      style={{ "--tint": EDITION_TINT[edition().tone], "--i": props.index }}
      onMouseEnter={hover}
    >
      <div class={styles.tileArt}>
        <ItemArt item={props.item} class={styles.tileImage} />
      </div>
      <footer class={styles.tileText}>
        <span class={styles.tileName}>{name()}</span>
        <span class={styles.tileMeta}>
          <Show when={props.size !== "small"}>
            <i class={styles.dot} />
            {edition().name}
          </Show>
          <Price item={props.item} currency={props.item.currency} />
        </span>
      </footer>
    </article>
  );
}

function Hero(props: FrontProps) {
  return (
    <Show when={props.view.bundles[0]}>
      {(bundle) => (
        <section ref={(element) => pointerGlow(element)} class={styles.hero} onMouseEnter={hover}>
          <BundleArt bundle={bundle()} class={styles.heroArt} />
          <span class={styles.heroShade} />
          <span class={styles.glare} />
          <div class={styles.heroInfo}>
            <span class={styles.capsule}>Featured · {formatDuration(props.left(bundle().ends_in_s))} left</span>
            <h2 class={styles.heroName}>{bundle().name}</h2>
            <Price item={bundle()} currency="VP" />
          </div>
          <div class={styles.heroItems}>
            <For each={bundle().items}>{(item, index) => <ItemTile item={item} index={index()} size="small" />}</For>
          </div>
        </section>
      )}
    </Show>
  );
}

export function GlassFront(props: FrontProps) {
  const [tab, setTab] = createSignal<Tab>("featured");
  const tabs = (): { id: Tab; label: string }[] => [
    { id: "featured", label: "Featured" },
    ...(props.view.night_market?.length ? [{ id: "night" as const, label: "Night market" }] : []),
    ...(props.view.accessories.length ? [{ id: "accessories" as const, label: "Accessories" }] : []),
  ];
  const shelf = () => (tab() === "night" ? (props.view.night_market ?? []) : props.view.accessories);
  const shelfEnds = () => (tab() === "night" ? props.view.night_market_ends_in_s : props.view.accessories_end_in_s);
  return (
    <div class={styles.front}>
      <header class={styles.head}>
        <nav class={styles.tabs}>
          <For each={tabs()}>
            {(option) => (
              <button
                data-active={tab() === option.id ? "" : undefined}
                onMouseEnter={hover}
                onClick={() => {
                  playCue("tab");
                  setTab(option.id);
                }}
              >
                {option.label}
              </button>
            )}
          </For>
        </nav>
        <Show when={tab() !== "featured"}>
          <span class={styles.capsule}>Refreshes in {formatDuration(props.left(shelfEnds()))}</span>
        </Show>
      </header>
      <div class={styles.body}>
        <Switch>
          <Match when={tab() === "featured"}>
            <Hero {...props} />
          </Match>
          <Match when={true}>
            <section class={styles.shelf}>
              <For each={shelf()}>{(item, index) => <ItemTile item={item} index={index()} size="large" />}</For>
            </section>
          </Match>
        </Switch>
        <aside class={styles.offers}>
          <header class={styles.offersHead}>
            <h2>Today's offers</h2>
            <span>{formatDuration(props.left(props.view.daily_ends_in_s))}</span>
          </header>
          <For each={props.view.daily}>{(item, index) => <ItemTile item={item} index={index()} size="row" />}</For>
        </aside>
      </div>
    </div>
  );
}
