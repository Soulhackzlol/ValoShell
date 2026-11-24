// The Counter-Strike styles' own Modes, Rank and Profile. CS:GO and CS 1.6 reuse their panels'
// own classes (Panorama's grey box and radio rows, VGUI's olive window and list), so a mode
// picker looks like the play panel it sits beside. CS2 gets its Play menu's mode cards and the
// top-right player plate.
import { For, Index, Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { Window, onActivate, titleOf } from "./classic";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { usePlay } from "./usePlay";
import classic from "./classic.module.css";
import csgo from "./csgo.module.css";
import styles from "./csHome.module.css";

export function CsgoModes(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={csgo.box}>
      <header class={csgo.titleBar}>
        <span>Game mode</span>
        <span class={csgo.titleMode}>{play.current()?.label ?? "—"}</span>
      </header>
      <ul class={csgo.modeList} role="radiogroup">
        <For each={play.queues()}>
          {(queue) => (
            <li>
              <button
                role="radio"
                aria-checked={play.current()?.id === queue.id}
                class={csgo.modeRow}
                data-active={play.current()?.id === queue.id ? "" : undefined}
                disabled={!play.isOwner()}
                onMouseEnter={() => playCue("hover")}
                onClick={() => play.pickQueue(queue)}
              >
                <span class={csgo.check} />
                {queue.label}
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

export function Cs2Modes(_props: PieceProps) {
  const play = usePlay();
  return (
    <section class={styles.cs2Modes}>
      <span class={styles.cs2Heading}>Matchmaking</span>
      <div class={styles.cs2Cards}>
        <Index each={play.queues()}>
          {(queue) => (
            <button
              class={styles.cs2Card}
              data-active={play.current()?.id === queue().id ? "" : undefined}
              disabled={!play.isOwner()}
              onMouseEnter={() => playCue("hover")}
              onClick={() => play.pickQueue(queue())}
            >
              <Art src={queue().art} class={styles.cs2Art} fallback={<span class={styles.cs2Art} />} />
              <span class={styles.cs2Name}>{queue().label}</span>
            </button>
          )}
        </Index>
      </div>
    </section>
  );
}

export function Cs2Profile(_props: PieceProps) {
  const profile = useProfile();
  return (
    <section class={styles.cs2Plate}>
      <div class={styles.cs2Who}>
        <b data-sensitive>{profile.name()}</b>
        <span>Level {profile.level()}</span>
      </div>
      <Art src={profile.member()?.card_small} class={styles.cs2Avatar} fallback={<span class={styles.cs2Avatar} />} />
    </section>
  );
}

export function Cs16Modes(props: PieceProps) {
  const play = usePlay();
  return (
    <Window
      title={titleOf(props, "Game Type")}
      footer={<span class={classic.status}>{play.current()?.label ?? "No mode"}</span>}
    >
      <ul class={classic.list} role="listbox">
        <For each={play.queues()}>
          {(queue) => (
            <li
              role="option"
              tabIndex={0}
              aria-selected={play.current()?.id === queue.id}
              aria-disabled={!play.isOwner()}
              class={classic.listRow}
              data-active={play.current()?.id === queue.id ? "" : undefined}
              onClick={() => play.pickQueue(queue)}
              onKeyDown={(event) => onActivate(event, () => play.pickQueue(queue))}
            >
              {queue.label}
            </li>
          )}
        </For>
      </ul>
    </Window>
  );
}

export function Cs16Rank(props: PieceProps) {
  const view = useRank();
  const status = () => {
    const career = view();
    return career ? rrText(career) : rankPending();
  };
  return (
    <Window title={titleOf(props, "Stats")} footer={<span class={classic.status}>{status()}</span>}>
      <Show when={view()}>
        {(career) => (
          <div class={styles.cs16Row}>
            <span class={styles.cs16Box}>
              <Art src={career().rank.icon} class={styles.cs16Image} fallback={<span />} />
            </span>
            <div class={styles.cs16Lines}>
              <span class={classic.label}>Rank: {rankLabel(career())}</span>
              <span class={classic.label}>
                Record: {career().wins} / {career().games}
              </span>
              <span class={styles.cs16Bar} style={{ "--progress": rankProgress(career()) }} />
            </div>
          </div>
        )}
      </Show>
    </Window>
  );
}

export function Cs16Profile(props: PieceProps) {
  const profile = useProfile();
  return (
    <Window title={titleOf(props, "Player")} footer={<span class={classic.status}>Level {profile.level()}</span>}>
      <div class={styles.cs16Row}>
        <span class={styles.cs16Box}>
          <Art src={profile.member()?.card_small} class={styles.cs16Image} fallback={<span />} />
        </span>
        <div class={styles.cs16Lines}>
          <span class={classic.label} data-sensitive>
            Name: {profile.name()}
          </span>
          <Show when={profile.member()?.title}>{(title) => <span class={classic.label}>Title: {title()}</span>}</Show>
        </div>
      </div>
    </Window>
  );
}
