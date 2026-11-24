// Chat dock (MenuShell's bottom-left stack): a chip with every unread count that opens a panel
// with the conversations on the left (party, the team in agent select, whispers with friends)
// and the open one on the right. The panel resizes from its top-right grip, by drag or arrow
// keys, and keeps its size on this device. Skins restyle it through the data-part hooks.
import { Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { MessageSquare } from "lucide-solid";
import {
  activeThread,
  directUnreadCount,
  isDockOpen,
  openDirectChat,
  setActiveThread,
  setDockOpen,
  unreadCount,
} from "~/state/chat";
import { type ThreadKey, directPuuid } from "~/state/chatThreads";
import { playCue } from "../sound";
import { ChatConversation } from "./ChatConversation";
import { ChatRail } from "./ChatRail";
import { FriendPicker } from "./FriendPicker";
import {
  DEFAULT_PANEL_SIZE,
  KEY_STEP_PX,
  type PanelSize,
  clampPanelSize,
  loadPanelSize,
  savePanelSize,
} from "./panelSize";
import styles from "./chat.module.css";

/** Arrow keys on the grip, as width and height changes (the panel grows up and right). */
const KEY_STEPS: Record<string, [number, number]> = {
  ArrowRight: [KEY_STEP_PX, 0],
  ArrowLeft: [-KEY_STEP_PX, 0],
  ArrowUp: [0, KEY_STEP_PX],
  ArrowDown: [0, -KEY_STEP_PX],
};
const PRIMARY_BUTTON = 0;

const windowSize = (): PanelSize => ({ width: window.innerWidth, height: window.innerHeight });

/** Follow one drag from the grip; the returned function ends it (release, cancel or unmount). */
function followDrag(event: PointerEvent, size: PanelSize, resize: (next: PanelSize) => void): () => void {
  const grip = event.currentTarget as HTMLElement;
  const start = { x: event.clientX, y: event.clientY, ...size };
  const move = (moved: PointerEvent) =>
    resize({ width: start.width + moved.clientX - start.x, height: start.height - (moved.clientY - start.y) });
  const end = () => {
    grip.removeEventListener("pointermove", move);
    grip.removeEventListener("pointerup", end);
    grip.removeEventListener("pointercancel", end);
  };
  grip.setPointerCapture(event.pointerId);
  grip.addEventListener("pointermove", move);
  grip.addEventListener("pointerup", end);
  grip.addEventListener("pointercancel", end);
  return end;
}

/** Corner grip: the panel sits on the bottom-left corner, so dragging up and right grows it. */
function ResizeGrip(props: { size: PanelSize; onResize: (size: PanelSize) => void }) {
  let endDrag: (() => void) | null = null;
  const resize = (next: PanelSize) => props.onResize(clampPanelSize(next, windowSize()));
  const finish = () => {
    endDrag?.();
    endDrag = null;
    savePanelSize(props.size);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== PRIMARY_BUTTON) return;
    event.preventDefault();
    endDrag = followDrag(event, props.size, resize);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    resize({ width: props.size.width + step[0], height: props.size.height + step[1] });
    savePanelSize(props.size);
  };
  // Closing the dock mid-drag still keeps the size reached.
  onCleanup(() => endDrag && finish());
  return (
    <button
      class={styles.grip}
      data-part="chat-grip"
      aria-label="Resize the chat: drag, or use the arrow keys. Double-click resets it."
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onPointerUp={() => endDrag && finish()}
      onPointerCancel={() => endDrag && finish()}
      onKeyDown={onKeyDown}
      onDblClick={() => {
        resize(DEFAULT_PANEL_SIZE);
        savePanelSize(props.size);
      }}
    />
  );
}

function ChatChip(props: { unread: number; onToggle: () => void; ref: (element: HTMLButtonElement) => void }) {
  return (
    <button
      ref={props.ref}
      class={styles.chip}
      data-part="chat-chip"
      data-unread={props.unread > 0 ? "" : undefined}
      onClick={() => props.onToggle()}
      aria-expanded={isDockOpen()}
    >
      <MessageSquare size={15} />
      <span>Chat</span>
      <Show when={props.unread > 0}>
        <b class={styles.badge}>
          {props.unread}
          <span class={styles.hidden}> unread</span>
        </b>
      </Show>
    </button>
  );
}

/** The panel's size: saved, kept inside the window even when the window shrinks. */
function usePanelSize() {
  const [size, setSize] = createSignal(clampPanelSize(loadPanelSize(), windowSize()));
  const fit = () => setSize((current) => clampPanelSize(current, windowSize()));
  onMount(() => window.addEventListener("resize", fit));
  onCleanup(() => window.removeEventListener("resize", fit));
  return [size, setSize] as const;
}

export function ChatDock(props: { isTeamScene: boolean; hasChatLine: boolean }) {
  const [isPicking, setPicking] = createSignal(false);
  const [size, setSize] = usePanelSize();
  let chip: HTMLButtonElement | undefined;
  // Agent select opens on the team chat, the menus on the party chat; an open whisper stays.
  createEffect(
    on(
      () => props.isTeamScene,
      (isTeam) => directPuuid(activeThread()) === null && setActiveThread(isTeam ? "team" : "party"),
    ),
  );
  const unread = () => unreadCount("party") + (props.isTeamScene ? unreadCount("team") : 0) + directUnreadCount();
  const toggle = () => {
    const isClosing = isDockOpen();
    playCue(isClosing ? "back" : "confirm");
    setPicking(false);
    setDockOpen(!isClosing);
    // The focused box goes away with the panel; focus lands on the way in (the chip, or the chat
    // line's button standing in for it), not the page.
    if (isClosing) (chip?.isConnected ? chip : document.querySelector<HTMLElement>('[data-part="chat-open"]'))?.focus();
  };
  const select = (thread: ThreadKey) => {
    playCue("tab");
    setPicking(false);
    setActiveThread(thread);
  };
  const pick = (puuid: string) => {
    playCue("confirm");
    setPicking(false);
    openDirectChat(puuid);
  };
  return (
    <div class={styles.dock} data-part="chat-dock">
      <Show when={isDockOpen()}>
        <section
          class={styles.panel}
          data-part="chat-panel"
          aria-label="Chat"
          style={{ width: `${size().width}px`, height: `${size().height}px` }}
        >
          <ChatRail
            isTeamScene={props.isTeamScene}
            isPicking={isPicking()}
            onSelect={select}
            onNewMessage={() => setPicking(!isPicking())}
          />
          <Show when={isPicking()} fallback={<ChatConversation onClose={toggle} />}>
            <FriendPicker onPick={pick} onCancel={() => setPicking(false)} />
          </Show>
          <ResizeGrip size={size()} onResize={setSize} />
        </section>
      </Show>
      {/* A chat line on the screen opens this panel itself; a second way in would cover it. */}
      <Show when={!props.hasChatLine}>
        <ChatChip ref={(element) => (chip = element)} unread={unread()} onToggle={toggle} />
      </Show>
    </div>
  );
}
