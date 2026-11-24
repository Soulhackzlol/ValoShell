// Phantom pieces, after Persona 5's menus: the main menu as huge slanted words stacked down the
// right (each a cut-out on black; the one under the pointer flips to white over a red slash),
// and the party as a calling card with a ransom-note title. PLAY is the first word.
import { Index, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import type { MemberView } from "~/bindings/MemberView";
import { TABS } from "~/menu/scenes";
import { playCue } from "~/menu/sound";
import { setDrawerOpen } from "~/state/friends";
import { party } from "~/state/party";
import { tabLabel } from "~/studio/skins";
import { doc } from "~/studio/store";
import type { PieceProps } from "~/studio/registry";
import { type PlayState, usePlay } from "./usePlay";
import styles from "./phantom.module.css";

/** Ransom-note letters cycle these looks; the tilt pattern repeats every TILTS letters. */
const LETTER_SHADES = 3;
const TILTS = [-6, 4, -2, 7, -4, 2, -7];
/** Menu words lean alternately, like cut-outs pasted down by hand. */
const WORD_TILTS = [-4, 2, -2, 3, -3, 1];

function playWord(play: PlayState): string {
  if (play.searchClock() !== null) return `Cancel ${play.searchClock()}`;
  if (play.penaltyClock()) return `Locked ${play.penaltyClock()}`;
  if (!play.isOwner()) return play.isReady() ? "Not ready" : "Ready";
  return "Play";
}

interface Scrap {
  letter: string;
  /** Position in the whole text, so shades and tilts run on across words. */
  index: number;
}

/** The text as words of scraps; spaces only separate words. */
function scrapWords(text: string): Scrap[][] {
  let index = 0;
  return text
    .split(" ")
    .filter((word) => word.length > 0)
    .map((word) => [...word].map((letter) => ({ letter, index: index++ })));
}

/**
 * Each letter on its own scrap: black, white or red paper, tilted a little. A word never breaks
 * across lines, and the scraps shrink so the longest word fits the room (`--ransom-room`, the
 * width of the nearest container by default).
 */
export function RansomText(props: { text: string; class?: string | undefined }) {
  const words = () => scrapWords(props.text);
  const longest = () => Math.max(1, ...words().map((word) => word.length));
  return (
    <span class={`${styles.ransom} ${props.class ?? ""}`} aria-label={props.text} style={{ "--longest": longest() }}>
      <span class={styles.ransomFit}>
        <Index each={words()}>
          {(word) => (
            <span class={styles.ransomWord}>
              <Index each={word()}>
                {(scrap) => (
                  <span
                    class={styles.scrap}
                    aria-hidden="true"
                    data-shade={String(scrap().index % LETTER_SHADES)}
                    style={{ rotate: `${TILTS[scrap().index % TILTS.length] ?? 0}deg` }}
                  >
                    {scrap().letter}
                  </span>
                )}
              </Index>
            </span>
          )}
        </Index>
      </span>
    </span>
  );
}

interface MenuWord {
  id: string;
  label: string;
  isOff: boolean;
  run: () => void;
}

function MenuItem(props: { word: MenuWord; index: number; isHot: boolean }) {
  return (
    <button
      class={styles.word}
      data-part={props.isHot ? "play" : undefined}
      data-hot={props.isHot ? "" : undefined}
      disabled={props.word.isOff}
      style={{ "--i": props.index, rotate: `${WORD_TILTS[props.index % WORD_TILTS.length] ?? 0}deg` }}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.word.run()}
    >
      <span class={styles.wordText}>{props.word.label}</span>
    </button>
  );
}

/** PLAY, then every other screen, as the big slanted menu. */
export function PhMenu(_props: PieceProps) {
  const play = usePlay();
  const navigate = useNavigate();
  const go = (id: string) => {
    playCue("tab");
    navigate(`/${id}`);
  };
  const words = (): MenuWord[] => [
    {
      id: "play",
      label: playWord(play),
      isOff: play.searchClock() === null && !play.canStart(),
      run: () => play.press(),
    },
    ...TABS.filter((tab) => tab.id !== "home").map((tab) => ({
      id: tab.id,
      label: tabLabel(doc.theme.skin, tab.id, tab.label),
      isOff: false,
      run: () => go(tab.id),
    })),
  ];
  return (
    <nav class={styles.menu} aria-label="Main menu" data-searching={play.searchClock() !== null ? "" : undefined}>
      {/* Index, not For: the words are rebuilt every second of a search (the clock), and For would
          remount each button, replaying the menu's entrance and dropping focus. */}
      <Index each={words()}>
        {(word, index) => <MenuItem word={word()} index={index} isHot={word().id === "play"} />}
      </Index>
    </nav>
  );
}

function MemberLine(props: { member: MemberView | undefined; index: number }) {
  return (
    <li class={styles.member} data-empty={props.member ? undefined : ""} style={{ "--i": props.index }}>
      <Show
        when={props.member}
        fallback={
          <button class={styles.invite} onClick={() => setDrawerOpen(true)}>
            + Recruit
          </button>
        }
      >
        {(member) => (
          <>
            <Show when={member().rank.icon}>
              {(icon) => <img class={styles.rank} src={icon()} alt="" draggable={false} />}
            </Show>
            <span class={styles.memberName} data-sensitive>
              {member().game_name}
            </span>
            <span class={styles.stamp} data-ready={member().is_ready ? "" : undefined}>
              {member().is_ready ? "Ready" : "Not ready"}
            </span>
          </>
        )}
      </Show>
    </li>
  );
}

/** The party as a calling card: the mode as the target, one line per slot, the crew's size. */
export function PhCard(_props: PieceProps) {
  const play = usePlay();
  const members = () => party()?.members ?? [];
  const slots = () => Array.from({ length: play.maxSize() }, (_, index) => members()[index]);
  return (
    <article class={styles.card}>
      <header class={styles.cardHead}>
        <span class={styles.cardTag}>Calling card</span>
        <RansomText text={(play.current()?.label ?? "Offline").toUpperCase()} class={styles.cardTitle} />
      </header>
      <ol class={styles.members}>
        {/* Index: slots are places, so a party update (a new member object) refreshes a row in place
          instead of remounting it and replaying its entrance. */}
        <Index each={slots()}>{(member, index) => <MemberLine member={member()} index={index} />}</Index>
      </ol>
      <footer class={styles.cardFoot}>
        <span>
          Crew <b class="num">{play.partySize()}</b>/{play.maxSize()}
        </span>
        <span class={styles.signature}>— The Phantoms</span>
      </footer>
    </article>
  );
}
