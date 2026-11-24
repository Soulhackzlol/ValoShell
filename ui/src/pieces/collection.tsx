// Collection pieces: the loadout as a weapon wall grouped by category; the skin picker for the
// selected weapon lives in skinPicker.tsx. The wall only updates from Riot's answer.
import { For, Match, Show, Switch, createMemo, createSignal, onMount } from "solid-js";
import type { WeaponSlot } from "~/bindings/WeaponSlot";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { collectionView } from "~/state/views";
import { Art } from "~/ui/Art";
import { doc } from "~/studio/store";
import type { Skin } from "~/studio/types";
import { ViewStatus } from "~/ui/ViewStatus";
import styles from "./collection.module.css";
import layouts from "./collectionLayouts.module.css";

export const [selectedWeapon, setSelectedWeapon] = createSignal<string | null>(null);

export function useCollection(): void {
  onMount(() => {
    if (!collectionView.value()) void collectionView.load();
  });
}

function Status(props: { what: string }) {
  return <ViewStatus view={collectionView} title={props.what} loading="Opening your collection…" idle="Connect to VALORANT to see your loadout." />;
}

function WeaponCard(props: { slot: WeaponSlot; index: number }) {
  return (
    <button
      class={styles.weapon}
      data-part="weapon-card"
      style={{ "--stagger": props.index }}
      data-selected={selectedWeapon() === props.slot.weapon_id ? "" : undefined}
      onMouseEnter={() => playCue("hover")}
      onClick={() => {
        playCue("tab");
        setSelectedWeapon(props.slot.weapon_id);
      }}
    >
      <span class={styles.weaponArt}>
        <Art src={props.slot.image} fallback={<span class={styles.weaponInitial}>{props.slot.weapon_name}</span>} />
      </span>
      <span class={styles.weaponName}>{props.slot.weapon_name}</span>
      <span class={styles.skinName}>{props.slot.skin_name === props.slot.weapon_name ? "Standard" : props.slot.skin_name}</span>
    </button>
  );
}

type WallLayout = "categories" | "inventory" | "buymenu" | "list" | "slots";

/** The loadout's look when set to Auto: what the style's own game would show. */
const AUTO_WALL: Record<Skin, WallLayout> = {
  modern: "categories",
  current: "categories",
  glass: "categories",
  valnow: "categories",
  beta: "categories",
  fortnite: "categories",
  csgo: "inventory",
  cs2: "inventory",
  cs16: "buymenu",
  terminal: "list",
  halo: "list",
  minecraft: "slots",
  pipboy: "list",
  league: "categories",
  phantom: "categories",
  nightcity: "list",
};

/** Category names as a CS-style buy menu words them. */
const BUY_NAMES: Record<string, string> = {
  Sidearm: "Pistols",
  SMG: "Sub-machine guns",
  Shotgun: "Shotguns",
  Rifle: "Rifles",
  Sniper: "Sniper rifles",
  Heavy: "Machine guns",
  Melee: "Knife",
};

/** "Reaver Spectre" on a Spectre -> "Reaver"; the plain skin reads "Standard". */
function finishName(slot: WeaponSlot): string {
  if (slot.skin_name === slot.weapon_name) return "Standard";
  const trimmed = slot.skin_name.replace(new RegExp(`\\s*${slot.weapon_name}$`), "").trim();
  return trimmed || slot.skin_name;
}

function editionColor(edition: string | null | undefined): string {
  return edition ? (EDITION_COLORS[edition] ?? "var(--border-default)") : "#8f98a0";
}

function pickWeapon(slot: WeaponSlot): void {
  playCue("tab");
  setSelectedWeapon(slot.weapon_id);
}

