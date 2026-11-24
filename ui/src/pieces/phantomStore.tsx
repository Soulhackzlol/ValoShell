// The store in the Phantom style, after Persona 5's shop counters: the stock as a list of
// slanted cut-out strips down the left (the one under the pointer flips to red), the item shown
// large on the right in a jagged white frame, the shop's name as a ransom note and the clock
// in a red tag. View only: buying happens in VALORANT.
import { For, Show, createMemo } from "solid-js";
import { playCue } from "~/menu/sound";
import { RansomText } from "./styled/phantom";
import { ItemArt, gradeOf } from "./storeArt";
import { type FrontProps, clock, cost, isOnSale, shelvesOf, stockOf, usePickedStock } from "./storeShelves";
import styles from "./phantomStore.module.css";

export function PhantomFront(props: FrontProps) {
  const stock = createMemo(() => stockOf(shelvesOf(props.view)));
  const { picked, pick: focus } = usePickedStock(stock, () => playCue("hover"));
  return (
    <section class={styles.shop} data-own-frame>
      <header class={styles.head}>
        <RansomText text="Shop" class={styles.title} />
        <span class={styles.clock}>Restock {clock(props.left(props.view.daily_ends_in_s))}</span>
      </header>
      <ol class={styles.list}>
        <For each={stock()}>
          {(entry) => (
            <li
              class={styles.strip}
              data-on={picked()?.item.id === entry.item.id ? "" : undefined}
              tabIndex={0}
              onMouseEnter={() => focus(entry)}
              onFocus={() => focus(entry)}
            >
              <span class={styles.stripName}>{entry.item.name}</span>
              <span class={styles.stripPrice}>
                {cost(entry.item).toLocaleString()}
                <small>{entry.item.currency.toUpperCase()}</small>
              </span>
            </li>
          )}
        </For>
      </ol>
      <Show when={picked()}>
        {(entry) => (
          <aside class={styles.detail}>
            <Show when={entry().item} keyed>
              {(item) => (
                <div class={styles.frameShadow}>
                  <div class={styles.frame}>
                    <ItemArt item={item} class={styles.art} />
                  </div>
                </div>
              )}
            </Show>
            <div class={styles.card}>
              <span class={styles.shelf}>{entry().shelf.id === "featured" ? "Bundle" : entry().shelf.label}</span>
              <b class={styles.name}>{entry().item.name}</b>
              <span class={styles.meta}>
                {gradeOf(entry().item).name} edition
                <Show when={isOnSale(entry().item)}> · was {entry().item.price.toLocaleString()}</Show>
                {" · leaves in "}
                {clock(props.left(entry().shelf.endsInS))}
              </span>
            </div>
          </aside>
        )}
      </Show>
    </section>
  );
}
