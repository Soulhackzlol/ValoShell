// Terminal style: a working console. A live status line on top, a scrollback log and a
// prompt. Commands drive the real party and menu: play, cancel, mode, ready, invite, open,
// close, friends, rank, store, cd <tab>, clear, help. Up/Down walk the command history.
import type { FriendView } from "~/bindings/FriendView";
import { For, Show, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { PieceProps } from "~/studio/registry";
import { TABS } from "~/menu/scenes";
import { friends } from "~/state/friends";
import { partyLabel } from "~/ui/stacks";
import { party, partyActions } from "~/state/party";
import { connection, ownRiotId } from "~/state/session";
import { careerView, storeView } from "~/state/views";
import { usePlay } from "./usePlay";
import styles from "./terminal.module.css";

type LineKind = "in" | "out" | "err";
interface Line {
  id: number;
  kind: LineKind;
  text: string;
  /** Holds a player name or Riot ID, so streamer mode can hide it. */
  isSensitive: boolean;
}

const MAX_LINES = 300;
const BOOT_STEPS = 5;
const BOOT_DELAY_MS = 240;
const BOOT_BEAT_MS = 110;
const HELP = [
  "play            start the queue (or toggle ready if you are not the leader)",
  "cancel          leave the queue",
  "mode [name]     list modes, or switch to one",
  "ready           toggle ready",
  "invite NAME#TAG invite a player",
  "open | close    party access",
  "friends         who is online",
  "rank            rank, RR and record",
  "store           today's offers",
  "cd TAB          go to " + TABS.map((tab) => tab.id).join(", "),
  "clear           clear the screen",
];

let lineId = 0;
const line = (kind: LineKind, text: string, isSensitive = false): Line => ({ id: (lineId += 1), kind, text, isSensitive });

export function TerminalConsole(props: PieceProps) {
  const navigate = useNavigate();
  const play = usePlay();
  const greeting = () => {
    const text = props.piece.props["greeting"];
    return typeof text === "string" && text ? text : "valoshell console - type 'help'";
  };
  // The greeting stays live (it is edited from the Inspector) until 'clear' wipes the screen.
  const [hasGreeting, setHasGreeting] = createSignal(true);
  const [lines, setLines] = createSignal<Line[]>([line("out", "")]);
  const [input, setInput] = createSignal("");
  const history: string[] = [];
  let historyIndex = 0;
  let scroller: HTMLDivElement | undefined;
  let field: HTMLInputElement | undefined;

  const append = (next: Line[]) => setLines((current) => [...current, ...next].slice(-MAX_LINES));
  const print = (kind: LineKind, ...texts: string[]) => append(texts.map((text) => line(kind, text)));
  const printNames = (...texts: string[]) => append(texts.map((text) => line("out", text, true)));

  createEffect(on(lines, () => scroller?.scrollTo({ top: scroller.scrollHeight })));
  // A short boot log, one check per beat, so the console opens alive rather than empty.
  const bootChecks = (): [LineKind, string][] => {
    const current = party();
    const online = friends().filter((friend) => friend.status !== "offline").length;
    const career = careerView.value();
    const isConnected = connection().state === "connected";
    return [
      [isConnected ? "out" : "err", `[${isConnected ? " ok " : "fail"}] riot client   ${isConnected ? "connected" : "offline"}`],
      current
        ? ["out", `[ ok ] party         ${current.members.length}/${current.max_size} ${current.queue.label.toLowerCase()}`]
        : ["err", "[fail] party         none"],
      ["out", `[ ok ] friends       ${online} online`],
      ["out", career ? `[ ok ] rank          ${career.rank.name.toLowerCase()} ${career.rr} rr` : "[ .. ] rank          run 'rank'"],
      ["out", ""],
    ];
  };
  const bootTimers: number[] = [];
  onCleanup(() => bootTimers.forEach((timer) => window.clearTimeout(timer)));
  onMount(() => {
    if (!careerView.value()) void careerView.load();
    // Read when the beat lands, so a career that loads meanwhile still shows.
    for (let step = 0; step < BOOT_STEPS; step += 1) {
      bootTimers.push(
        window.setTimeout(() => {
          const check = bootChecks()[step];
          if (check) print(check[0], check[1]);
        }, BOOT_DELAY_MS + step * BOOT_BEAT_MS),
      );
    }
  });

  const commands: Record<string, (args: string[]) => void> = {
    help: () => print("out", ...HELP),
    clear: () => {
      setHasGreeting(false);
      setLines([]);
    },
    play: () => {
      if (party()?.is_queueing) return print("err", "already searching; 'cancel' to stop");
      if (!play.canStart()) return print("err", "cannot queue right now");
      play.press();
      print("out", play.isOwner() ? `queueing ${play.current()?.label ?? ""}` : "ready toggled");
    },
    cancel: () => {
      if (!party()?.is_queueing) return print("err", "not searching");
      void partyActions.stopQueue();
      print("out", "queue cancelled");
    },
    mode: (args) => {
      const wanted = args.join(" ").toLowerCase();
      if (!wanted) {
        return print("out", ...play.queues().map((queue) => `${queue.id === play.current()?.id ? "*" : " "} ${queue.label.toLowerCase()}`));
      }
      const queue = play.queues().find((option) => option.label.toLowerCase().startsWith(wanted) || option.id === wanted);
      if (!queue) return print("err", `no mode '${wanted}'`);
      if (!play.isOwner()) return print("err", "only the party leader picks the mode");
      play.pickQueue(queue);
      print("out", `mode -> ${queue.label.toLowerCase()}`);
    },
    ready: () => {
      const self = party()?.members.find((member) => member.is_self);
      void partyActions.setReady(!(self?.is_ready ?? false));
      print("out", self?.is_ready ? "not ready" : "ready");
    },
    invite: (args) => {
      const riotId = args.join(" ");
      if (!riotId.includes("#")) return print("err", "usage: invite NAME#TAG");
      void partyActions.invite(riotId);
      printNames(`invite -> ${riotId}`);
    },
    open: () => {
      void partyActions.setOpen(true);
      print("out", "party open");
    },
    close: () => {
      void partyActions.setOpen(false);
      print("out", "party closed");
    },
    friends: () => {
      const online = friends().filter((friend) => friend.status !== "offline");
      if (online.length === 0) return print("out", "nobody online");
      const status = (friend: FriendView) => friend.status.replace("_", " ").padEnd(13);
      const row = (friend: FriendView) =>
        `${friend.game_name.padEnd(16)} ${status(friend)} ${friend.detail} ${partyLabel(friend.party_size)}`;
      printNames(...online.map(row));
    },
    rank: () => {
      const view = careerView.value();
      if (!view) return print("err", careerView.isLoading() ? "loading..." : "no career data");
      print("out", `${view.rank.name.toLowerCase()}  ${view.rr} rr  ${view.wins}w / ${view.games}g`);
    },
    store: () => {
      const view = storeView.value();
      if (!view) {
        void storeView.load();
        return print("err", "loading store, run again");
      }
      print("out", ...view.daily.map((item) => `${item.name.padEnd(28)} ${item.price} vp`));
    },
    cd: (args) => {
      const tab = TABS.find((option) => option.id === args[0]?.toLowerCase());
      if (!tab) return print("err", `no tab '${args[0] ?? ""}'`);
      navigate(`/${tab.id}`);
    },
  };

  const run = (raw: string) => {
    const text = raw.trim();
    // A typed Riot ID (invite NAME#TAG) is echoed back, so that echo hides like any name.
    append([line("in", `$ ${text}`, text.includes("#"))]);
    if (!text) return;
    history.push(text);
    historyIndex = history.length;
    const [name = "", ...args] = text.split(/\s+/);
    const key = name.toLowerCase();
    const command = Object.hasOwn(commands, key) ? commands[key] : undefined;
    if (command) command(args);
    else print("err", `${name}: command not found`);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
      setInput(history[historyIndex] ?? "");
    }
  };

  const statusLine = () => {
    const current = party();
    if (connection().state !== "connected" || !current) return "offline";
    const searching = play.searchClock();
    return [
      `mode=${current.queue.label.toLowerCase()}`,
      `party=${current.members.length}/${current.max_size}`,
      searching ? `searching ${searching}` : "idle",
    ]
      .filter(Boolean)
      .join("  ");
  };

  return (
    <section class={styles.console} onClick={() => field?.focus()}>
      <div class={styles.status}>
        <Show when={connection().state === "connected" && party() ? ownRiotId() : null}>
          {(who) => <span data-sensitive>{`${who().name}#${who().tag}  `}</span>}
        </Show>
        {statusLine()}
      </div>
      <div ref={scroller} class={styles.log}>
        <Show when={hasGreeting()}>
          <div class={styles.line} data-kind="out">
            {greeting()}
          </div>
        </Show>
        <For each={lines()}>
          {(entry) => (
            <div class={styles.line} data-kind={entry.kind} data-sensitive={entry.isSensitive ? "" : undefined}>
              {entry.text || " "}
            </div>
          )}
        </For>
      </div>
      <form
        class={styles.prompt}
        onSubmit={(event) => {
          event.preventDefault();
          run(input());
          setInput("");
        }}
      >
        <span>$</span>
        <input
          ref={field}
          value={input()}
          spellcheck={false}
          autocomplete="off"
          aria-label="Command"
          onInput={(event) => setInput(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
      </form>
    </section>
  );
}
