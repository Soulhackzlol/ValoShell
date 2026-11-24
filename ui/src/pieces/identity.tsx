// Identity pieces: what the player wears besides skins (card, title, the spray/flex wheel and
// each gun's buddy) and one picker for all of them. Any style opens the picker with
// `openCosmeticPicker`; it lists owned items only and equips through Riot.
import { For, Show, createMemo, createResource, createSignal, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { Layers, Search, X } from "lucide-solid";
import type { CosmeticKind } from "~/bindings/CosmeticKind";
import type { CosmeticOption } from "~/bindings/CosmeticOption";
import type { ExpressionSlot } from "~/bindings/ExpressionSlot";
import type { GunBuddy } from "~/bindings/GunBuddy";
import type { IdentityChange } from "~/bindings/IdentityChange";
import type { PieceProps } from "~/studio/registry";
import { errorText } from "~/ipc/commands";
import { playCue } from "~/menu/sound";
import { cosmeticOptions, equipIdentity } from "~/state/identity";
import { identityView } from "~/state/views";
import { Art } from "~/ui/Art";
import controls from "~/ui/controls.module.css";
import { focusWhenShown, useModalKeys } from "~/ui/modal";
import { ViewStatus } from "~/ui/ViewStatus";
import type { StatusSource } from "~/ui/viewState";
import { openLoadoutPresets } from "./loadoutPresets";
import styles from "./identity.module.css";

/** Something the picker can change, and how to ask Riot for it. */
export interface CosmeticTarget {
  kind: CosmeticKind;
  title: string;
  currentId: string | null;
  change: (id: string | null) => IdentityChange;
  /** Buddies can be taken off; a card or title always has one. */
  canRemove: boolean;
}

export function cardTarget(currentId: string | null): CosmeticTarget {
  return { kind: "card", title: "Player card", currentId, change: (id) => ({ kind: "card", id: id ?? "" }), canRemove: false };
}

export function titleTarget(currentId: string | null): CosmeticTarget {
  return { kind: "title", title: "Title", currentId, change: (id) => ({ kind: "title", id: id ?? "" }), canRemove: false };
}

export function wheelTarget(slot: ExpressionSlot): CosmeticTarget {
  const title = `${slot.kind === "flex" ? "Flex" : "Spray"} · slot ${slot.slot + 1}`;
  return { kind: slot.kind, title, currentId: slot.item?.id ?? null, change: (id) => ({ kind: "expression", slot: slot.slot, id: id ?? "" }), canRemove: false };
}

export function buddyTarget(line: GunBuddy): CosmeticTarget {
  const change = (id: string | null): IdentityChange => ({ kind: "buddy", weapon_id: line.weapon_id, id });
  return { kind: "buddy", title: `${line.weapon_name} buddy`, currentId: line.buddy?.id ?? null, change, canRemove: true };
}

const [target, setTarget] = createSignal<CosmeticTarget | null>(null);
const [query, setQuery] = createSignal("");

/** Open the picker for one target, with an empty search. */
export function openCosmeticPicker(next: CosmeticTarget): void {
  playCue("confirm");
  setQuery("");
  setTarget(next);
}

function closePicker(): void {
  playCue("back");
  setTarget(null);
}

function OptionTile(props: { option: CosmeticOption; kind: CosmeticKind; isCurrent: boolean; onPick: () => void }) {
  return (
    <button
      class={styles.option}
      data-kind={props.kind}
      data-current={props.isCurrent ? "" : undefined}
      title={props.option.name}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.onPick()}
    >
      <Show when={props.option.image} fallback={<span class={styles.optionText}>{props.option.name}</span>}>
        {(image) => <img src={image()} alt="" loading="lazy" decoding="async" draggable={false} />}
      </Show>
      <Show when={props.option.image}>
        <span class={styles.optionName}>{props.option.name}</span>
      </Show>
    </button>
  );
}

