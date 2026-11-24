// The welcome tour dialog: one step at a time with dots, Back / Next, and Skip. Esc skips, the
// arrow keys page. It sits under the style's intro (lower z-index, and it leaves keys to the
// intro while it plays), so on a first run the intro plays and then reveals it. The app behind
// is inert while it is open. Skins restyle it through the data-part hooks.
import { For, Show, createEffect, createSignal, on } from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { ArrowLeft, ArrowRight, Check } from "lucide-solid";
import type { Settings } from "~/bindings/Settings";
import { closeTour, isTourOpen } from "~/state/onboarding";
import { stepAfter } from "~/state/onboardingRules";
import { settings } from "~/state/settings";
import { controls } from "~/ui/controls";
import { useInertBackground, useModalKeys } from "~/ui/modal";
import { playCue } from "../sound";
import { isTyping } from "../typing";
import { TOUR_STEPS } from "./tourSteps";
import styles from "./welcomeTour.module.css";

const PAGE_KEYS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

function Dots(props: { index: number; onPick: (index: number) => void }) {
  return (
    <ol class={styles.dots} aria-label="Steps">
      <For each={TOUR_STEPS}>
        {(step, index) => (
          <li>
            <button aria-label={`Step ${index() + 1}: ${step.title}`} aria-current={index() === props.index ? "step" : undefined} onClick={() => props.onPick(index())} />
          </li>
        )}
      </For>
    </ol>
  );
}

function TourFooter(props: { index: number; onGo: (delta: number) => void; onPick: (index: number) => void; onFinish: () => void }) {
  const isLast = () => props.index === TOUR_STEPS.length - 1;
  return (
    <footer class={styles.foot}>
      <Dots index={props.index} onPick={props.onPick} />
      <div class={styles.actions}>
        <Show when={props.index > 0}>
          <button class={`${controls.button} ${controls.ghost}`} onClick={() => props.onGo(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
        </Show>
        <Show
          when={isLast()}
          fallback={
            <button class={controls.button} onClick={() => props.onGo(1)}>
              Next <ArrowRight size={15} />
            </button>
          }
        >
          <button class={controls.button} onClick={() => props.onFinish()}>
            <Check size={15} /> Start playing
          </button>
        </Show>
      </div>
    </footer>
  );
}

type DialogProps = { now: Settings; index: number; onGo: (delta: number) => void; onPick: (index: number) => void };

function TourDialog(props: DialogProps) {
  let heading: HTMLHeadingElement | undefined;
  const step = () => TOUR_STEPS[props.index] ?? TOUR_STEPS[0]!;
  // On opening and on each step, focus moves to the step's title (read first by screen readers).
  createEffect(on(() => props.index, () => queueMicrotask(() => heading?.focus())));
  const finish = () => {
    playCue("confirm");
    closeTour();
  };
  return (
    <section class={styles.tour} data-part="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <header class={styles.head}>
        <span class="overline">
          {props.index + 1} / {TOUR_STEPS.length}
        </span>
        <button class={styles.skip} onClick={() => closeTour()}>
          Skip tour
        </button>
      </header>
      <div class={styles.body} data-part="tour-step" data-step={step().id}>
        <h2 id="tour-title" ref={heading} tabIndex={-1}>
          {step().title}
        </h2>
        <p class={styles.lead}>{step().lead}</p>
        {/* Recreated only when the step changes; a settings change updates it in place. */}
        <Dynamic component={step().body} now={props.now} />
      </div>
      <TourFooter index={props.index} onGo={props.onGo} onPick={props.onPick} onFinish={finish} />
    </section>
  );
}

export function WelcomeTour() {
  const [index, setIndex] = createSignal(0);
  // Without settings nothing shows, so nothing may hold the keyboard either.
  const isShown = () => isTourOpen() && settings() !== null;
  const go = (delta: number) => {
    playCue("tab");
    setIndex(stepAfter(index(), delta, TOUR_STEPS.length));
  };
  createEffect(on(isTourOpen, (isOpen) => isOpen && setIndex(0)));
  useInertBackground(isShown);
  // Arrows page, except where they already mean something (sliders, text).
  useModalKeys(isShown, closeTour, (event) => {
    const delta = PAGE_KEYS[event.key];
    if (delta !== undefined && !isTyping(event.target)) go(delta);
  });
  return (
    <Show when={isShown() && settings()}>
      {(now) => (
        <Portal>
          <div class={styles.scrim} data-part="tour-scrim" />
          <TourDialog now={now()} index={index()} onGo={go} onPick={setIndex} />
        </Portal>
      )}
    </Show>
  );
}
