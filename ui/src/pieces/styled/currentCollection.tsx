// VALORANT (current client) collection: the weapon wall in the client's five columns (sidearms;
// SMGs, shotguns and melee; rifles; snipers and machine guns; then your player card and the
// expression wheel). A weapon opens the skin picker over the wall, as the client does; the
// card and every wheel slot open the identity picker. Offline, the wheel shows the images the
// piece names instead.
import { For, Index, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { X } from "lucide-solid";
import type { WeaponSlot } from "~/bindings/WeaponSlot";
import type { PieceProps } from "~/studio/registry";
import { selectedWeapon, setSelectedWeapon } from "~/pieces/collection";
import { SkinPicker } from "~/pieces/skinPicker";
import { cardTarget, openCosmeticPicker, wheelTarget } from "~/pieces/identity";
import { openLoadoutPresets } from "~/pieces/loadoutPresets";
import { playCue } from "~/menu/sound";
import { party } from "~/state/party";
import { ownRiotId } from "~/state/session";
import { collectionView, identityView } from "~/state/views";
import { Art } from "~/ui/Art";
import { colorVars } from "./current";
import { ValCanvas } from "./valCanvas";
import { ValLogo } from "./valIcons";
import { valLang, vt } from "./valText";
import styles from "./currentCollection.module.css";

/** The client's columns, top to bottom; a category not listed joins the shortest column. */
const COLUMNS: readonly (readonly string[])[] = [["Sidearm"], ["SMG", "Shotgun", "Melee"], ["Rifle"], ["Sniper", "Heavy"]];

/** The client draws its pages on plain navy with faint diagonal seams; the diamonds stay home. */
const PAGE_BACKGROUND =
  "linear-gradient(115deg, transparent 49.9%, rgb(255 255 255 / 0.025) 50%, transparent 50.1%), radial-gradient(ellipse at 45% 35%, var(--val-page, #213042), #121b25 75%)";

/** Weapons in the client's order within each category. */
const ORDER = [
  "Classic", "Shorty", "Frenzy", "Ghost", "Bandit", "Sheriff",
  "Stinger", "Spectre", "Bucky", "Judge",
  "Bulldog", "Guardian", "Warden", "Phantom", "Vandal",
  "Marshal", "Outlaw", "Operator", "Ares", "Odin",
];

const CATEGORY_KEYS = {
  Sidearm: "sidearms",
  SMG: "smgs",
  Shotgun: "shotguns",
  Rifle: "rifles",
  Sniper: "snipers",
  Heavy: "heavies",
  Melee: "melee",
} as const;

function categoryTitle(category: string): string {
  const key = CATEGORY_KEYS[category as keyof typeof CATEGORY_KEYS];
  return key ? vt(key) : category;
}

function rank(slot: WeaponSlot): number {
  const at = ORDER.indexOf(slot.weapon_name);
  return at === -1 ? ORDER.length : at;
}

type Group = { category: string; slots: WeaponSlot[] };

function columnsOf(weapons: readonly WeaponSlot[]): Group[][] {
  const byCategory = new Map<string, WeaponSlot[]>();
  for (const slot of weapons) byCategory.set(slot.category, [...(byCategory.get(slot.category) ?? []), slot]);
  const columns: Group[][] = COLUMNS.map((names) =>
    names.flatMap((category) => {
      const slots = byCategory.get(category);
      byCategory.delete(category);
      return slots ? [{ category, slots: [...slots].sort((a, b) => rank(a) - rank(b)) }] : [];
    }),
  );
  for (const [category, slots] of byCategory) {
    const shortest = columns.reduce((best, column) => (column.length < best.length ? column : best), columns[0] ?? []);
    shortest.push({ category, slots });
  }
  return columns;
}

export function ValCollection(props: PieceProps) {
  onMount(() => {
    if (!collectionView.value() && !collectionView.isLoading()) void collectionView.load();
    if (!identityView.value() && !identityView.isLoading()) void identityView.load();
  });
  const [isOpen, setOpen] = createSignal(false);
  const columns = createMemo(() => columnsOf(collectionView.value()?.weapons ?? []));
  const close = () => {
    playCue("back");
    setOpen(false);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen()) {
      event.stopPropagation();
      close();
    }
  };
  onMount(() => window.addEventListener("keydown", onKey, true));
  onCleanup(() => window.removeEventListener("keydown", onKey, true));
  return (
    <ValCanvas style={{ ...colorVars(props, ["tile", "title", "page"]), background: PAGE_BACKGROUND }}>
    <div
      class={styles.root}
      onClick={(event) => {
        // Empty space closes the open weapon; a weapon, the cards or the panel itself do not.
        const target = event.target as Element;
        if (isOpen() && !target.closest(`button, a, input, select, .${styles.detailPanel}`)) close();
      }}
    >
      <span class={styles.crumb}>
        <i />
        {vt("collection")}
      </span>
      <div class={styles.columns}>
        <For each={columns()}>
          {(column) => (
            <div class={styles.column}>
              <For each={column}>
                {(group, index) => (
                  <>
                    <h2 class={styles.title} data-first={index() === 0 ? "" : undefined}>
                      {categoryTitle(group.category)}
                    </h2>
                    <For each={group.slots}>
                      {(slot) => (
                        <WeaponTile
                          slot={slot}
                          onOpen={() => {
                            playCue("confirm");
                            setSelectedWeapon(slot.weapon_id);
                            setOpen(true);
                          }}
                        />
                      )}
                    </For>
                  </>
                )}
              </For>
            </div>
          )}
        </For>
        <div class={styles.column} data-kind="cards">
          <h2 class={styles.title} data-first="">
            {vt("playerCards")}
          </h2>
          <PlayerCard />
          <h2 class={styles.title}>{vt("expression")}</h2>
          <ExpressionWheel props={props} />
          <button class={styles.presets} onMouseEnter={() => playCue("hover")} onClick={openLoadoutPresets}>
            {valLang() === "es" ? "Equipamientos guardados" : "Saved loadouts"}
          </button>
        </div>
      </div>
      <Show when={isOpen() && selectedWeapon()}>
        <div class={styles.detail}>
          <span class={styles.detailShade} aria-hidden="true" />
          <div class={styles.detailPanel}>
            <button class={styles.detailClose} onMouseEnter={() => playCue("hover")} onClick={close} aria-label="Close">
              <X size={18} />
            </button>
            <SkinPicker {...props} />
          </div>
        </div>
      </Show>
    </div>
    </ValCanvas>
  );
}

