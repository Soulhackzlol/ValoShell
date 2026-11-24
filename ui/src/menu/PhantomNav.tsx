// Phantom nav: the tabs as cut-out blocks on a black strip, each leaning its own way; the open
// one is a bigger red block that pops above the others. Wallet and system buttons on the right.
import { For, Show } from "solid-js";
import { LIVE_TAB, StatusLight, SystemButtons, TabLink, Wallet, isLive, label } from "./navParts";
import { TABS } from "./scenes";
import styles from "./PhantomNav.module.css";

/** Blocks lean alternately, like the menu words on Home. */
const TAB_TILTS = [-3, 2, -1, 3, -2, 1];

export function PhantomNav() {
  return (
    <header class={styles.nav} data-part="nav">
      <span class={styles.mark} aria-hidden="true">
        ✦
      </span>
      <StatusLight />
      <nav class={styles.tabs} aria-label="Menu">
        <For each={TABS}>
          {(tab, index) => (
            <span class={styles.slot} style={{ rotate: `${TAB_TILTS[index() % TAB_TILTS.length] ?? 0}deg` }}>
              <TabLink tab={tab} class={styles.tab} activeClass={styles.active}>
                {label(tab)}
              </TabLink>
            </span>
          )}
        </For>
        <Show when={isLive()}>
          <span class={styles.slot}>
            <TabLink tab={LIVE_TAB} class={`${styles.tab} ${styles.live}`} activeClass={styles.active}>
              Live
            </TabLink>
          </span>
        </Show>
      </nav>
      <div class={styles.side}>
        <Wallet />
        <SystemButtons />
      </div>
    </header>
  );
}
