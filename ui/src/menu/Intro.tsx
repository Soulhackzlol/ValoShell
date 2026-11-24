// The style's own launch intro, over the menu for a couple of seconds: a VALORANT slash
// reveal, the CS 1.6 VGUI loading box, a BIOS boot for the terminal, Minecraft's red studio
// splash, Halo's ring sweep... Any key or click skips it. Plays once per launch (and from the
// Studio's "Replay intro"); never with reduced motion.
import { For, Match, Show, Switch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { playCue } from "~/menu/sound";
import { doc } from "~/studio/store";
import { isMotionReduced } from "~/studio/spring";
import { setIntroPlaying } from "~/ui/modal";
import { ValLogo } from "~/pieces/styled/valIcons";
import styles from "./Intro.module.css";

/** How long each style's intro holds before fading out. */
const HOLD_MS: Record<string, number> = { terminal: 2600, cs16: 2600, minecraft: 2600, pipboy: 2600 };
const DEFAULT_HOLD_MS = 2300;
const FADE_MS = 450;

const [run, setRun] = createSignal(0);
let hasPlayedThisLaunch = false;

/** Play the current style's intro now (the Studio's preview button). */
export function replayIntro(): void {
  setRun((count) => count + 1);
}

const BOOT_LINES = [
  "VALOSHELL BIOS v4.20  (C) 2026",
  "CPU: RIOT-CLIENT @ 128 TICK ............ OK",
  "Memory test: 65536K ..................... OK",
  "Mounting /dev/valorant .................. OK",
  "Loading agents [##########] 28/28",
  "Linking party service ................... OK",
  "Stream delay link ....................... ready",
  "> Starting menu_",
];

/** The wrist unit's boot, in its own words. */
const PIP_LINES = [
  "*************** PIP-OS(R) V7.1.0.8 ***************",
  "",
  "COPYRIGHT 2075 ROBCO(R)",
  "LOADER V1.1",
  "EXEC VERSION 41.10",
  "64K RAM SYSTEM",
  "38911 BYTES FREE",
  "NO HOLOTAPE FOUND",
  "LOAD ROM(1): DEITRIX 303",
  "> LINKING RIOT CLIENT...",
];

function Title(props: { class: string | undefined }) {
  return <span class={props.class}>VALOSHELL</span>;
}

function SkinIntro(props: { skin: string }) {
  return (
    <Switch
      fallback={
        <div class={styles.valorant}>
          <span class={styles.slashA} />
          <span class={styles.slashB} />
          <Title class={styles.valorantTitle} />
          <span class={styles.valorantSub}>Your menu. Your rules.</span>
        </div>
      }
    >
      <Match when={props.skin === "beta"}>
        <div class={styles.beta}>
          <span class={styles.betaLineH} />
          <span class={styles.betaLineV} />
          <span class={styles.betaTag}>PROJECT A · CLOSED BETA</span>
          <Title class={styles.betaTitle} />
        </div>
      </Match>
      <Match when={props.skin === "csgo" || props.skin === "cs2"}>
        <div class={styles.counter} data-cs2={props.skin === "cs2" ? "" : undefined}>
          <span class={styles.counterSweep} />
          <Title class={styles.counterTitle} />
          <span class={styles.counterBar}>
            <span />
          </span>
          <span class={styles.counterSub}>{props.skin === "cs2" ? "Initializing" : "Loading Panorama"}</span>
        </div>
      </Match>
      <Match when={props.skin === "cs16"}>
        <div class={styles.vgui}>
          <div class={styles.vguiBox}>
            <div class={styles.vguiTitle}>Loading…</div>
            <div class={styles.vguiBody}>
              <span>Verifying game resources</span>
              <div class={styles.vguiBar}>
                <For each={Array.from({ length: 24 })}>{(_, index) => <span style={{ "--i": index() }} />}</For>
              </div>
            </div>
          </div>
        </div>
      </Match>
      <Match when={props.skin === "terminal"}>
        <div class={styles.boot}>
          <For each={BOOT_LINES}>{(line, index) => <span style={{ "--i": index() }}>{line}</span>}</For>
        </div>
      </Match>
      <Match when={props.skin === "pipboy"}>
        <div class={styles.boot} data-pip="">
          <For each={PIP_LINES}>{(line, index) => <span style={{ "--i": index() }}>{line}</span>}</For>
        </div>
      </Match>
      <Match when={props.skin === "fortnite"}>
        <div class={styles.fortnite}>
          <span class={styles.fnRays} />
          <Title class={styles.fnTitle} />
          <span class={styles.fnSub}>DROPPING IN…</span>
        </div>
      </Match>
      <Match when={props.skin === "minecraft"}>
        <div class={styles.mojang}>
          <Title class={styles.mojangTitle} />
          <span class={styles.mojangStudio}>STUDIOS</span>
          <span class={styles.mojangBar}>
            <span />
          </span>
        </div>
      </Match>
      <Match when={props.skin === "halo"}>
        <div class={styles.halo}>
          <span class={styles.haloRing} />
          <Title class={styles.haloTitle} />
          <span class={styles.haloSub}>Finish the fight.</span>
        </div>
      </Match>
      <Match when={props.skin === "current"}>
        {/* The client itself: no product name, just the red wipe and the V mark. */}
        <div class={styles.valnow}>
          <span class={styles.valnowBar} />
          <ValLogo size={180} class={styles.currentMark} />
        </div>
      </Match>
      <Match when={props.skin === "valnow"}>
        <div class={styles.valnow}>
          <span class={styles.valnowBar} />
          <Title class={styles.valnowTitle} />
        </div>
      </Match>
    </Switch>
  );
}

export function Intro() {
  const [phase, setPhase] = createSignal<"off" | "on" | "out">("off");
  // Dialogs leave keys alone while the intro takes them (ui/modal.ts).
  createEffect(() => setIntroPlaying(phase() === "on"));
  onCleanup(() => setIntroPlaying(false));
  const [key, setKey] = createSignal(0);
  let holdTimer = 0;
  let fadeTimer = 0;

  const finish = () => {
    if (phase() !== "on") return;
    window.clearTimeout(holdTimer);
    setPhase("out");
    fadeTimer = window.setTimeout(() => setPhase("off"), FADE_MS);
  };

  const start = () => {
    if (isMotionReduced()) return;
    window.clearTimeout(holdTimer);
    window.clearTimeout(fadeTimer);
    setKey((value) => value + 1);
    setPhase("on");
    playCue("found");
    holdTimer = window.setTimeout(finish, HOLD_MS[doc.theme.skin] ?? DEFAULT_HOLD_MS);
  };

  onMount(() => {
    if (!hasPlayedThisLaunch && doc.theme.fx.isIntroOn) {
      hasPlayedThisLaunch = true;
      start();
    }
  });
  // Replays requested from the Studio; deferred, so mounting is not one.
  createEffect(on(run, start, { defer: true }));

  const skip = (event: Event) => {
    if (phase() !== "on") return;
    event.preventDefault();
    event.stopPropagation();
    finish();
  };
  onMount(() => window.addEventListener("keydown", skip, true));
  onCleanup(() => {
    window.removeEventListener("keydown", skip, true);
    window.clearTimeout(holdTimer);
    window.clearTimeout(fadeTimer);
  });

  return (
    <Show when={phase() !== "off"}>
      <div class={styles.intro} data-skin-intro={doc.theme.skin} data-out={phase() === "out" ? "" : undefined} onPointerDown={skip}>
        <Show when={key()} keyed>
          <SkinIntro skin={doc.theme.skin} />
        </Show>
        <span class={styles.skipHint}>Press any key to skip</span>
      </div>
    </Show>
  );
}
