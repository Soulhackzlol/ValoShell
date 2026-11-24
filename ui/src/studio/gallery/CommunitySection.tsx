// The gallery's Community section: looks players shared (read from the ValoShell repository),
// and the form to share yours. Loads each time the gallery opens; the backend keeps the list
// for a few minutes, so reopening is instant.
import { For, Match, Show, Switch, createResource, createSignal } from "solid-js";
import { Share2 } from "lucide-solid";
import { TextField, controls } from "~/ui/controls";
import type { StudioDoc } from "../types";
import { type SharedLook, loadCommunity, shareToCommunity } from "./community";
import { MAX_AUTHOR_CHARS, MAX_DESCRIPTION_CHARS, MAX_NAME_CHARS, type ShareMeta } from "./communityShare";
import { LookCard } from "./LookCard";
import styles from "./gallery.module.css";

const SHARE_ICON_PX = 14;
const EMPTY_META: ShareMeta = { name: "", author: "", description: "" };

/** "by Mia · Pink and black.", leaving out whatever the sharer left blank. */
function captionOf(author: string, description: string): string {
  return [author && `by ${author}`, description].filter(Boolean).join(" · ");
}

function ShareForm(props: { onDone: () => void }) {
  const [meta, setMeta] = createSignal<ShareMeta>({ ...EMPTY_META });
  const edit = (key: keyof ShareMeta) => (value: string) => setMeta((current) => ({ ...current, [key]: value }));
  const share = async () => {
    if (await shareToCommunity(meta())) props.onDone();
  };
  return (
    <form class={styles.shareForm} data-part="share-form" onSubmit={(event) => (event.preventDefault(), void share())}>
      <p class={styles.shareNote}>
        Shares the look you have on now, widgets and layout included, publicly on GitHub. ValoShell copies it
        and opens GitHub; paste it there and press Propose changes (a free GitHub account is needed). Once
        it is reviewed, everyone sees it here.
      </p>
      <TextField label={`Name (up to ${MAX_NAME_CHARS})`} value={meta().name} onInput={edit("name")} />
      <TextField
        label={`Credit (optional, up to ${MAX_AUTHOR_CHARS})`}
        value={meta().author}
        placeholder="Leave blank to share without a name"
        onInput={edit("author")}
      />
      <TextField
        label={`About it (up to ${MAX_DESCRIPTION_CHARS})`}
        value={meta().description}
        isMultiline
        onInput={edit("description")}
      />
      <div class={styles.shareActions}>
        <button type="button" class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={props.onDone}>
          Cancel
        </button>
        <button type="submit" class={`${controls.button} ${controls.small}`}>
          Copy and open GitHub
        </button>
      </div>
    </form>
  );
}

function SharedGrid(props: { looks: SharedLook[]; skipped: number; onApply: (doc: StudioDoc, name: string) => void }) {
  return (
    <>
      <Show when={props.looks.length > 0} fallback={<p class={styles.empty}>No shared looks yet. Be the first!</p>}>
        <ul class={styles.grid}>
          <For each={props.looks}>
            {(look) => (
              <LookCard
                name={look.entry.name}
                caption={captionOf(look.entry.author, look.entry.description) || undefined}
                doc={look.doc}
                thumb={look.thumb}
                onApply={props.onApply}
              />
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.skipped > 0}>
        <p class={styles.empty}>
          {props.skipped === 1 ? "One shared look" : `${props.skipped} shared looks`} could not be loaded.
        </p>
      </Show>
    </>
  );
}

function CommunityHead(props: { isSharing: boolean; onToggle: () => void }) {
  return (
    <header class={styles.sectionHead}>
      <h3 id="gallery-community">Community</h3>
      <button
        class={`${controls.button} ${controls.ghost} ${controls.small}`}
        aria-expanded={props.isSharing}
        onClick={() => props.onToggle()}
      >
        <Share2 size={SHARE_ICON_PX} /> Share yours
      </button>
    </header>
  );
}

export function CommunitySection(props: { onApply: (doc: StudioDoc, name: string) => void }) {
  const [state, { refetch }] = createResource(loadCommunity);
  const [isSharing, setSharing] = createSignal(false);
  const failure = () => {
    const current = state();
    return current?.status === "error" ? current.message : null;
  };
  const ready = () => {
    const current = state();
    return current?.status === "ready" ? current : null;
  };
  return (
    <section class={styles.section} aria-labelledby="gallery-community" data-part="community-section">
      <CommunityHead isSharing={isSharing()} onToggle={() => setSharing((open) => !open)} />
      <Show when={isSharing()}>
        <ShareForm onDone={() => setSharing(false)} />
      </Show>
      <Switch fallback={<p class={styles.empty}>Loading shared looks…</p>}>
        <Match when={failure()}>
          {(message) => (
            <p class={styles.empty}>
              {message()}{" "}
              <button class={`${controls.button} ${controls.ghost} ${controls.small}`} onClick={() => void refetch()}>
                Try again
              </button>
            </p>
          )}
        </Match>
        <Match when={ready()}>
          {(loaded) => <SharedGrid looks={loaded().looks} skipped={loaded().skipped} onApply={props.onApply} />}
        </Match>
      </Switch>
    </section>
  );
}