function WeaponTile(props: { slot: WeaponSlot; onOpen: () => void }) {
  return (
    <button class={styles.tile} data-part="weapon-card" onMouseEnter={() => playCue("hover")} onClick={() => props.onOpen()}>
      <Art src={props.slot.image} class={styles.tileArt} fallback={<span class={styles.tileEmpty} />} />
      <span class={styles.tileName}>{props.slot.weapon_name}</span>
      <i class={styles.tileLine} />
    </button>
  );
}

function PlayerCard() {
  const self = () => party()?.members.find((member) => member.is_self);
  return (
    <button
      class={styles.card}
      title="Change your player card"
      onMouseEnter={() => playCue("hover")}
      onClick={() => openCosmeticPicker(cardTarget(identityView.value()?.card?.id ?? null))}
    >
      <span class={styles.cardArt} style={{ "--art": self()?.card_tall ? `url("${self()?.card_tall}")` : "none" }} />
      <span class={styles.cardShade} />
      <Show when={self()?.account_level}>
        {(level) => (
          <span class={styles.level}>
            <svg viewBox="0 0 60 20" preserveAspectRatio="none" aria-hidden="true">
              <path d="M7 0.5H53L59.5 10L53 19.5H7L0.5 10Z" />
            </svg>
            <span>{level()}</span>
          </span>
        )}
      </Show>
      <span class={styles.cardInfo}>
        <b data-sensitive>{self()?.game_name || ownRiotId()?.name || "—"}</b>
        <Show when={self()?.title}>{(title) => <small>{title()}</small>}</Show>
        <span class={styles.chevrons} aria-hidden="true">
          <i data-side="l" />
          <i data-side="r" />
        </span>
      </span>
    </button>
  );
}

/** The spray wheel: four slots round a hub, each the real slot when the loadout is read. */
function ExpressionWheel(props: { props: PieceProps }) {
  // By the loadout's own slot number: the list leaves out slots of kinds it does not know.
  const slot = (index: number) => identityView.value()?.expressions.find((entry) => entry.slot === index) ?? null;
  const spray = (index: number) => {
    if (identityView.value()) return slot(index)?.item?.image ?? null;
    const value = props.props.piece.props[`spray${index + 1}`];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return (
    <div class={styles.wheel}>
      <i class={styles.wheelCross} />
      <span class={styles.hub}>
        <i />
      </span>
      <Index each={[0, 1, 2, 3]}>
        {(index) => (
          <button
            class={styles.spray}
            data-slot={index()}
            disabled={!slot(index())}
            title={slot(index()) ? "Change this slot" : undefined}
            onClick={() => {
              const current = slot(index());
              if (current) openCosmeticPicker(wheelTarget(current));
            }}
          >
            <Art src={spray(index())} class={styles.sprayArt} fallback={<ValLogo size={26} class={styles.sprayEmpty} />} />
          </button>
        )}
      </Index>
    </div>
  );
}