export function WeaponWall(props: PieceProps) {
  useCollection();
  const groups = createMemo(() => {
    const byCategory = new Map<string, WeaponSlot[]>();
    for (const slot of collectionView.value()?.weapons ?? []) {
      byCategory.set(slot.category, [...(byCategory.get(slot.category) ?? []), slot]);
    }
    return [...byCategory.entries()];
  });
  const layout = (): WallLayout => {
    const chosen = props.piece.props["layout"];
    return typeof chosen === "string" && chosen !== "auto" ? (chosen as WallLayout) : AUTO_WALL[doc.theme.skin];
  };
  return (
    <Show when={collectionView.value()} fallback={<Status what="Collection" />}>
      <Switch>
        <Match when={layout() === "inventory"}>
          <InventoryWall groups={groups()} />
        </Match>
        <Match when={layout() === "buymenu"}>
          <BuyMenuWall groups={groups()} isEditing={props.isEditing} />
        </Match>
        <Match when={layout() === "list"}>
          <ListWall groups={groups()} />
        </Match>
        <Match when={layout() === "slots"}>
          <SlotWall groups={groups()} />
        </Match>
        <Match when={true}>
          <div class={styles.wall}>
            <div class={styles.columns}>
              <For each={wallColumns(groups())}>
                {(column, columnIndex) => (
                  <div class={styles.column}>
                    <For each={column}>
                      {([category, slots]) => (
                        <section class={styles.category} style={{ "--n": slots.length }}>
                          <span class={styles.categoryName} data-part="category-name">
                            {category}
                          </span>
                          <div class={styles.categoryGrid}>
                            <For each={slots}>{(slot, index) => <WeaponCard slot={slot} index={columnIndex() * 4 + index()} />}</For>
                          </div>
                        </section>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Match>
      </Switch>
    </Show>
  );
}

type Groups = [string, WeaponSlot[]][];

/** VALORANT's own arrangement: sidearms; SMGs over shotguns; rifles over the knife; snipers
    over heavies. At most five weapons per column, so the whole loadout fits on one screen. */
const WALL_COLUMN: Record<string, number> = { sidearm: 0, smg: 1, shotgun: 1, rifle: 2, melee: 2, sniper: 3, heavy: 3 };

function wallColumns(groups: Groups): Groups[] {
  const columns: Groups[] = [[], [], [], []];
  for (const group of groups) {
    const known = WALL_COLUMN[group[0].toLowerCase()];
    const index = known ?? columns.reduce((best, column, at) => (column.length < (columns[best]?.length ?? 0) ? at : best), 0);
    columns[index]?.push(group);
  }
  return columns.filter((column) => column.length > 0);
}

/** Grid (CS:GO's inventory): filter tabs over one dense grid, "Weapon | Finish", a rarity bar. */
function InventoryWall(props: { groups: Groups }) {
  const [filter, setFilter] = createSignal<string | null>(null);
  const shown = () => props.groups.filter(([category]) => filter() === null || category === filter()).flatMap(([, slots]) => slots);
  return (
    <div class={layouts.inventory}>
      <header class={layouts.invHead}>
        <span class={layouts.invTitle}>Inventory</span>
        <nav class={layouts.invTabs}>
          <button data-active={filter() === null ? "" : undefined} onClick={() => setFilter(null)}>
            All
          </button>
          <For each={props.groups}>
            {([category]) => (
              <button data-active={filter() === category ? "" : undefined} onClick={() => setFilter(category)}>
                {category}
              </button>
            )}
          </For>
        </nav>
        <span class={`${layouts.invCount} num`}>{shown().length} items</span>
      </header>
      <div class={layouts.invGrid}>
        <For each={shown()}>
          {(slot, index) => (
            <button
              class={layouts.invTile}
              data-part="weapon-card"
              data-selected={selectedWeapon() === slot.weapon_id ? "" : undefined}
              style={{ "--edition": editionColor(slot.edition), "--stagger": index() }}
              onMouseEnter={() => playCue("hover")}
              onClick={() => pickWeapon(slot)}
            >
              <span class={layouts.invArt}>
                <Art src={slot.image} fallback={<span class={styles.weaponInitial}>{slot.weapon_name}</span>} />
              </span>
              <span class={layouts.invName}>
                {slot.weapon_name} <i>|</i> <b>{finishName(slot)}</b>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

/** CS 1.6's buy menu: numbered categories, then numbered guns, with the picture beside. Keys 1-9 pick, 0 goes back. */
function BuyMenuWall(props: { groups: Groups; isEditing: boolean }) {
  const [category, setCategory] = createSignal<string | null>(null);
  const [hovered, setHovered] = createSignal<WeaponSlot | null>(null);
  let root: HTMLDivElement | undefined;
  const items = () => props.groups.find(([name]) => name === category())?.[1] ?? [];
  const shownSlot = () =>
    hovered() ?? collectionView.value()?.weapons.find((slot) => slot.weapon_id === selectedWeapon()) ?? null;
  const press = (key: string) => {
    if (key === "0") {
      playCue("back");
      setCategory(null);
      return;
    }
    const index = Number(key) - 1;
    if (!Number.isInteger(index) || index < 0) return;
    if (category() === null) {
      const group = props.groups[index];
      if (group) {
        playCue("tab");
        setCategory(group[0]);
      }
    } else {
      const slot = items()[index];
      if (slot) pickWeapon(slot);
    }
  };
  onMount(() => {
    if (!props.isEditing) root?.focus({ preventScroll: true });
  });
  return (
    <div
      ref={root}
      class={layouts.buy}
      tabIndex={0}
      onKeyDown={(event) => {
        if (/^[0-9]$/.test(event.key)) {
          event.preventDefault();
          press(event.key);
        }
      }}
    >
      <header class={layouts.buyTitle}>{category() === null ? "Select a category" : (BUY_NAMES[category() ?? ""] ?? category())}</header>
      <div class={layouts.buyCols}>
        <ol class={layouts.buyList}>
          <Show
            when={category() !== null}
            fallback={
              <For each={props.groups}>
                {([name], index) => (
                  <li>
                    <button class={layouts.buyItem} onClick={() => press(String(index() + 1))}>
                      <kbd>{index() + 1}</kbd> {BUY_NAMES[name] ?? name}
                    </button>
                  </li>
                )}
              </For>
            }
          >
            <For each={items()}>
              {(slot, index) => (
                <li>
                  <button
                    class={layouts.buyItem}
                    data-selected={selectedWeapon() === slot.weapon_id ? "" : undefined}
                    onMouseEnter={() => setHovered(slot)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(slot)}
                    onBlur={() => setHovered(null)}
                    onClick={() => pickWeapon(slot)}
                  >
                    <kbd>{index() + 1}</kbd> {slot.weapon_name}
                    <small>{finishName(slot)}</small>
                  </button>
                </li>
              )}
            </For>
            <li>
              <button class={layouts.buyItem} onClick={() => press("0")}>
                <kbd>0</kbd> Back
              </button>
            </li>
          </Show>
        </ol>
        <div class={layouts.buyPreview}>
          <Show when={shownSlot()} fallback={<span class={layouts.buyHint}>Pick a weapon to see its skin.</span>}>
            {(slot) => (
              <>
                <Art src={slot().image} class={layouts.buyImage} fallback={<span class={styles.weaponInitial}>{slot().weapon_name}</span>} />
                <span class={layouts.buyCaption}>
                  {slot().weapon_name}: {finishName(slot())}
                </span>
              </>
            )}
          </Show>
        </div>
      </div>
      <footer class={layouts.buyFooter}>1-9 select · 0 back</footer>
    </div>
  );
}

/** Compact rows: picture, weapon, finish, category. */
function ListWall(props: { groups: Groups }) {
  return (
    <div class={layouts.list}>
      <For each={props.groups.flatMap(([, slots]) => slots)}>
        {(slot, index) => (
          <button
            class={layouts.listRow}
            data-part="weapon-card"
            data-selected={selectedWeapon() === slot.weapon_id ? "" : undefined}
            style={{ "--edition": editionColor(slot.edition), "--stagger": index() }}
            onMouseEnter={() => playCue("hover")}
            onClick={() => pickWeapon(slot)}
          >
            <span class={layouts.listArt}>
              <Art src={slot.image} fallback={<span />} />
            </span>
            <b>{slot.weapon_name}</b>
            <span>{finishName(slot)}</span>
            <small>{slot.category}</small>
          </button>
        )}
      </For>
    </div>
  );
}

/** Minecraft's inventory: nine square slots per row, the name in a tooltip. */
function SlotWall(props: { groups: Groups }) {
  return (
    <div class={layouts.slots}>
      <span class={layouts.slotsTitle}>Inventory</span>
      <div class={layouts.slotGrid}>
        <For each={props.groups.flatMap(([, slots]) => slots)}>
          {(slot) => (
            <button
              class={layouts.slot}
              data-part="weapon-card"
              data-selected={selectedWeapon() === slot.weapon_id ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => pickWeapon(slot)}
            >
              <Art src={slot.image} class={layouts.slotImage} fallback={<span class={layouts.slotLetter}>{slot.weapon_name.slice(0, 2)}</span>} />
              <span class={layouts.slotTip}>
                <b>{slot.skin_name}</b>
                <small>{slot.category}</small>
              </span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

/** Edition colours, as the game tints its store cards. */
export const EDITION_COLORS: Record<string, string> = {
  Select: "#5a9fe2",
  Deluxe: "#009587",
  Premium: "#d1548d",
  Exclusive: "#f5955b",
  Ultra: "#fad663",
};
