// The whole store as one piece, drawn the way each style's own game draws its shop: the
// 2022 VALORANT store, the 2020 beta's hairlines, CS:GO's Panorama tiles, CS2's flat grid, a
// CS 1.6 VGUI dialog, console output, Halo 3's menu list beside an info pane, and in files of
// their own Glass's frosted cards, League's client store, a Persona 5 shop counter, Fallout's
// barter screen and a Cyberpunk vendor. Fortnite and Minecraft draw their shops with pieces of
// their own (fn-shop, mc-trades).
// View only: prices are labels, never buttons; buying happens in VALORANT.
import { For, Index, Match, Show, Switch, createMemo, createSignal, type JSX } from "solid-js";
import { RefreshCw } from "lucide-solid";
import type { StoreItem } from "~/bindings/StoreItem";
import type { PieceProps } from "~/studio/registry";
import type { Skin } from "~/studio/types";
import { doc } from "~/studio/store";
import { playCue } from "~/menu/sound";
import { storeView } from "~/state/views";
import { Status, formatDuration, remaining, useNow, useStore } from "./store";
import { BundleArt, EDITION_TINT, ItemArt, gradeOf, partsOf, type EditionTone } from "./storeArt";
import { GlassFront } from "./glassStore";
import { LeagueFront } from "./leagueStore";
import { NightCityFront } from "./nightcityStore";
import { PhantomFront } from "./phantomStore";
import { PipboyFront } from "./pipboyStore";
import { type FrontProps, type ShelfId, bundleOff, clock, cost, isOnSale, shelvesOf } from "./storeShelves";
import s from "./storeFront.module.css";

type FrontLayout =
  | "valnow"
  | "glass"
  | "beta"
  | "csgo"
  | "cs2"
  | "cs16"
  | "terminal"
  | "halo"
  | "league"
  | "phantom"
  | "pipboy"
  | "nightcity";

/** The store's look when set to Auto: what the style's own game would show. */
const AUTO_FRONT: Record<Skin, FrontLayout> = {
  modern: "valnow",
  current: "valnow",
  glass: "glass",
  valnow: "valnow",
  beta: "beta",
  csgo: "csgo",
  cs2: "cs2",
  cs16: "cs16",
  terminal: "terminal",
  halo: "halo",
  fortnite: "valnow",
  minecraft: "valnow",
  pipboy: "pipboy",
  league: "league",
  phantom: "phantom",
  nightcity: "nightcity",
};

/** A decorative price label: old price struck through, the price, the currency. */
function Tag(props: { item: { price: number; discounted_price: number | null }; currency: string; class?: string | undefined }) {
  return (
    <span class={`${s.tag} ${props.class ?? ""}`}>
      <Show when={isOnSale(props.item)}>
        <s class="num">{props.item.price.toLocaleString()}</s>
      </Show>
      <b class="num">{cost(props.item).toLocaleString()}</b>
      <small>{props.currency.toUpperCase()}</small>
    </span>
  );
}

const hover = () => playCue("hover");

export function StoreFront(props: PieceProps) {
  useStore();
  const now = useNow();
  const layout = (): FrontLayout => {
    const chosen = props.piece.props["layout"];
    return typeof chosen === "string" && chosen !== "auto" ? (chosen as FrontLayout) : AUTO_FRONT[doc.theme.skin];
  };
  return (
    <Show when={storeView.value()} fallback={<Status what="Store" />}>
      {(view) => {
        const front = {
          get view() {
            return view();
          },
          left: (endsInS: number) => remaining(endsInS, view().observed_at_ms, now()),
        } satisfies FrontProps;
        return (
          <Switch>
            <Match when={layout() === "csgo"}>
              <CsgoFront {...front} />
            </Match>
            <Match when={layout() === "cs2"}>
              <Cs2Front {...front} />
            </Match>
            <Match when={layout() === "cs16"}>
              <VguiFront {...front} />
            </Match>
            <Match when={layout() === "terminal"}>
              <ConsoleFront {...front} />
            </Match>
            <Match when={layout() === "halo"}>
              <HaloFront {...front} />
            </Match>
            <Match when={layout() === "beta"}>
              <BetaFront {...front} />
            </Match>
            <Match when={layout() === "glass"}>
              <GlassFront {...front} />
            </Match>
            <Match when={layout() === "league"}>
              <LeagueFront {...front} />
            </Match>
            <Match when={layout() === "phantom"}>
              <PhantomFront {...front} />
            </Match>
            <Match when={layout() === "pipboy"}>
              <PipboyFront {...front} />
            </Match>
            <Match when={layout() === "nightcity"}>
              <NightCityFront {...front} />
            </Match>
            <Match when={true}>
              <ValnowFront {...front} />
            </Match>
          </Switch>
        );
      }}
    </Show>
  );
}

