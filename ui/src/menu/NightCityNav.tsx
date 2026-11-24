// Night City nav: a HUD strip with a numbered tab per screen ("01 HOME"), chamfered like the
// panels; the open tab fills yellow, the others glow cyan on hover. Uplink light, wallet and
// system buttons on the right.
import { For, Show } from "solid-js";
import { LIVE_TAB, StatusLight, SystemButtons, TabLink, Wallet, isLive, label } from "./navParts";
import { TABS } from "./scenes";
import styles from "./NightCityNav.module.css";

export function NightCityNav() {
  return (
    <header class={styles.nav} data-part="nav">
      <span class={styles.brand}>
        NC<b>//</b>
      </span>
      <nav class={styles.tabs} aria-label="Menu">
        <For each={TABS}>
          {(tab, index) => (
            <TabLink tab={tab} class={styles.tab} activeClass={styles.active}>
              <span class={styles.index}>{String(index() + 1).padStart(2, "0")}</span>
              {label(tab)}
            </TabLink>
          )}
        </For>
        <Show when={isLive()}>
          <TabLink tab={LIVE_TAB} class={`${styles.tab} ${styles.live}`} activeClass={styles.active}>
            <span class={styles.index}>!!</span>
            Live
          </TabLink>
        </Show>
      </nav>
      <div class={styles.side}>
        <StatusLight />
        <Wallet />
        <SystemButtons />
      </div>
    </header>
  );
}
