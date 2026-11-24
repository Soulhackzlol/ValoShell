// Wishlist: a chip on the Store scene (every style) that names wished skins on sale today, and
// a dialog to search any store skin and wish for it. In-app only: nothing is sent to Riot.
import { For, Show, createResource, createSignal, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Heart, Search, X } from "lucide-solid";
import type { SkinCard } from "~/bindings/SkinCard";
import { call } from "~/ipc/commands";
import { playCue } from "~/menu/sound";
import { isWished, toggleWish, wishedIds, wishedOnSale } from "~/state/wishlist";
import controls from "~/ui/controls.module.css";
import { Empty } from "~/ui/controls";
import { focusWhenShown, useModalKeys } from "~/ui/modal";
import dialog from "./identity.module.css";
import styles from "./wishlist.module.css";

/** Typing pauses this long before the search runs. */
const SEARCH_DELAY_MS = 180;

const [isOpen, setOpen] = createSignal(false);
const [query, setQuery] = createSignal("");
/** The text the last search ran with; empty shows the wishlist itself. */
const [searched, setSearched] = createSignal("");

/** Every open starts on the wishlist, not on the last search. */
function open(): void {
  playCue("confirm");
  setQuery("");
  setSearched("");
  setOpen(true);
}

function close(): void {
  playCue("back");
  setOpen(false);
}

/** The Store scene's wishlist chip; lights up when a wished skin is on sale. */
export function WishlistDock() {
  const names = () => wishedOnSale().map((item) => item.name);
  return (
    <button class={styles.dock} data-on-sale={names().length > 0 ? "" : undefined} onClick={open}>
      <Heart size={15} />
      <Show when={names().length > 0} fallback={<span>Wishlist · {wishedIds().length}</span>}>
        <span>
          <b>In your store:</b> {names().join(", ")}
        </span>
      </Show>
    </button>
  );
}

function CardRow(props: { card: SkinCard; isOnSale: boolean }) {
  return (
    <li class={styles.row}>
      <Show when={props.card.image} fallback={<span />}>
        {(image) => <img src={image()} alt="" loading="lazy" decoding="async" draggable={false} />}
      </Show>
      <span class={styles.name}>
        {props.card.name}
        <Show when={props.isOnSale}>
          <em>In your store</em>
        </Show>
      </span>
      <button
        class={styles.heart}
        data-on={isWished(props.card.skin_id) ? "" : undefined}
        aria-pressed={isWished(props.card.skin_id)}
        aria-label={isWished(props.card.skin_id) ? `Remove ${props.card.name} from your wishlist` : `Wish for ${props.card.name}`}
        onClick={() => {
          playCue("confirm");
          toggleWish(props.card.skin_id);
        }}
      >
        <Heart size={16} />
      </button>
    </li>
  );
}

/** Mounted once in MenuShell; the dock opens it. */
export function WishlistDialog() {
  let timer: number | undefined;
  const onInput = (value: string) => {
    setQuery(value);
    window.clearTimeout(timer);
    timer = window.setTimeout(() => setSearched(value.trim()), SEARCH_DELAY_MS);
  };
  onCleanup(() => window.clearTimeout(timer));
  useModalKeys(isOpen, close);
  // Both lists are read only while the dialog is open (it stays mounted all session).
  const [results] = createResource(
    () => isOpen() && searched(),
    (text) => call("search_store_skins", { query: text }),
  );
  const [wished] = createResource(
    () => isOpen() && wishedIds(),
    (skinIds) => call("get_skin_cards", { skinIds }),
  );
  const isOnSale = (card: SkinCard) => wishedOnSale().some((item) => item.skin_id === card.skin_id);
  return (
    <Show when={isOpen()}>
      <Portal>
        <div class={dialog.scrim} onClick={close} />
        <div
          class={dialog.picker}
          role="dialog"
          aria-modal="true"
          aria-label="Wishlist"
        >
          <header class={dialog.head}>
            <h2>Wishlist</h2>
            <label class={dialog.search}>
              <Search size={14} />
              <input class={controls.input} placeholder="Find a skin (name or weapon)" value={query()} ref={focusWhenShown} onInput={(event) => onInput(event.currentTarget.value)} />
            </label>
            <button class={dialog.close} aria-label="Close" onClick={close}>
              <X size={16} />
            </button>
          </header>
          <div class={styles.body}>
            <Show
              when={searched()}
              fallback={
                <ul class={styles.list}>
                  <For each={wished() ?? []} fallback={<Empty title="Nothing wished yet">Search for a skin and press the heart; the Store tells you when it is on sale.</Empty>}>
                    {(card) => <CardRow card={card} isOnSale={isOnSale(card)} />}
                  </For>
                </ul>
              }
            >
              <ul class={styles.list}>
                <For each={results() ?? []} fallback={<p class={styles.none}>{results.loading ? "Searching…" : "No store skin matches."}</p>}>
                  {(card) => <CardRow card={card} isOnSale={isOnSale(card)} />}
                </For>
              </ul>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