// ---- CS:GO Panorama ---------------------------------------------------------------------

/** CS:GO's grades, matched to VALORANT editions by rank. */
const CS_GRADE: Record<EditionTone, { name: string; color: string }> = {
  accessory: { name: "Industrial Grade", color: "#5e98d9" },
  select: { name: "Mil-Spec", color: "#4b69ff" },
  deluxe: { name: "Restricted", color: "#8847ff" },
  premium: { name: "Classified", color: "#d32ce6" },
  exclusive: { name: "Covert", color: "#eb4b4b" },
  ultra: { name: "Extraordinary", color: "#e4ae39" },
};

function csGrade(item: StoreItem) {
  return CS_GRADE[gradeOf(item).tone];
}

/** "Vandal | Reaver"; melees get CS's star ("★ Axe | Neo Frontier"). */
function CsName(props: { item: StoreItem; class?: string | undefined }) {
  const parts = () => partsOf(props.item);
  return (
    <span class={props.class}>
      {parts().kind === "melee" ? "★ " : ""}
      {parts().base}
      <Show when={parts().finish}>
        {(finish) => (
          <>
            {" "}
            <i>|</i> <b>{finish()}</b>
          </>
        )}
      </Show>
    </span>
  );
}

const CS_SHELF_NAMES: Record<ShelfId, string> = {
  daily: "Daily offers",
  featured: "Collection",
  night: "Night market",
  accessories: "Accessories",
};

