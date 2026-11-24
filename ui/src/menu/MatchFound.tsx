// The match-found moment, drawn the way the chosen style's game draws it: CS:GO's "match is
// ready" box with ten accept squares, CS2's band with filling bars, a slanted banner for the
// VALORANT styles, a VGUI dialog for CS 1.6, typed lines for the terminal, a ransom-note card
// for Phantom and a glitching breach readout for Night City.
// It plays over agent select for a moment and never takes clicks; Modern has none.
import { Index, Match, Show, Switch, createEffect, createSignal, on, onCleanup } from "solid-js";
import { playCue } from "./sound";
import { pregame } from "~/state/pregame";
import { game } from "~/state/session";
import { doc } from "~/studio/store";
import { RansomText } from "~/pieces/styled/phantom";
import styles from "./MatchFound.module.css";
import poster from "./MatchFoundPoster.module.css";

const SPLASH_MS = 2600;
const PLAYERS = 10;

export function MatchFound() {
  const [isVisible, setVisible] = createSignal(false);
  let timer = 0;
  onCleanup(() => window.clearTimeout(timer));
  const skin = () => doc.theme.skin;

  createEffect(
    on(
      () => game()?.phase,
      (phase, previous) => {
        if (phase !== "pregame" || previous === "pregame") return;
        playCue("found");
        if (skin() === "modern") return;
        setVisible(true);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => setVisible(false), SPLASH_MS);
      },
      { defer: true },
    ),
  );

  const map = () => pregame()?.map_name ?? "";
  const queue = () => pregame()?.queue_label ?? "";
  const squares = (className: string | undefined) => (
    <Index each={Array.from({ length: PLAYERS })}>{(_, index) => <i class={className} style={{ "--i": index }} />}</Index>
  );

  return (
    <Show when={isVisible()}>
      <div class={styles.layer} data-skin={skin()} aria-live="polite">
        <Switch>
          <Match when={skin() === "csgo"}>
            <div class={styles.csgoBox}>
              <span class={styles.csgoTitle}>Your match is ready!</span>
              <span class={styles.csgoSquares}>{squares(styles.csgoSquare)}</span>
              <span class={styles.csgoAccept}>Accepted</span>
              <span class={styles.csgoInfo}>{[queue(), map()].filter(Boolean).join(" · ")}</span>
            </div>
          </Match>
          <Match when={skin() === "cs2"}>
            <div class={styles.cs2Band}>
              <span class={styles.cs2Title}>Match found</span>
              <span class={styles.cs2Bars}>{squares(styles.cs2Bar)}</span>
              <span class={styles.cs2Info}>{[queue(), map()].filter(Boolean).join(" · ")}</span>
            </div>
          </Match>
          <Match when={skin() === "beta" || skin() === "valnow" || skin() === "current"}>
            <div class={styles.betaBanner} data-tone={skin() === "beta" ? undefined : "red"}>
              <span class={styles.betaCode}>// MATCHMAKING · 01</span>
              <span class={styles.betaTitle}>Match found</span>
              <span class={styles.betaMap}>{map() || queue()}</span>
            </div>
          </Match>
          <Match when={skin() === "cs16"}>
            <div class={styles.vgui}>
              <span class={styles.vguiTitle}>Match found</span>
              <span>{[queue(), map()].filter(Boolean).join(" - ") || "Connecting to server..."}</span>
              <span class={styles.vguiBar}>{squares(styles.vguiCell)}</span>
            </div>
          </Match>
          <Match when={skin() === "fortnite"}>
            <div class={styles.fnBanner}>
              <span class={styles.fnTitle}>Match found</span>
              <span class={styles.fnInfo}>{[queue(), map()].filter(Boolean).join(" · ")}</span>
            </div>
          </Match>
          <Match when={skin() === "minecraft"}>
            <div class={styles.mcScreen}>
              <span>Match found</span>
              <span class={styles.mcSub}>Building terrain</span>
              <span class={styles.mcBar}>
                <i />
              </span>
            </div>
          </Match>
          <Match when={skin() === "halo"}>
            <div class={styles.haloPanel}>
              <span class={styles.haloTitle}>Match found</span>
              <span>{[queue(), map()].filter(Boolean).join(" · ") || "Game starting"}</span>
              <span class={styles.haloBar}>
                <i />
              </span>
            </div>
          </Match>
          <Match when={skin() === "pipboy"}>
            <pre class={styles.term} data-pip="">
              {`* MATCH FOUND *\n\nMODE ..... ${queue().toUpperCase() || "UNKNOWN"}\nLOCATION . ${map().toUpperCase() || "UNKNOWN"}\n\nPREPARING AGENT SELECT`}
            </pre>
          </Match>
          <Match when={skin() === "phantom"}>
            <div class={poster.phantom}>
              <RansomText text="MATCH FOUND" class={poster.phantomTitle} />
              <span class={poster.phantomInfo}>{[queue(), map()].filter(Boolean).join(" · ") || "Take your mark"}</span>
            </div>
          </Match>
          <Match when={skin() === "nightcity"}>
            <div class={poster.nightcity}>
              <span class={poster.ncCode}>BREACH PROTOCOL // COMPLETE</span>
              <span class={poster.ncTitle} data-text="Match found">
                Match found
              </span>
              <span class={poster.ncInfo}>{[queue(), map()].filter(Boolean).join(" // ") || "Jacking in"}</span>
              <span class={poster.ncBar}>
                <i />
              </span>
            </div>
          </Match>
          <Match when={skin() === "terminal"}>
            <pre class={styles.term}>
              {`> match found\n> mode: ${queue().toLowerCase() || "unknown"}\n> map:  ${map().toLowerCase() || "unknown"}\n> loading agent select...`}
            </pre>
          </Match>
        </Switch>
      </div>
    </Show>
  );
}
