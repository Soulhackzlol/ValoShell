// VALORANT (current client) Store, laid out in the client's pixels on a ValCanvas: the
// featured bundle in a framed banner (countdown, name, price, carousel), the daily offers
// tinted by edition with their own countdown, and the category buttons underneath.
import { For, Index, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { StoreItem } from "~/bindings/StoreItem";
import type { PieceProps } from "~/studio/registry";
import { NavVp } from "~/menu/navGlyphs";
import { playCue } from "~/menu/sound";
import { Heart } from "lucide-solid";
import { catalog } from "~/state/catalog";
import { pushToast } from "~/state/toasts";
import { storeView } from "~/state/views";
import { isWished, toggleWish } from "~/state/wishlist";
import { Art } from "~/ui/Art";
import { colorVars } from "./current";
import { ValCanvas } from "./valCanvas";
import { valLang, vt } from "./valText";
import styles from "./currentStore.module.css";

const ROTATE_MS = 9000;

/** The client's edition tints (sampled): the colour a daily card fades into, and its price bar. */
const EDITION_TINTS: Record<string, [string, string]> = {
  Select: ["rgb(26 62 100)", "rgb(12 28 48)"],
  Deluxe: ["rgb(7 68 68)", "rgb(4 31 30)"],
  Premium: ["rgb(88 43 69)", "rgb(40 18 29)"],
  Exclusive: ["rgb(101 68 47)", "rgb(46 30 21)"],
  Ultra: ["rgb(112 94 40)", "rgb(48 40 16)"],
};

/** Each edition's emblem, drawn faintly behind the weapon like the client's cards. */
const EDITION_ICONS: Record<string, string> = {
  Select: "12683d76-48d7-84a3-4e09-6985794f0445",
  Deluxe: "0cebb8be-46d7-c12a-d306-e9907bfc5a25",
  Premium: "60bca009-4182-7998-dee7-b8a2558dc369",
  Exclusive: "e046854e-406c-37f4-6607-19a9ba8426fc",
  Ultra: "411e4a55-4e59-7757-41f0-86a53f101bb5",
};

function editionIcon(edition: string | null): string | null {
  const id = edition ? EDITION_ICONS[edition] : undefined;
  return id ? `https://media.valorant-api.com/contenttiers/${id}/displayicon.png` : null;
}

const PAGE_BACKGROUND = "radial-gradient(ellipse at 50% 30%, #222838, #1d2331 60%, #1a2738)";

/** 20:14:07:14 (days shown only when there are some), like the client's timers. */
function countdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(total / 86400), Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60];
  const shown = parts[0] ? parts : parts.slice(1);
  return shown.map((part) => String(part).padStart(2, "0")).join(":");
}

function useNow() {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => window.clearInterval(timer));
  return now;
}