function CsgoFront(props: FrontProps) {
  const shelves = createMemo(() => shelvesOf(props.view));
  const [tab, setTab] = createSignal<ShelfId>("daily");
  const shelf = () => shelves().find((option) => option.id === tab()) ?? shelves()[0];
  return (
    <div class={s.go}>
      <header class={s.goHead}>
        <span class={s.goTitle}>Store</span>
        <nav class={s.goTabs}>
          <For each={shelves()}>
            {(option) => (
              <button
                data-active={tab() === option.id ? "" : undefined}
                onMouseEnter={hover}
                onClick={() => {
                  playCue("tab");
                  setTab(option.id);
                }}
              >
                {CS_SHELF_NAMES[option.id]}
              </button>
            )}
          </For>
        </nav>
        <Show when={shelf()}>
          {(current) => <span class={`${s.goTimer} num`}>Refreshes in {clock(props.left(current().endsInS))}</span>}
        </Show>
      </header>
      <div class={s.goBody}>
        <Show when={props.view.bundles[0]}>
          {(bundle) => (
            <article class={s.goHero} onMouseEnter={hover}>
              <div class={s.goHeroArt}>
                <BundleArt bundle={bundle()} />
              </div>
              <span class={s.goRibbon}>New</span>
              <Show when={bundleOff(bundle())}>{(off) => <span class={s.goSale}>-{off()}%</span>}</Show>
              <div class={s.goHeroFoot}>
                <span class={s.goKicker}>
                  Featured · {bundle().items.length} items · {formatDuration(props.left(bundle().ends_in_s))} left
                </span>
                <span class={s.goHeroName}>The {bundle().name} Collection</span>
                <Tag item={bundle()} currency="VP" class={s.goPrice} />
              </div>
              <span class={s.sheen} />
            </article>
          )}
        </Show>
        <Show when={shelf()} keyed>
          {(current) => (
            <div class={s.goGrid} data-count={current.items.length}>
              <For each={current.items}>
                {(item, index) => (
                  <article class={s.goTile} style={{ "--grade": csGrade(item).color, "--stagger": index() }} onMouseEnter={hover}>
                    <Show when={item.discount_percent}>{(off) => <span class={s.goSale}>-{off()}%</span>}</Show>
                    <div class={s.goArt}>
                      <ItemArt item={item} />
                    </div>
                    <CsName item={item} class={s.goName} />
                    <span class={s.goFoot}>
                      <span class={s.goGrade}>{csGrade(item).name}</span>
                      <Tag item={item} currency={item.currency} class={s.goPrice} />
                    </span>
                  </article>
                )}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---- CS2 ---------------------------------------------------------------------------------

function Cs2Front(props: FrontProps) {
  const night = () => props.view.night_market ?? [];
  return (
    <div class={s.c2}>
      <header class={s.c2Head}>
        <span class={s.c2Title}>Store</span>
        <span class={`${s.c2Timer} num`}>Daily offers refresh in {formatDuration(props.left(props.view.daily_ends_in_s))}</span>
        <button class={s.c2Refresh} title="Refresh" disabled={storeView.isLoading()} onClick={() => void storeView.load(true)}>
          <RefreshCw size={14} />
        </button>
      </header>
      <div class={s.c2Grid}>
        <Show when={props.view.bundles[0]}>
          {(bundle) => (
            <article class={s.c2Hero} onMouseEnter={hover}>
              <div class={s.c2HeroArt}>
                <BundleArt bundle={bundle()} />
              </div>
              <div class={s.c2HeroInfo}>
                <span class={s.c2Kicker}>Featured · {formatDuration(props.left(bundle().ends_in_s))}</span>
                <span class={s.c2HeroName}>{bundle().name}</span>
                <span class={s.c2HeroFoot}>
                  <span class={s.c2HeroItems}>{bundle().items.map((item) => partsOf(item).base).join(" · ")}</span>
                  <Tag item={bundle()} currency="VP" class={s.c2Price} />
                </span>
              </div>
              <span class={s.sheen} />
            </article>
          )}
        </Show>
        <For each={props.view.daily}>{(item, index) => <Cs2Card item={item} index={index()} />}</For>
        <Show when={night().length > 0}>
          <span class={s.c2Label}>
            Night market <i class="num">{formatDuration(props.left(props.view.night_market_ends_in_s))}</i>
          </span>
          <For each={night()}>{(item, index) => <Cs2Card item={item} index={index() + 4} isSmall />}</For>
        </Show>
        <Show when={props.view.accessories.length > 0}>
          <span class={s.c2Label}>
            Accessories <i class="num">{formatDuration(props.left(props.view.accessories_end_in_s))}</i>
          </span>
          <For each={props.view.accessories}>{(item, index) => <Cs2Card item={item} index={index() + 7} isSmall />}</For>
        </Show>
      </div>
    </div>
  );
}

function Cs2Card(props: { item: StoreItem; index: number; isSmall?: boolean }) {
  const parts = () => partsOf(props.item);
  return (
    <article
      class={s.c2Card}
      data-small={props.isSmall ? "" : undefined}
      style={{ "--grade": csGrade(props.item).color, "--stagger": props.index }}
      onMouseEnter={hover}
    >
      <Show when={props.item.discount_percent}>{(off) => <span class={s.c2Sale}>-{off()}%</span>}</Show>
      <div class={s.c2Art}>
        <ItemArt item={props.item} />
      </div>
      <span class={s.c2Name}>
        <small>{parts().base}</small>
        {parts().finish || parts().base}
      </span>
      <Tag item={props.item} currency={props.item.currency} class={s.c2CardPrice} />
    </article>
  );
}

// ---- CS 1.6 VGUI dialog ------------------------------------------------------------------

function VguiFront(props: FrontProps) {
  const shelves = createMemo(() => shelvesOf(props.view));
  const rows = createMemo(() => shelves().flatMap((shelf) => shelf.items.map((item) => ({ item, shelf }))));
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const selected = () => rows().find((row) => row.item.id === selectedId()) ?? rows()[0];
  const move = (step: number) => {
    const list = rows();
    const at = list.findIndex((row) => row === selected());
    const next = list[Math.min(list.length - 1, Math.max(0, at + step))];
    if (next) {
      playCue("hover");
      setSelectedId(next.item.id);
    }
  };
  return (
    <div class={s.vg}>
      <div class={s.vgTitle}>
        <span>Store</span>
        <span class={`${s.vgTitleTimer} num`}>Offers refresh in {formatDuration(props.left(props.view.daily_ends_in_s))}</span>
      </div>
      <div class={s.vgBody}>
        <div
          class={s.vgList}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              move(event.key === "ArrowDown" ? 1 : -1);
            }
          }}
        >
          <div class={s.vgColumns}>
            <span>Item</span>
            <span>Type</span>
            <span>Price</span>
          </div>
          <div class={s.vgRows}>
            <For each={shelves()}>
              {(shelf) => (
                <>
                  <div class={s.vgGroup}>
                    {shelf.id === "featured" ? `Bundle: ${shelf.label}` : shelf.label}
                    <span class="num">{formatDuration(props.left(shelf.endsInS))}</span>
                  </div>
                  <For each={shelf.items}>
                    {(item) => (
                      <div
                        class={s.vgRow}
                        data-selected={selected()?.item === item ? "" : undefined}
                        onMouseDown={() => {
                          playCue("tab");
                          setSelectedId(item.id);
                        }}
                      >
                        <span>{item.name}</span>
                        <span>{partsOf(item).base}</span>
                        <span class="num">
                          {cost(item).toLocaleString()} {item.currency.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </For>
                </>
              )}
            </For>
          </div>
        </div>
        <Show when={selected()}>
          {(row) => (
            <div class={s.vgSide}>
              <div class={s.vgPreview}>
                <ItemArt item={row().item} />
              </div>
              <div class={s.vgInfo}>
                <b>{row().item.name}</b>
                <span>Edition: {gradeOf(row().item).name}</span>
                <span class="num">
                  Price: {cost(row().item).toLocaleString()} {row().item.currency.toUpperCase()}
                  {isOnSale(row().item) ? ` (was ${row().item.price.toLocaleString()})` : ""}
                </span>
                <span class="num">Leaves in: {formatDuration(props.left(row().shelf.endsInS))}</span>
                <span class={s.vgNote}>Buy it in VALORANT.</span>
              </div>
            </div>
          )}
        </Show>
      </div>
      <div class={s.vgFoot}>
        <span class={s.vgStatus}>
          {rows().length} items · {shelves().some((shelf) => shelf.id === "night") ? "Night market open" : "Night market closed"}
        </span>
        <button class={s.vgButton} disabled={storeView.isLoading()} onClick={() => void storeView.load(true)}>
          Refresh
        </button>
      </div>
    </div>
  );
}

// ---- Terminal ----------------------------------------------------------------------------

/** One console line; `row` marks table rows the pointer can highlight. */
interface Line {
  text: string;
  tone?: "logo" | "prompt" | "dim" | "head" | "row" | "hot";
}

const PROMPT = "valoshell@valorant:~/store$ ";

/** `figlet store`, printed as the console's banner. */
const BANNER = String.raw` ____    _____    ___    ____    _____
/ ___|  |_   _|  / _ \  |  _ \  | ____|
\___ \    | |   | | | | | |_) | |  _|
 ___) |   | |   | |_| | |  _ <  | |___
|____/    |_|    \___/  |_| \_\ |_____|`.split("\n");

function fit(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, width - 1)}…` : text.padEnd(width);
}

/** An ASCII table: `+----+` rules, `|` columns, prices right-aligned. */
function asciiTable(items: StoreItem[], nameWidth: number): Line[] {
  const widths = [2, nameWidth, 9, 12];
  const rule = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const row = (cells: string[]) =>
    `|${cells.map((cell, index) => ` ${index === 3 ? cell.padStart(widths[index] ?? 0) : fit(cell, widths[index] ?? 0)} `).join("|")}|`;
  return [
    { text: rule, tone: "dim" },
    { text: row(["#", "ITEM", "EDITION", "PRICE"]), tone: "head" },
    { text: rule, tone: "dim" },
    ...items.map(
      (item, index): Line => ({
        text: row([
          (index + 1).toString().padStart(2, "0"),
          item.name,
          gradeOf(item).name.toLowerCase(),
          `${cost(item).toLocaleString()} ${item.currency.toUpperCase()}`,
        ]),
        tone: "row",
      }),
    ),
    { text: rule, tone: "dim" },
  ];
}

function ConsoleFront(props: FrontProps) {
  const left = createMemo((): Line[] => {
    const view = props.view;
    const lines: Line[] = [
      ...BANNER.map((text): Line => ({ text, tone: "logo" })),
      { text: "" },
      { text: `${PROMPT}store --today`, tone: "prompt" },
      { text: "fetching storefront ........ ok", tone: "dim" },
      { text: `daily offers · reset in ${clock(props.left(view.daily_ends_in_s))}` },
      ...asciiTable(view.daily, 22),
      { text: `${view.daily.length} offers · ${view.daily.reduce((sum, item) => sum + cost(item), 0).toLocaleString()} VP total`, tone: "dim" },
      { text: "" },
    ];
    const bundle = view.bundles[0];
    if (bundle) {
      const off = bundleOff(bundle);
      lines.push(
        { text: `${PROMPT}store --bundle`, tone: "prompt" },
        { text: `${bundle.name.toUpperCase()}${off ? `  [-${off}%]` : ""}`, tone: "hot" },
        { text: `${off ? `${bundle.price.toLocaleString()} VP -> ` : ""}${cost(bundle).toLocaleString()} VP · ends in ${clock(props.left(bundle.ends_in_s))}` },
        ...bundle.items.map((item, index): Line => {
          const branch = index === bundle.items.length - 1 ? "`--" : "|--";
          const price = `${cost(item).toLocaleString()} VP`;
          return { text: `  ${branch} ${item.name} ${".".repeat(Math.max(2, 30 - item.name.length))} ${price}`, tone: "row" };
        }),
      );
    }
    return lines;
  });
  const right = createMemo((): Line[] => {
    const view = props.view;
    const lines: Line[] = [{ text: `${PROMPT}store --night-market`, tone: "prompt" }];
    if (view.night_market?.length) {
      lines.push({ text: `night market · closes in ${clock(props.left(view.night_market_ends_in_s))}` }, ...asciiTable(view.night_market, 20));
    } else {
      lines.push({ text: "store: night market is closed", tone: "dim" });
    }
    lines.push(
      { text: "" },
      { text: `${PROMPT}store --accessories`, tone: "prompt" },
      { text: `accessories · rotate in ${clock(props.left(view.accessories_end_in_s))}` },
      ...asciiTable(view.accessories, 20),
      { text: "" },
      { text: `${PROMPT}buy 1`, tone: "prompt" },
      { text: "store: read-only. buy it in VALORANT.", tone: "dim" },
    );
    return lines;
  });
  const now = useNow();
  const time = () => new Date(now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return (
    <div class={s.tty}>
      <div class={s.ttyPanes}>
        <ConsolePane lines={left()} offset={0} hasCursor />
        <ConsolePane lines={right()} offset={6} />
      </div>
      <div class={`${s.ttyBar} num`}>
        <span class={s.ttySession}>[store]</span>
        <span>0:today*</span>
        <span>1:market-</span>
        <span class={s.ttyClock}>
          reset {clock(props.left(props.view.daily_ends_in_s))} │ {time()}
        </span>
      </div>
    </div>
  );
}

