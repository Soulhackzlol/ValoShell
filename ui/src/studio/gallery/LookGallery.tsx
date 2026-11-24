// The look gallery: a live preview of the picked look (the app itself, LivePreview) beside
// cards for saved looks, the community's shared looks and the starter looks. Saved looks are
// files in the looks folder (send one with "Show file"); community looks come from the
// ValoShell repository (CommunitySection).
// Applying is a normal Studio edit (Ctrl+Z undoes it). Deleting asks for a second click.
import { For, Show, createEffect, createSignal, on } from "solid-js";
import { unwrap } from "solid-js/store";
import { Portal } from "solid-js/web";
import { FolderOpen, FileSearch, X } from "lucide-solid";
import { controls } from "~/ui/controls";
import { focusWhenShown, useInertBackground, useModalKeys } from "~/ui/modal";
import { playCue } from "~/menu/sound";
import { pushToast } from "~/state/toasts";
import {
  type LoadedLook,
  applyLookDoc,
  loadLook,
  lookNames,
  openLooksFolder,
  refreshLooks,
  revealLook,
} from "../looks";
import { doc } from "../store";
import type { StudioDoc } from "../types";
import { DeleteLookButton } from "./DeleteLookButton";
import { CommunitySection } from "./CommunitySection";
import { LivePreview } from "./LivePreview";
import { LookCard } from "./LookCard";
import { pickLook } from "./selection";
import { STARTER_LOOKS, starterDoc, starterThumb } from "./starterLooks";
import styles from "./gallery.module.css";

const [isGalleryOpen, setGalleryOpen] = createSignal(false);
export const openGallery = () => setGalleryOpen(true);
const closeGallery = () => setGalleryOpen(false);

interface SavedLook {
  name: string;
  doc: StudioDoc;
}

function apply(doc: StudioDoc, name: string): void {
  playCue("confirm");
  closeGallery();
  // A copy: the applied document becomes the live one, and later edits must not reach the card.
  applyLookDoc(structuredClone(doc), name);
}

function SavedSection(props: { looks: SavedLook[]; isLoading: boolean }) {
  return (
    <section class={styles.section} aria-labelledby="gallery-saved">
      <header class={styles.sectionHead}>
        <h3 id="gallery-saved">Your looks</h3>
        <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={() => void openLooksFolder()}>
          <FolderOpen size={14} /> Open looks folder
        </button>
      </header>
      <Show
        when={props.looks.length > 0}
        fallback={
          <p class={styles.empty}>
            {props.isLoading
              ? "Loading your looks…"
              : "No saved looks yet. Save one under Studio → Theme → Looks, or drop a look file " +
                "someone sent you into the looks folder."}
          </p>
        }
      >
        <ul class={styles.grid}>
          <For each={props.looks}>
            {(look) => (
              <LookCard name={look.name} doc={look.doc} onApply={apply}>
                <button
                  class={styles.iconButton}
                  title="Show the file, to send it to someone"
                  aria-label={`Show the file of ${look.name}`}
                  onClick={() => void revealLook(look.name)}
                >
                  <FileSearch size={14} />
                </button>
                <DeleteLookButton name={look.name} class={styles.iconButton} />
              </LookCard>
            )}
          </For>
        </ul>
      </Show>
    </section>
  );
}

function StarterSection() {
  return (
    <section class={styles.section} aria-labelledby="gallery-starters">
      <header class={styles.sectionHead}>
        <h3 id="gallery-starters">Starter looks</h3>
      </header>
      <ul class={styles.grid}>
        <For each={STARTER_LOOKS}>
          {(look) => (
            <LookCard
              name={look.name}
              caption={look.caption}
              doc={starterDoc(look)}
              thumb={starterThumb(look)}
              onApply={apply}
            />
          )}
        </For>
      </ul>
    </section>
  );
}

/** One message for every saved look that could not be read, instead of one per file. */
function reportUnreadable(loaded: LoadedLook[]): void {
  const failed = loaded.filter((look) => "error" in look).map((look) => look.name);
  if (failed.length === 0) return;
  const what = failed.length === 1 ? "A saved look" : `${failed.length} saved looks`;
  pushToast("negative", `${what} could not be read`, failed.join(", "));
}

/**
 * Saved looks with their documents. Opening asks for a fresh list first and loads once it
 * arrives; after that, a change of the list (a delete) loads again. Only the latest load lands.
 */
function useSavedLooks(): { looks: () => SavedLook[]; isLoading: () => boolean } {
  const [looks, setLooks] = createSignal<SavedLook[]>([]);
  const [isListFresh, setListFresh] = createSignal(false);
  let latest = 0;
  createEffect(
    on(isGalleryOpen, (isOpen) => {
      setListFresh(false);
      if (isOpen) void refreshLooks().then(() => setListFresh(true));
    }),
  );
  createEffect(
    on([isListFresh, lookNames], ([isFresh, names]) => {
      if (!isFresh) return;
      const request = ++latest;
      void Promise.all(names.map(loadLook)).then((loaded) => {
        if (request !== latest) return;
        reportUnreadable(loaded);
        setLooks(loaded.filter((look): look is SavedLook => "doc" in look));
      });
    }),
  );
  return { looks, isLoading: () => !isListFresh() };
}

/** Opening shows the look you have on now, so every card can be compared against it. */
function pickCurrentLookOnOpen(): void {
  createEffect(
    on(isGalleryOpen, (isOpen) => {
      if (isOpen) pickLook({ name: "Your current look", caption: "What you have on now", doc: structuredClone(unwrap(doc)) });
    }),
  );
}

export function LookGallery() {
  const saved = useSavedLooks();
  pickCurrentLookOnOpen();
  useInertBackground(isGalleryOpen);
  useModalKeys(isGalleryOpen, closeGallery);
  return (
    <Show when={isGalleryOpen()}>
      <Portal>
        <div class={styles.scrim} data-part="gallery-scrim" onClick={closeGallery} />
        <section
          class={styles.gallery}
          data-part="gallery"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-title"
        >
          <header class={styles.head}>
            <h2 id="gallery-title" tabIndex={-1} ref={focusWhenShown}>
              Look gallery
            </h2>
            <button class={styles.iconButton} aria-label="Close" onClick={closeGallery}>
              <X size={16} />
            </button>
          </header>
          <div class={styles.layout}>
            <LivePreview onApply={apply} />
            <div class={styles.body}>
              <SavedSection looks={saved.looks()} isLoading={saved.isLoading()} />
              <CommunitySection onApply={apply} />
              <StarterSection />
            </div>
          </div>
          <footer class={styles.foot}>
            Click a look to preview it live, double-click or Apply to use it. Share with everyone under
            Community, or send a look's file (the magnifier on its card).
          </footer>
        </section>
      </Portal>
    </Show>
  );
}
