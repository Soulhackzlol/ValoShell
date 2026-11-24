// The skin picker for the weapon picked on the wall (collection.tsx): owned skins, favourites
// first, chroma swatches and Equip. Equipping changes your real loadout (read-modify-write in
// the backend), so the picker only shows what Riot answers.
import { For, Show, createEffect, createMemo, createSignal, on, untrack } from "solid-js";
import { Check, Play, Star } from "lucide-solid";
import type { SkinOption } from "~/bindings/SkinOption";
import type { PieceProps } from "~/studio/registry";
import { call, errorText } from "~/ipc/commands";
import { playCue } from "~/menu/sound";
import { isFavoriteSkin, toggleFavoriteSkin } from "~/state/favorites";
import { pushToast } from "~/state/toasts";
import { collectionView } from "~/state/views";
import { Art } from "~/ui/Art";
import { Empty, controls } from "~/ui/controls";
import { ViewStatus } from "~/ui/ViewStatus";
import type { StatusSource } from "~/ui/viewState";
import { EDITION_COLORS, selectedWeapon, useCollection } from "./collection";
import styles from "./collection.module.css";
// Skin picker layouts (Showroom, Carousel, Compact) and its list motion, by data-part hooks.
import "./skinPickerLayouts.module.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 1.8;

/** Placeholder tiles while a weapon's skins load: about two rows. */
const SKIN_GHOSTS = Array.from({ length: 8 }, (_, index) => index);