function ConsolePane(props: { lines: Line[]; offset: number; hasCursor?: boolean }) {
  return (
    <pre class={s.ttyPane}>
      {/* Index, not For: the clocks rebuild the lines every second, and new nodes would retype. */}
      <Index each={props.lines}>
        {(line, index) => (
          <span class={s.ttyLine} data-tone={line().tone} style={{ "--line": index + props.offset }}>
            {line().text || " "}
          </span>
        )}
      </Index>
      <Show when={props.hasCursor}>
        <span class={s.ttyLine} data-tone="prompt" style={{ "--line": props.lines.length + props.offset }}>
          {PROMPT}
          <i class={s.ttyCursor} />
        </span>
      </Show>
    </pre>
  );
}

// ---- Halo 3 ------------------------------------------------------------------------------

const HALO_SHELF_NAMES: Record<ShelfId, string> = {
  daily: "Daily offers",
  featured: "Featured bundle",
  night: "Night market",
  accessories: "Accessories",
};

/** One line of flavour per section, the way Halo's info pane describes the focused option. */
const HALO_BLURB: Record<ShelfId, string> = {
  daily: "Part of today's rotation. Four offers, picked for you, until the next refresh.",
  featured: "Part of the featured bundle. Sold alone or as the whole set.",
  night: "A Night Market pick, discounted for you alone until the market closes.",
  accessories: "An accessory for Kingdom Credits, earned by playing.",
};

