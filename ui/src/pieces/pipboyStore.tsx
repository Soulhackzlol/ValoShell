// The store in the Pip-Boy style, after Fallout's barter screen: the shelves as bracketed tabs,
// the stock as a plain list whose picked row inverts to solid green, and the picked item tinted
// phosphor-green beside its stat lines (VAL, edition, when it leaves). View only: buying happens
// in VALORANT.
import { For, Show, createMemo, createSignal } from "solid-js";
import { playCue } from "~/menu/sound";
import { ItemArt, gradeOf } from "./storeArt";
import {
  type FrontProps,
  type Shelf,
  type ShelfId,
  type Stock,
  clock,
  cost,
  isOnSale,
  shelvesOf,
  stockOf,
  usePickedStock,
} from "./storeShelves";
import styles from "./pipboyStore.module.css";

/** Fallout's tab names are short caps; the bundle tab reads "BUNDLE" whatever it is called. */
const TAB_NAME: Record<ShelfId, string> = {
  daily: "DAILY",
  featured: "BUNDLE",
  night: "NIGHT MKT",
  accessories: "MISC",
};

function Stats(props: { entry: Stock; left: FrontProps["left"] }) {
  const item = () => props.entry.item;
  return (
    <dl class={styles.stats}>
      <dt>VAL</dt>
      <dd class="num">
        {cost(item()).toLocaleString()} {item().currency.toUpperCase()}
      </dd>
      <Show when={isOnSale(item())}>
        <dt>WAS</dt>
        <dd class="num">{item().price.toLocaleString()}</dd>
      </Show>
      <dt>TYPE</dt>
      <dd>{gradeOf(item()).name.toUpperCase()}</dd>
      <dt>LEAVES</dt>
      <dd class="num">{clock(props.left(props.entry.shelf.endsInS))}</dd>
    </dl>
  );
}

function Tabs(props: { shelves: Shelf[]; current: ShelfId | undefined; onPick: (id: ShelfId) => void }) {
  return (
    <nav class={styles.tabs} role="tablist">
      <For each={props.shelves}>
        {(entry) => (
          <button
            role="tab"
            class={styles.tab}
            aria-selected={entry.id === props.current}
            onClick={() => {
              playCue("tab");
              props.onPick(entry.id);
            }}
          >
            {TAB_NAME[entry.id]}
          </button>
        )}
      </For>
    </nav>
  );
}

export function PipboyFront(props: FrontProps) {
  const shelves = createMemo(() => shelvesOf(props.view));
  const [shelfId, setShelfId] = createSignal<ShelfId>("daily");
  const shelf = () => shelves().find((entry) => entry.id === shelfId()) ?? shelves()[0];
  const stock = createMemo(() => {
    const current = shelf();
    return current ? stockOf([current]) : [];
  });
  const { picked, pick } = usePickedStock(stock, () => playCue("hover"));
  return (
    <section class={styles.barter} data-own-frame>
      <Tabs shelves={shelves()} current={shelf()?.id} onPick={setShelfId} />
      <div class={styles.body}>
        <ol class={styles.list}>
          <For each={stock()}>
            {(entry) => (
              <li
                class={styles.row}
                data-on={picked()?.item.id === entry.item.id ? "" : undefined}
                tabIndex={0}
                onMouseEnter={() => pick(entry)}
                onFocus={() => pick(entry)}
              >
                <span class={styles.rowName}>{entry.item.name.toUpperCase()}</span>
                <span class="num">{cost(entry.item).toLocaleString()}</span>
              </li>
            )}
          </For>
        </ol>
        <Show when={picked()}>
          {(entry) => (
            <aside class={styles.detail}>
              <ItemArt item={entry().item} class={styles.art} />
              <Stats entry={entry()} left={props.left} />
            </aside>
          )}
        </Show>
      </div>
      <footer class={styles.bar}>
        <span class="num">RESTOCK {clock(props.left(props.view.daily_ends_in_s))}</span>
        <span>VIEW ONLY · BUY IN VALORANT</span>
      </footer>
    </section>
  );
}