export function ValStore(props: PieceProps) {
  const navigate = useNavigate();
  const now = useNow();
  const [index, setIndex] = createSignal(0);
  const [started, setStarted] = createSignal(Date.now());
  onMount(() => {
    if (!storeView.value() && !storeView.isLoading()) void storeView.load();
    const timer = window.setInterval(() => {
      const count = storeView.value()?.bundles.length ?? 0;
      if (count > 1 && Date.now() - started() >= ROTATE_MS) show((index() + 1) % count, false);
    }, 500);
    onCleanup(() => window.clearInterval(timer));
  });
  const show = (next: number, isClick: boolean) => {
    if (isClick) playCue("tab");
    setIndex(next);
    setStarted(Date.now());
  };
  const view = () => storeView.value();
  const elapsed = () => (now() - (view()?.observed_at_ms ?? now())) / 1000;
  const bundle = () => view()?.bundles[index()] ?? view()?.bundles[0];
  const progress = () => Math.min(1, (now() - started()) / ROTATE_MS);
  const categories = createMemo(() => {
    const agents = catalog().agents;
    const daily = view()?.daily ?? [];
    const bundles = view()?.bundles ?? [];
    return [
      { label: valLang() === "es" ? "Pase de batalla" : "Battlepass", go: "/career?view=pass", art: [bundles[0]?.items[0]?.image, daily[1]?.image] },
      { label: vt("agents"), go: "/agents", art: [agents[0]?.portrait, agents[1]?.portrait] },
      { label: "Esports", go: "", art: [bundles[1]?.image, bundles[1]?.items[0]?.image] },
      { label: valLang() === "es" ? "Accesorios" : "Accessories", go: "/collection", art: [daily[2]?.image, daily[3]?.image] },
    ];
  });
  return (
    <ValCanvas style={{ ...colorVars(props, ["gold", "teal"]), background: PAGE_BACKGROUND }}>
      <div class={styles.page}>
        <span class={styles.crumb}>
          <i />
          {vt("store")}
        </span>
        <section class={styles.banner}>
          <Art src={bundle()?.image} class={styles.bannerArt} fallback={<span class={styles.bannerEmpty} />} />
          <span class={styles.bannerShade} />
          <span class={styles.featured}>
            {vt("featured")}
            <i>|</i>
            <b>{countdown((bundle()?.ends_in_s ?? 0) - elapsed())}</b>
          </span>
          <h2 class={styles.bundleName}>{bundle()?.name ?? "—"}</h2>
          <span class={styles.bundleKind}>
            {vt("collectionSub")}
            <span class={styles.bundlePrice}>
              <NavVp />
              {bundle()?.discounted_price ?? bundle()?.price ?? 0}
            </span>
          </span>
          <Show when={(view()?.bundles.length ?? 0) > 1}>
            <div class={styles.carousel}>
              <Index each={view()?.bundles ?? []}>
                {(entry, at) => (
                  <button class={styles.slide} data-active={at === index() ? "" : undefined} onMouseEnter={() => playCue("hover")} onClick={() => show(at, true)}>
                    <span>{entry().name}</span>
                    <i style={{ "--fill": at === index() ? progress() : 0 }} />
                  </button>
                )}
              </Index>
            </div>
          </Show>
          {/* The client's price box, as a label: ValoShell never buys, so it isn't a button. */}
          <span class={styles.priceButton} title={valLang() === "es" ? "Se compra en el juego" : "Bought in the game"}>
            <span>
              <NavVp />
              {bundle()?.discounted_price ?? bundle()?.price ?? 0}
            </span>
          </span>
        </section>
        <header class={styles.dailyHead}>
          <i class={styles.tick} />
          <i class={styles.rule} />
          <b>{valLang() === "es" ? "Ofertas diarias" : "Daily offers"}</b>
          <i class={styles.bar} />
          <span class={styles.dailyClock}>{countdown((view()?.daily_ends_in_s ?? 0) - elapsed())}</span>
          <i class={styles.rule} />
          <i class={styles.tick} />
        </header>
        <div class={styles.daily}>
          <For each={view()?.daily ?? []}>{(item) => <DailyTile item={item} />}</For>
        </div>
        <nav class={styles.categories}>
          <For each={categories()}>
            {(entry) => (
              <button
                class={styles.category}
                onMouseEnter={() => playCue("hover")}
                onClick={() => {
                  playCue("tab");
                  if (entry.go) navigate(entry.go);
                }}
              >
                <Art src={entry.art[0]} class={`${styles.categoryArt} ${styles.artLeft}`} fallback={null} />
                <Art src={entry.art[1]} class={`${styles.categoryArt} ${styles.artRight}`} fallback={null} />
                <span class={styles.categoryLabel}>{entry.label}</span>
              </button>
            )}
          </For>
        </nav>
      </div>
    </ValCanvas>
  );
}

/** "On your wishlist": the store rotates daily, so a wished skin is announced when it's back. */
function wish(item: StoreItem): void {
  if (!item.skin_id) return;
  const isAdding = !isWished(item.skin_id);
  toggleWish(item.skin_id);
  playCue(isAdding ? "confirm" : "back");
  if (!isAdding) return;
  const isSpanish = valLang() === "es";
  pushToast(
    "positive",
    isSpanish ? "En tu lista de deseos" : "On your wishlist",
    isSpanish ? `Te avisaremos cuando ${item.name} vuelva a tu tienda.` : `You'll hear when ${item.name} is in your store again.`,
  );
}

/** A daily offer: a click puts the skin on the wishlist (or takes it off); buying is in VALORANT. */
function DailyTile(props: { item: StoreItem }) {
  const tint = () => EDITION_TINTS[props.item.edition ?? ""] ?? ["rgb(40 52 66)", "rgb(26 34 44)"];
  const isOn = () => (props.item.skin_id ? isWished(props.item.skin_id) : false);
  const label = () => {
    const isSpanish = valLang() === "es";
    if (isOn()) return isSpanish ? "En tu lista de deseos (quitar)" : "On your wishlist (click to remove)";
    return isSpanish ? "Añadir a la lista de deseos" : "Add to wishlist";
  };
  return (
    <button
      class={styles.tile}
      style={{ "--tint": tint()[0], "--tint-bar": tint()[1] }}
      disabled={!props.item.skin_id}
      aria-pressed={isOn()}
      title={label()}
      onMouseEnter={() => playCue("hover")}
      onClick={() => wish(props.item)}
    >
      <Show when={isOn()}>
        <Heart class={styles.tileWish ?? ""} size={16} fill="currentColor" aria-hidden="true" />
      </Show>
      <Art src={editionIcon(props.item.edition)} class={styles.tileMark} fallback={<span />} />
      <Art src={props.item.image} class={styles.tileArt} fallback={<span />} />
      <span class={styles.tileBar}>
        <span class={styles.tileName}>{props.item.name}</span>
        <span class={styles.tilePrice}>
          <NavVp />
          {props.item.discounted_price ?? props.item.price}
        </span>
      </span>
    </button>
  );
}