function HaloFront(props: FrontProps) {
  const shelves = createMemo(() => shelvesOf(props.view));
  const [focusedId, setFocusedId] = createSignal<string | null>(null);
  const focused = () => {
    for (const shelf of shelves()) {
      const item = shelf.items.find((option) => option.id === focusedId());
      if (item) return { item, shelf };
    }
    const first = shelves()[0];
    return first?.items[0] ? { item: first.items[0], shelf: first } : null;
  };
  let index = 0;
  return (
    <div class={s.halo}>
      <header class={s.haloHead}>
        <span class={s.haloTitle}>Store</span>
        <span class={`${s.haloSub} num`}>Offers refresh in {clock(props.left(props.view.daily_ends_in_s))}</span>
      </header>
      <div class={s.haloCols}>
        <div class={s.haloMenu}>
          <For each={shelves()}>
            {(shelf) => (
              <section class={s.haloGroup}>
                <span class={s.haloGroupName}>{HALO_SHELF_NAMES[shelf.id]}</span>
                <For each={shelf.items}>
                  {(item) => (
                    <button
                      class={s.haloOption}
                      data-active={focused()?.item === item ? "" : undefined}
                      style={{ "--stagger": index++ }}
                      onMouseEnter={() => {
                        if (focused()?.item !== item) playCue("hover");
                        setFocusedId(item.id);
                      }}
                      onFocus={() => setFocusedId(item.id)}
                    >
                      <span>{item.name}</span>
                      <span class="num">{cost(item).toLocaleString()}</span>
                    </button>
                  )}
                </For>
              </section>
            )}
          </For>
        </div>
        <Show when={focused()}>
          {(current) => (
            <aside class={s.haloPane}>
              <span class={s.haloPaneTitle}>{current().item.name}</span>
              <Show when={current().item} keyed>
                {(item) => (
                  <div class={s.haloPreview}>
                    <ItemArt item={item} />
                    <span class={s.haloScan} />
                  </div>
                )}
              </Show>
              <dl class={s.haloStats}>
                <dt>Edition</dt>
                <dd>{gradeOf(current().item).name}</dd>
                <dt>Price</dt>
                <dd class="num">
                  {cost(current().item).toLocaleString()} {current().item.currency.toUpperCase()}
                  <Show when={current().item.discount_percent}>{(off) => <em> (-{off()}%)</em>}</Show>
                </dd>
                <dt>Leaves in</dt>
                <dd class="num">{formatDuration(props.left(current().shelf.endsInS))}</dd>
              </dl>
              <p class={s.haloBlurb}>{HALO_BLURB[current().shelf.id]}</p>
            </aside>
          )}
        </Show>
      </div>
    </div>
  );
}

