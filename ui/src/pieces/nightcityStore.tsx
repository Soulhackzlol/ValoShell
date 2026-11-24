// The store in the Night City style, after Cyberpunk 2077's vendor screen: the stock as a grid
// of chamfered tiles with a rarity stripe, and the item under the pointer in a tooltip card with
// a yellow header. VALORANT's editions map onto Cyberpunk's rarity tiers in that game's colours.
// View only: buying happens in VALORANT.
import { For, Show, createMemo } from "solid-js";
import type { StoreItem } from "~/bindings/StoreItem";
import { playCue } from "~/menu/sound";
import { ItemArt, gradeOf, partsOf } from "./storeArt";
import { type FrontProps, type Stock, clock, cost, isOnSale, shelvesOf, stockOf, usePickedStock } from "./storeShelves";
import styles from "./nightcityStore.module.css";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/** Select → Common … Ultra → Legendary; accessories are Common, as junk is in Night City. */
export function rarityOf(item: StoreItem): Rarity {
  const tone = gradeOf(item).tone;
  if (tone === "ultra") return "legendary";
  if (tone === "exclusive") return "epic";
  if (tone === "premium") return "rare";
  return tone === "deluxe" ? "uncommon" : "common";
}

function Tile(props: { entry: Stock; isOn: boolean; onPick: () => void }) {
  return (
    <li
      class={styles.tile}
      data-rarity={rarityOf(props.entry.item)}
      data-on={props.isOn ? "" : undefined}
      tabIndex={0}
      onMouseEnter={() => props.onPick()}
      onFocus={() => props.onPick()}
    >
      <ItemArt item={props.entry.item} class={styles.tileArt} />
      <span class={`${styles.tilePrice} num`}>{cost(props.entry.item).toLocaleString()}</span>
    </li>
  );
}

function Tooltip(props: { entry: Stock; left: FrontProps["left"] }) {
  const item = () => props.entry.item;
  return (
    <aside class={styles.tooltip} data-rarity={rarityOf(item())}>
      <b class={styles.tipName}>{item().name}</b>
      <span class={styles.tipRarity}>
        {rarityOf(item())} · {partsOf(item()).kind}
      </span>
      <ItemArt item={item()} class={styles.tipArt} />
      <span class={styles.tipRow}>
        <span>Price</span>
        <b class="num">
          <Show when={isOnSale(item())}>
            <s>{item().price.toLocaleString()}</s>{" "}
          </Show>
          {cost(item()).toLocaleString()} {item().currency.toUpperCase()}
        </b>
      </span>
      <span class={styles.tipRow}>
        <span>Leaves in</span>
        <b class="num">{clock(props.left(props.entry.shelf.endsInS))}</b>
      </span>
    </aside>
  );
}

export function NightCityFront(props: FrontProps) {
  const stock = createMemo(() => stockOf(shelvesOf(props.view)));
  const { picked, pick } = usePickedStock(stock, () => playCue("hover"));
  return (
    <section class={styles.vendor} data-own-frame>
      <header class={styles.head}>
        <b class={styles.title}>Vendor</b>
        <span class="num">Stock refreshes in {clock(props.left(props.view.daily_ends_in_s))}</span>
      </header>
      <ul class={styles.grid}>
        <For each={stock()}>
          {(entry) => <Tile entry={entry} isOn={picked()?.item.id === entry.item.id} onPick={() => pick(entry)} />}
        </For>
      </ul>
      <Show when={picked()}>{(entry) => <Tooltip entry={entry()} left={props.left} />}</Show>
    </section>
  );
}
