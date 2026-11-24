// Pip-Boy pieces, after the wrist computer's STAT screen: the figure in the middle with a
// condition bar for each party slot around it (head, arms, legs), a row of readouts under it,
// the action hints and the HP / LEVEL / AP status bar along the bottom. The figure is your
// agent, drawn in phosphor green.
import { Index, Show, createMemo, onCleanup, onMount } from "solid-js";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { isTyping } from "~/menu/typing";
import { catalog } from "~/state/catalog";
import { setDrawerOpen } from "~/state/friends";
import { party } from "~/state/party";
import { connection } from "~/state/session";
import { careerView } from "~/state/views";
import { wallet } from "~/state/wallet";
import { usePlay } from "./usePlay";
import styles from "./pipboy.module.css";

/** Where each party slot's bar sits around the figure, in the order the client lists them. */
const LIMBS = ["head", "armL", "armR", "legL", "legR"] as const;

function str(props: PieceProps, key: string, fallback: string): string {
  const value = props.piece.props[key];
  return typeof value === "string" && value ? value : fallback;
}

function LimbBar(props: { member: MemberView | undefined; limb: string }) {
  const fill = () => (props.member ? (props.member.is_ready ? 1 : 0.4) : 0);
  return (
    <div class={styles.limb} data-limb={props.limb} data-empty={props.member ? undefined : ""}>
      <span class={styles.limbName} data-sensitive>
        {props.member?.game_name ?? "- - -"}
      </span>
      <span class={styles.limbBar}>
        <i style={{ width: `${fill() * 100}%` }} />
      </span>
    </div>
  );
}

export function PipStat(props: PieceProps) {
  const members = () => party()?.members ?? [];
  const self = () => members().find((member) => member.is_self);
  const agent = createMemo(() => {
    const wanted = str(props, "agent", "JETT").toUpperCase();
    const agents = catalog().agents;
    return agents.find((entry) => entry.upper_name === wanted) ?? agents[0];
  });
  return (
    <div class={styles.stat}>
      <div class={styles.subTabs} aria-hidden="true">
        <span data-on="">STATUS</span>
        <span>SPECIAL</span>
        <span>PERKS</span>
      </div>
      <div class={styles.figure}>
        <Show when={agent()?.portrait}>
          {(src) => <img class={styles.figureArt} src={src()} alt="" draggable={false} />}
        </Show>
        <Index each={LIMBS}>{(limb, index) => <LimbBar member={members()[index]} limb={limb()} />}</Index>
      </div>
      <div class={styles.readouts}>
        <span class={styles.readout}>
          <Show when={self()?.rank.icon}>{(icon) => <img src={icon()} alt="" draggable={false} />}</Show>
          <b>{self()?.rank.name ?? "UNRANKED"}</b>
        </span>
        <span class={styles.readout}>
          <b>
            {members().length}/{party()?.max_size ?? 5}
          </b>
          <small>PARTY</small>
        </span>
        <span class={styles.readout}>
          <b>{self()?.ping_ms ?? "--"}</b>
          <small>MS</small>
        </span>
      </div>
      <p class={styles.caption} data-sensitive>
        {self()?.game_name ?? "VAULT DWELLER"} - LEVEL {self()?.account_level ?? 1}
      </p>
    </div>
  );
}

/** Key hints along the bottom: each one is also the button it names. */
export function PipHints(_props: PieceProps) {
  const play = usePlay();
  const cycleQueue = () => {
    const queues = play.queues();
    const index = queues.findIndex((queue) => queue.id === play.current()?.id);
    const next = queues[(index + 1) % Math.max(1, queues.length)];
    if (next) play.pickQueue(next);
  };
  const playLabel = () => {
    if (play.searchClock() !== null) return `CANCEL SEARCH ${play.searchClock()}`;
    if (play.penaltyClock()) return `RESTRICTED ${play.penaltyClock()}`;
    if (!play.isOwner()) return play.isReady() ? "NOT READY" : "READY";
    return play.isCustom() ? "START GAME" : "FIND MATCH";
  };
  const hints = () => [
    {
      key: "ENTER",
      label: playLabel(),
      run: () => play.press(),
      isOff: !play.canStart() && play.searchClock() === null,
    },
    {
      key: "M",
      label: `MODE: ${(play.current()?.label ?? "-").toUpperCase()}`,
      run: cycleQueue,
      isOff: !play.isOwner(),
    },
    { key: "F", label: "FRIENDS", run: () => setDrawerOpen(true), isOff: false },
  ];
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      // A focused button already answers Enter itself.
      if (
        isTyping(event.target) ||
        event.target instanceof HTMLButtonElement ||
        event.repeat ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key === "Enter") play.press();
      else if (event.key === "m" || event.key === "M") cycleQueue();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  return (
    <div class={styles.hints}>
      {/* Index, not For: the hints are rebuilt every second of a search, and For would remount the
          buttons and drop focus. */}
      <Index each={hints()}>
        {(hint) => (
          <button
            class={styles.hint}
            disabled={hint().isOff}
            onMouseEnter={() => playCue("hover")}
            onClick={() => {
              playCue("confirm");
              hint().run();
            }}
          >
            <kbd>{hint().key})</kbd> {hint().label}
          </button>
        )}
      </Index>
    </div>
  );
}

/** HP / LEVEL / AP, read as RR, account level and VP. */
export function PipBar(_props: PieceProps) {
  onMount(() => {
    if (!careerView.value()) void careerView.load();
  });
  const self = () => party()?.members.find((member) => member.is_self);
  const rr = () => careerView.value()?.rr ?? 0;
  const isOnline = () => connection().state === "connected";
  return (
    <div class={styles.bar}>
      <span class={styles.barCell}>
        RR <b class="num">{rr()}/100</b>
      </span>
      <span class={`${styles.barCell} ${styles.barLevel}`}>
        LEVEL <b class="num">{self()?.account_level ?? 1}</b>
        <span class={styles.levelTrack}>
          <i style={{ width: `${rr()}%` }} />
        </span>
      </span>
      <span class={styles.barCell}>
        VP <b class="num">{wallet()?.valorant_points.toLocaleString() ?? "-"}</b>
      </span>
      <span class={styles.barCell} data-off={isOnline() ? undefined : ""}>
        {isOnline() ? "SIGNAL OK" : "NO SIGNAL"}
      </span>
    </div>
  );
}