/** The picker itself; mount once (MenuShell does) and open it with `openCosmeticPicker`. */
export function CosmeticPicker() {
  const [isEquipping, setEquipping] = createSignal(false);
  const [options, { refetch }] = createResource(() => target()?.kind, cosmeticOptions);
  /** The options' state, shown like every piece's (a failed read is retried with Try again). */
  const optionsStatus: StatusSource = {
    isLoading: () => options.loading,
    error: () => (options.error ? errorText(options.error) : null),
    load: async () => void (await refetch()),
  };
  useModalKeys(() => target() !== null, closePicker);
  const shown = createMemo(() => {
    const needle = query().trim().toLowerCase();
    // Reading a failed resource throws; the error fallback below shows the reason instead.
    const owned = options.state === "ready" ? options() : [];
    return owned.filter((option) => !needle || option.name.toLowerCase().includes(needle));
  });
  const pick = async (id: string | null) => {
    const current = target();
    if (!current || isEquipping()) return;
    setEquipping(true);
    const isEquipped = await equipIdentity(current.change(id));
    setEquipping(false);
    if (isEquipped) setTarget(null);
  };
  return (
    <Show when={target()}>
      {(open) => (
        <Portal>
          <div class={styles.scrim} onClick={closePicker} />
          <div
            class={styles.picker}
            role="dialog"
            aria-modal="true"
            aria-label={open().title}
            data-busy={isEquipping() ? "" : undefined}
          >
            <header class={styles.head}>
              <h2>{open().title}</h2>
              <label class={styles.search}>
                <Search size={14} />
                <input class={controls.input} placeholder="Search" value={query()} ref={focusWhenShown} onInput={(event) => setQuery(event.currentTarget.value)} />
              </label>
              <button class={styles.close} aria-label="Close" onClick={closePicker}>
                <X size={16} />
              </button>
            </header>
            <Show
              when={options.state === "ready"}
              fallback={<ViewStatus view={optionsStatus} title={open().title} loading="Reading what you own…" idle="" />}
            >
              <div class={styles.grid} data-kind={open().kind}>
                <Show when={open().canRemove && open().currentId}>
                  <button class={styles.option} data-remove="" onClick={() => void pick(null)}>
                    <span class={styles.optionText}>Take it off</span>
                  </button>
                </Show>
                <For each={shown()} fallback={<p class={styles.none}>Nothing matches.</p>}>
                  {(option) => (
                    <OptionTile option={option} kind={open().kind} isCurrent={option.id === open().currentId} onPick={() => void pick(option.id)} />
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
}

function Status() {
  return <ViewStatus view={identityView} title={"Identity"} loading="Loading your loadout…" idle="Connect to VALORANT to see your card and sprays." />;
}

/** Card, title, wheel and buddies at a glance; each opens the picker. Loadouts opens presets. */
export function IdentityPiece(_props: PieceProps) {
  onMount(() => {
    if (!identityView.value() && !identityView.isLoading()) void identityView.load();
  });
  return (
    <Show when={identityView.value()} fallback={<Status />}>
      {(view) => (
        <section class={styles.identity}>
          <button class={styles.presets} title="Save or equip a whole loadout" onClick={openLoadoutPresets}>
            <Layers size={14} /> Loadouts
          </button>
          <button class={styles.card} title="Change your player card" onClick={() => openCosmeticPicker(cardTarget(view().card?.id ?? null))}>
            <Art src={view().card?.wide_image ?? view().card?.image} class={styles.cardArt} fallback={<span class={styles.cardArt} />} />
            <span class={styles.cardText}>
              <b>{view().card?.name ?? "No card"}</b>
            </span>
          </button>
          <button class={styles.title} title="Change your title" onClick={() => openCosmeticPicker(titleTarget(view().title?.id ?? null))}>
            {view().title?.name ?? "No title"}
          </button>
          <div class={styles.wheel} aria-label="Spray and flex wheel">
            <For each={view().expressions}>
              {(slot) => (
                <button class={styles.slot} title={wheelTarget(slot).title} onClick={() => openCosmeticPicker(wheelTarget(slot))}>
                  <Art src={slot.item?.image} fallback={<span class={styles.slotEmpty}>+</span>} />
                </button>
              )}
            </For>
          </div>
          <ul class={styles.buddies}>
            <For each={view().buddies}>
              {(line) => (
                <li>
                  <button class={styles.buddy} title={buddyTarget(line).title} onClick={() => openCosmeticPicker(buddyTarget(line))}>
                    <Art src={line.buddy?.image} fallback={<span class={styles.slotEmpty}>+</span>} />
                    <span>{line.weapon_name}</span>
                  </button>
                </li>
              )}
            </For>
          </ul>
        </section>
      )}
    </Show>
  );
}