// ---- VALORANT beta (2020) ----------------------------------------------------------------

function BetaFront(props: FrontProps) {
  const sideShelves = () => shelvesOf(props.view).filter((shelf) => shelf.id === "night" || shelf.id === "accessories");
  return (
    <div class={s.bt}>
      <header class={s.btHead}>
        <span class={s.btTitle}>Store</span>
        <span class={s.btRule} />
        <span class={`${s.btTimer} num`}>Offers refresh · {clock(props.left(props.view.daily_ends_in_s))}</span>
      </header>
      <div class={s.btTop}>
        <Show when={props.view.bundles[0]}>
          {(bundle) => (
            <article class={s.btFeature} onMouseEnter={hover}>
              <Corners />
              <div class={s.btFeatureArt}>
                <BundleArt bundle={bundle()} />
              </div>
              <div class={s.btFeatureInfo}>
                <span class={s.btOverline}>Featured bundle · {formatDuration(props.left(bundle().ends_in_s))}</span>
                <span class={s.btFeatureName}>{bundle().name}</span>
                <Tag item={bundle()} currency="VP" class={s.btPrice} />
                <ul class={s.btBundleList}>
                  <For each={bundle().items}>
                    {(item) => (
                      <li>
                        <span>{item.name}</span>
                        <span class="num">{cost(item).toLocaleString()}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </article>
          )}
        </Show>
        <div class={s.btSide}>
          <For each={sideShelves()}>
            {(shelf) => (
              <section class={s.btShelf}>
                <span class={s.btOverline}>
                  {shelf.label} <i class="num">{formatDuration(props.left(shelf.endsInS))}</i>
                </span>
                <ul class={s.btList}>
                  <For each={shelf.items}>
                    {(item) => (
                      <li onMouseEnter={hover}>
                        <span class={s.btListArt}>
                          <ItemArt item={item} />
                        </span>
                        <span class={s.btListName}>{item.name}</span>
                        <Tag item={item} currency={item.currency} class={s.btPrice} />
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>
        </div>
      </div>
      <div class={s.btDaily}>
        <For each={props.view.daily}>
          {(item, index) => (
            <article class={s.btCard} style={{ "--stagger": index(), "--edition": EDITION_TINT[gradeOf(item).tone] }} onMouseEnter={hover}>
              <Corners />
              <span class={s.btIndex}>
                {(index() + 1).toString().padStart(2, "0")}
                <i>{gradeOf(item).name}</i>
              </span>
              <div class={s.btArt}>
                <ItemArt item={item} />
              </div>
              <span class={s.btCardName}>{item.name}</span>
              <Tag item={item} currency={item.currency} class={s.btPrice} />
            </article>
          )}
        </For>
      </div>
    </div>
  );
}

/** The beta's hairline corner brackets. */
function Corners() {
  return (
    <>
      <i class={s.corner} data-at="tl" />
      <i class={s.corner} data-at="tr" />
      <i class={s.corner} data-at="bl" />
      <i class={s.corner} data-at="br" />
    </>
  );
}

// ---- VALORANT 2022 -----------------------------------------------------------------------

type ValnowTab = "featured" | "night" | "accessories";

function ValnowFront(props: FrontProps) {
  const [tab, setTab] = createSignal<ValnowTab>("featured");
  const tabs = (): { id: ValnowTab; label: string }[] => [
    { id: "featured", label: "Featured" },
    ...(props.view.night_market?.length ? [{ id: "night" as const, label: "Night market" }] : []),
    { id: "accessories", label: "Accessories" },
  ];
  const tabItems = () => (tab() === "night" ? (props.view.night_market ?? []) : props.view.accessories);
  const tabEnds = () => (tab() === "night" ? props.view.night_market_ends_in_s : props.view.accessories_end_in_s);
  return (
    <div class={s.vn}>
      <nav class={s.vnTabs}>
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
      <div class={s.vnBody}>
        <Switch>
          <Match when={tab() === "featured" && props.view.bundles[0]}>
            {(bundle) => (
              <section class={s.vnHero} onMouseEnter={hover}>
                <div class={s.vnHeroArt}>
                  <BundleArt bundle={bundle()} />
                </div>
                <div class={s.vnHeroShade} />
                <div class={s.vnHeroInfo}>
                  <span class={s.vnBadge}>
                    Featured <b class="num">{formatDuration(props.left(bundle().ends_in_s))} remaining</b>
                  </span>
                  <span class={s.vnHeroName}>{bundle().name}</span>
                  <Tag item={bundle()} currency="VP" class={s.vnHeroPrice} />
                </div>
                <div class={s.vnStrip}>
                  <For each={bundle().items}>{(item, index) => <ValnowCard item={item} index={index()} isPart />}</For>
                </div>
                <span class={s.sheen} />
              </section>
            )}
          </Match>
          <Match when={tab() !== "featured"}>
            <section class={s.vnShelf}>
              <span class={s.vnShelfHead}>
                {tab() === "night" ? "Your night market" : "Accessories"}
                <b class="num">{formatDuration(props.left(tabEnds()))}</b>
              </span>
              <div class={s.vnShelfGrid}>
                <For each={tabItems()}>{(item, index) => <ValnowCard item={item} index={index()} isTall />}</For>
              </div>
            </section>
          </Match>
        </Switch>
        <aside class={s.vnOffers}>
          <header class={s.vnOffersHead}>
            <span>Offers</span>
            <b class="num">{formatDuration(props.left(props.view.daily_ends_in_s))}</b>
          </header>
          <For each={props.view.daily}>{(item, index) => <ValnowCard item={item} index={index()} isRow />}</For>
        </aside>
      </div>
    </div>
  );
}

/** `isPart`: a card inside the bundle, named by its weapon alone since the bundle name is above. */
function ValnowCard(props: { item: StoreItem; index: number; isRow?: boolean; isTall?: boolean; isPart?: boolean }): JSX.Element {
  const edition = () => gradeOf(props.item);
  return (
    <article
      class={s.vnCard}
      data-row={props.isRow ? "" : undefined}
      data-tall={props.isTall ? "" : undefined}
      style={{ "--edition": EDITION_TINT[edition().tone], "--stagger": props.index }}
      onMouseEnter={hover}
    >
      <Show when={props.item.discount_percent}>{(off) => <span class={s.vnSale}>-{off()}%</span>}</Show>
      <span class={s.vnEdition} title={edition().name} />
      <div class={s.vnArt}>
        <ItemArt item={props.item} />
      </div>
      <span class={s.vnName}>{props.isPart ? partsOf(props.item).base : props.item.name}</span>
      <Tag item={props.item} currency={props.item.currency} class={s.vnPrice} />
    </article>
  );
}

