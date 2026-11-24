// Ctrl+K (or Cmd+K) anywhere: one search box for everything the menu can do. Jump to a
// screen, change mode, start or cancel the queue, ready up, open the party, invite an online
// friend, switch style or open the Studio, all from the keyboard. Works in every style.
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { ArrowRight, Search } from "lucide-solid";
import { openDirectChat } from "~/state/chat";
import { openTour } from "~/state/onboarding";
import { friends } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { copyPartyCode } from "~/state/partyCode";
import { SKINS } from "~/studio/skins";
import { doc, isEditing, setEditMode } from "~/studio/store";
import { switchSkin } from "~/studio/shortcuts";
import { openEscMenu } from "./EscMenu";
import { replayIntro } from "./Intro";
import { matchScore } from "./fuzzy";
import { TABS } from "./scenes";
import { playCue } from "./sound";
import styles from "./CommandPalette.module.css";

interface Entry {
  id: string;
  group: string;
  title: string;
  hint?: string;
  /** The title is a player's name: blurred in streamer mode. */
  isSensitive?: boolean;
  run: () => void;
}

const [isOpen, setOpen] = createSignal(false);

export function openCommandPalette(): void {
  playCue("confirm");
  setOpen(true);
}

function useEntries(): () => Entry[] {
  const navigate = useNavigate();
  return () => {
    const view = party();
    const entries: Entry[] = TABS.map((tab) => ({
      id: `go-${tab.id}`,
      group: "Go to",
      title: tab.label,
      run: () => navigate(`/${tab.id}`),
    }));
    if (view?.is_owner && !view.is_queueing) {
      for (const queue of view.eligible_queues) {
        if (queue.id === view.queue.id) continue;
        entries.push({ id: `queue-${queue.id}`, group: "Mode", title: queue.label, hint: "Switch mode", run: () => void partyActions.changeQueue(queue.id) });
      }
    }
    if (view) {
      if (view.is_queueing) entries.push({ id: "cancel", group: "Party", title: "Cancel search", run: () => void partyActions.stopQueue() });
      else if (view.is_owner) {
        const title = view.is_custom_game ? "Start custom game" : `Find match · ${view.queue.label}`;
        entries.push({ id: "start", group: "Party", title, run: () => void partyActions.start() });
      }
      const self = view.members.find((member) => member.is_self);
      if (!view.is_owner && self) entries.push({ id: "ready", group: "Party", title: self.is_ready ? "Not ready" : "Ready up", run: () => void partyActions.setReady(!self.is_ready) });
      if (view.is_owner) entries.push({ id: "access", group: "Party", title: view.is_open ? "Close party" : "Open party", run: () => void partyActions.setOpen(!view.is_open) });
      // The hint never shows the code itself: the palette is on screen, and a code lets anyone join.
      const code = view.invite_code;
      entries.push({
        id: "code",
        group: "Party",
        title: "Party code",
        hint: code ? "Copy" : "Create",
        run: () => void (code ? copyPartyCode(code) : partyActions.generateCode()),
      });
      if (view.members.length > 1) entries.push({ id: "leave", group: "Party", title: "Leave party", run: () => void partyActions.leave() });
    }
    for (const friend of friends()) {
      if (friend.status !== "menus" && friend.status !== "queueing") continue;
      if (view?.members.some((member) => member.puuid === friend.puuid)) continue;
      const riotId = `${friend.game_name}#${friend.tag_line}`;
      entries.push({ id: `invite-${friend.puuid}`, group: "Invite", title: riotId, hint: "Invite to party", isSensitive: true, run: () => void partyActions.invite(riotId) });
    }
    for (const friend of friends()) {
      const riotId = `${friend.game_name}#${friend.tag_line}`;
      entries.push({ id: `message-${friend.puuid}`, group: "Message", title: riotId, hint: "Whisper", isSensitive: true, run: () => openDirectChat(friend.puuid) });
    }
    for (const skin of SKINS) {
      if (skin.id === doc.theme.skin) continue;
      entries.push({ id: `skin-${skin.id}`, group: "Style", title: skin.label, hint: skin.caption, run: () => switchSkin(skin.id) });
    }
    entries.push(
      { id: "studio", group: "App", title: isEditing() ? "Close Studio" : "Open Studio", hint: "Ctrl+E", run: () => setEditMode(!isEditing()) },
      { id: "intro", group: "App", title: "Replay intro", hint: "F9", run: replayIntro },
      { id: "tour", group: "App", title: "Welcome tour", hint: "Styles, comfort, privacy, keys", run: openTour },
      { id: "settings", group: "App", title: "Settings", hint: "Esc", run: openEscMenu },
    );
    return entries;
  };
}