/** The weapon on a stage: drag spins it, Ctrl+wheel zooms, double-click resets. It holds still otherwise. */
function InspectStage(props: { image: string | null; fallback: string; edition: string | null; video: string | null; onCloseVideo: () => void; swapKey: string }) {
  const [spin, setSpin] = createSignal(0);
  const [zoom, setZoom] = createSignal(1);
  let dragFrom: { x: number; spin: number } | null = null;
  const onPointerMove = (event: PointerEvent) => {
    if (dragFrom) setSpin(dragFrom.spin + (event.clientX - dragFrom.x) * 0.5);
  };
  const reset = () => {
    setSpin(0);
    setZoom(1);
  };
  // Each skin starts square-on at its own size, whatever the last one was turned to.
  createEffect(on(() => props.swapKey, reset, { defer: true }));
  return (
    <div
      class={styles.stage}
      data-part="skin-stage"
      data-edition={props.edition ?? undefined}
      style={{ "--edition": props.edition ? (EDITION_COLORS[props.edition] ?? "var(--accent)") : "var(--accent)" }}
      onPointerMove={onPointerMove}
      onPointerLeave={() => (dragFrom = null)}
      onPointerDown={(event) => {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        dragFrom = { x: event.clientX, spin: spin() };
      }}
      onPointerUp={() => (dragFrom = null)}
      onWheel={(event) => {
        // A plain wheel scrolls the panel past the stage; Ctrl+wheel (and a trackpad pinch,
        // which arrives as one) zooms the gun.
        if (!event.ctrlKey) return;
        event.preventDefault();
        setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current - event.deltaY * 0.0015)));
      }}
      onDblClick={reset}
    >
      <span class={styles.stageFloor} />
      <Show when={props.edition}>
        {(edition) => (
          <span class={styles.edition}>
            <i />
            {edition()} Edition
          </span>
        )}
      </Show>
      <Show keyed when={props.swapKey}>
        <div class={styles.model}>
          <div
            class={styles.modelTilt}
            style={{ transform: `perspective(900px) rotateY(${spin()}deg) scale(${zoom()})` }}
          >
            <Art src={props.image} class={styles.modelImage} fallback={<span class={styles.weaponInitial}>{props.fallback}</span>} />
            <span class={styles.sheen} />
          </div>
        </div>
      </Show>
      <Show when={props.image}>
        {(image) => <img class={styles.reflection} src={image()} alt="" aria-hidden="true" />}
      </Show>
      <span class={styles.stageHint}>Drag to turn · Ctrl+scroll to zoom · double-click to reset</span>
      <Show when={props.video}>
        {(url) => (
          <div class={styles.showcase}>
            <video class={styles.showcaseVideo} src={url()} autoplay controls playsinline onEnded={props.onCloseVideo} />
            <button class={styles.showcaseClose} title="Close video" onClick={props.onCloseVideo}>
              ×
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}

export function SkinPicker(_props: PieceProps) {
  useCollection();
  const [options, setOptions] = createSignal<SkinOption[] | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [picked, setPicked] = createSignal<{ skinId: string; chromaId: string } | null>(null);
  const [isEquipping, setEquipping] = createSignal(false);
  const [video, setVideo] = createSignal<string | null>(null);
  const slot = () => collectionView.value()?.weapons.find((weapon) => weapon.weapon_id === selectedWeapon());
  /**
   * Owned skins with the favourites first (a stable sort keeps Riot's order otherwise). Sorted
   * when a weapon's skins load, not on every star, so the list never jumps under the cursor.
   */
  const ordered = createMemo(() => {
    const all = options();
    if (!all) return null;
    return untrack(() => [...all].sort((a, b) => Number(isFavoriteSkin(b.skin_id)) - Number(isFavoriteSkin(a.skin_id))));
  });

  const loadOptions = (weaponId: string) => {
    setError(null);
    call("get_skin_options", { weaponId }).then(
      (next) => selectedWeapon() === weaponId && setOptions(next),
      // A late failure for the weapon picked before must not mark the new one as failed.
      (failure) => selectedWeapon() === weaponId && setError(errorText(failure)),
    );
  };
  /** The skin list's own state, shown like every piece's (with Try again). */
  const skinsStatus: StatusSource = {
    isLoading: () => options() === null && error() === null,
    error,
    load: async () => {
      const weaponId = selectedWeapon();
      if (weaponId) loadOptions(weaponId);
    },
  };

  createEffect(
    on(selectedWeapon, (weaponId) => {
      setOptions(null);
      setError(null);
      setPicked(null);
      setVideo(null);
      if (weaponId) loadOptions(weaponId);
    }),
  );

  const preview = () => {
    const choice = picked();
    const all = options() ?? [];
    const skin = all.find((option) => option.skin_id === (choice?.skinId ?? slot()?.skin_id));
    const chroma = skin?.chromas.find((entry) => entry.chroma_id === (choice?.chromaId ?? slot()?.chroma_id));
    return { skin, chroma, image: chroma?.image ?? skin?.image ?? slot()?.image ?? null };
  };

  const isEquipped = () => {
    const choice = picked();
    return !choice || (choice.skinId === slot()?.skin_id && choice.chromaId === slot()?.chroma_id);
  };

  const pick = (option: SkinOption) => {
    playCue("tab");
    setVideo(null);
    setPicked({ skinId: option.skin_id, chromaId: option.chromas[0]?.chroma_id ?? "" });
  };

  /** Step through the owned skins with the arrows (or ← →). */
  const step = (direction: 1 | -1) => {
    const all = ordered() ?? [];
    if (all.length === 0) return;
    const index = all.findIndex((option) => option.skin_id === preview().skin?.skin_id);
    const next = all[(index + direction + all.length) % all.length];
    if (next) pick(next);
  };

  const equip = async () => {
    const weaponId = selectedWeapon();
    const choice = picked();
    if (!weaponId || !choice) return;
    setEquipping(true);
    try {
      collectionView.set(await call("equip_skin", { weaponId, skinId: choice.skinId, chromaId: choice.chromaId }));
      playCue("confirm");
      setPicked(null);
    } catch (failure) {
      pushToast("negative", "Not equipped", errorText(failure));
    } finally {
      setEquipping(false);
    }
  };

  return (
    <Show when={slot()} fallback={<Empty title="Pick a weapon">Choose a weapon to see your skins for it.</Empty>}>
      {(current) => (
        <div
          class={styles.picker}
          data-part="screen-board"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              step(event.key === "ArrowRight" ? 1 : -1);
            }
          }}
        >
          <header class={styles.pickerHead} data-part="skin-head">
            <span class="overline">{current().category}</span>
            <div class={styles.titleRow}>
              <button class={styles.stepButton} title="Previous skin (←)" onClick={() => step(-1)}>
                ‹
              </button>
              <h2 class={styles.pickerTitle}>{preview().skin?.name ?? current().skin_name}</h2>
              <button class={styles.stepButton} title="Next skin (→)" onClick={() => step(1)}>
                ›
              </button>
              <Show when={preview().skin}>
                {(skin) => (
                  <button
                    class={styles.favoriteButton}
                    data-part="skin-favorite"
                    data-on={isFavoriteSkin(skin().skin_id) ? "" : undefined}
                    aria-pressed={isFavoriteSkin(skin().skin_id)}
                    aria-label="Favourite"
                    title={isFavoriteSkin(skin().skin_id) ? "Remove from favourites" : "Add to favourites"}
                    onClick={() => {
                      playCue("confirm");
                      toggleFavoriteSkin(skin().skin_id);
                    }}
                  >
                    <Star size={15} />
                  </button>
                )}
              </Show>
            </div>
          </header>
          <InspectStage
            image={preview().image}
            fallback={current().weapon_name}
            edition={preview().skin?.edition ?? null}
            video={video()}
            onCloseVideo={() => setVideo(null)}
            swapKey={`${preview().skin?.skin_id ?? current().skin_id}:${preview().chroma?.chroma_id ?? ""}`}
          />
          <Show when={preview().skin}>
            {(skin) => (
              <div class={styles.upgrades} data-part="skin-upgrades">
                <Show when={skin().levels.length > 1}>
                  <ol class={styles.levelTrack} aria-label="Upgrade levels">
                    <For each={skin().levels}>
                      {(level, index) => (
                        <li>
                          <button
                            class={styles.level}
                            data-part="skin-level"
                            data-owned={level.is_owned ? "" : undefined}
                            disabled={!level.video}
                            title={level.video ? `Play ${level.name}` : level.name}
                            onClick={() => {
                              playCue("confirm");
                              setVideo(level.video);
                            }}
                          >
                            <b class="num">{index() + 1}</b>
                            <span>{index() === 0 ? "Base" : (level.effect ?? "Upgrade")}</span>
                            <Show when={level.video}>
                              <Play size={11} />
                            </Show>
                          </button>
                        </li>
                      )}
                    </For>
                  </ol>
                </Show>
                <Show when={skin().chromas.length > 1}>
                  <div class={styles.chromas}>
                    <For each={skin().chromas}>
                      {(chroma) => (
                        <button
                          class={styles.chroma}
                          data-part="skin-chroma"
                          disabled={!chroma.is_owned}
                          title={chroma.is_owned ? chroma.name : `${chroma.name} (not owned)`}
                          data-active={(picked()?.chromaId ?? current().chroma_id) === chroma.chroma_id ? "" : undefined}
                          onClick={() => {
                            playCue("tab");
                            setVideo(null);
                            setPicked({ skinId: skin().skin_id, chromaId: chroma.chroma_id });
                          }}
                        >
                          <Art src={chroma.swatch} fallback={<span class={styles.swatchFallback} />} />
                        </button>
                      )}
                    </For>
                    <span class={styles.chromaName}>{preview().chroma?.name}</span>
                    <Show when={preview().chroma?.video}>
                      {(url) => (
                        <button class={styles.stepButton} title="Play this variant's video" onClick={() => setVideo(url())}>
                          <Play size={12} />
                        </button>
                      )}
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </Show>
          <div class={styles.skinList} data-part="skin-list" aria-busy={skinsStatus.isLoading()}>
            <Show
              when={ordered()}
              fallback={
                <Show when={!skinsStatus.isLoading()} fallback={<For each={SKIN_GHOSTS}>{() => <span class={styles.skinGhost} aria-hidden="true" />}</For>}>
                  <ViewStatus view={skinsStatus} title="Skins" loading="Loading your skins…" idle="" />
                </Show>
              }
            >
              {(all) => (
                <For each={all()}>
                  {(option, index) => (
                    <button
                      class={styles.skin}
                      data-part="skin-row"
                      title={option.name}
                      data-equipped={option.skin_id === current().skin_id ? "" : undefined}
                      data-picked={preview().skin?.skin_id === option.skin_id ? "" : undefined}
                      style={{
                        "--edition": option.edition ? (EDITION_COLORS[option.edition] ?? "transparent") : "transparent",
                        "--stagger": index(),
                      }}
                      onMouseEnter={() => playCue("hover")}
                      onClick={() => pick(option)}
                    >
                      <Art src={option.image} fallback={<span />} />
                      <span>{option.name}</span>
                      <Show when={isFavoriteSkin(option.skin_id)}>
                        <span class={styles.skinStar} title="Favourite">
                          <Star size={12} />
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              )}
            </Show>
          </div>
          <button class={controls.button} data-part="play" disabled={isEquipped() || isEquipping()} onClick={() => void equip()}>
            <Check size={15} /> {isEquipped() ? "Equipped" : isEquipping() ? "Equipping…" : "Equip"}
          </button>
        </div>
      )}
    </Show>
  );
}