export function CommandPalette() {
  const entries = useEntries();
  const [query, setQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(0);
  let input: HTMLInputElement | undefined;

  const results = createMemo(() => {
    const text = query().trim();
    return entries()
      .map((entry) => ({ entry, score: matchScore(`${entry.title} ${entry.group}`, text) }))
      .filter((row): row is { entry: Entry; score: number } => row.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 9)
      .map((row) => row.entry);
  });

  const close = () => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  };
  const runEntry = (entry: Entry | undefined) => {
    if (!entry) return;
    playCue("confirm");
    close();
    entry.run();
  };

  const onGlobalKey = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (isOpen()) close();
      else openCommandPalette();
    }
  };
  onMount(() => window.addEventListener("keydown", onGlobalKey));
  onCleanup(() => window.removeEventListener("keydown", onGlobalKey));

  const onKeyDown = (event: KeyboardEvent) => {
    // Keep Esc, Q/E and the editor's keys from reaching the menu underneath.
    event.stopPropagation();
    const count = results().length;
    if (event.key === "Escape") {
      event.preventDefault();
      playCue("back");
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => (value + 1) % Math.max(1, count));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => (value - 1 + count) % Math.max(1, count));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runEntry(results()[cursor()]);
    }
  };

  return (
    <Show when={isOpen()}>
      <Portal>
        <div class={styles.scrim} onPointerDown={close} />
        <div class={styles.palette} role="dialog" aria-label="Command palette">
          <label class={styles.field}>
            <Search size={20} />
            <input
              ref={(element) => {
                input = element;
                queueMicrotask(() => input?.focus());
              }}
              placeholder="Go anywhere, change mode, invite a friend…"
              value={query()}
              spellcheck={false}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
            />
            <kbd class={styles.kbd}>Esc</kbd>
          </label>
          <ol class={styles.list}>
            <For each={results()} fallback={<li class={styles.empty}>Nothing matches “{query()}”</li>}>
              {(entry, index) => (
                <li
                  class={styles.item}
                  data-active={index() === cursor() ? "" : undefined}
                  onPointerMove={() => setCursor(index())}
                  onClick={() => runEntry(entry)}
                >
                  <span class={styles.group}>{entry.group}</span>
                  <span class={styles.title} data-sensitive={entry.isSensitive ? "" : undefined}>
                    {entry.title}
                  </span>
                  <Show when={entry.hint}>
                    <span class={styles.hint}>{entry.hint}</span>
                  </Show>
                  <ArrowRight size={16} class={styles.go ?? ""} />
                </li>
              )}
            </For>
          </ol>
          <footer class={styles.footer}>
            <span>
              <kbd class={styles.kbd}>↑</kbd>
              <kbd class={styles.kbd}>↓</kbd> move
            </span>
            <span>
              <kbd class={styles.kbd}>Enter</kbd> run
            </span>
            <span class={styles.brand}>
              <kbd class={styles.kbd}>Ctrl</kbd>
              <kbd class={styles.kbd}>K</kbd>
            </span>
          </footer>
        </div>
      </Portal>
    </Show>
  );
}
