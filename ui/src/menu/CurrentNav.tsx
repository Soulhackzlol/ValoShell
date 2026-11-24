// The current VALORANT client's top bar: the slanted PLAY block (white on the play screen, red
// elsewhere), a row of icon tabs with hover captions, the mail / currency / settings cluster,
// and the social panel down the right edge. Q/E cycling and Esc stay with TopNav.
import { For, Show, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { ValSocial } from "~/pieces/styled/currentSocial";
import { ValLogo } from "~/pieces/styled/valIcons";
import { NavAgents, NavCareer, NavCollection, NavEvent, NavGear, NavKc, NavMail, NavPass, NavPremier, NavRp, NavStore, NavVp } from "./navGlyphs";
import { type TextKey, groupNumber, vt } from "~/pieces/styled/valText";
import { game } from "~/state/session";
import { wallet } from "~/state/wallet";
import { isEditing, setEditMode } from "~/studio/store";
import { openEscMenu } from "./EscMenu";
import { playCue } from "./sound";
import styles from "./CurrentNav.module.css";

interface IconTab {
  path: string;
  tip: TextKey;
  icon: () => JSX.Element;
  /** Opens another tab's screen, so it never shows as the active one. */
  isShortcut?: boolean;
  /** A view of the path's screen (the battlepass is the career screen's "pass" view). */
  view?: string;
}

// The client's order: battlepass, agents, career, the event, Premier, collection, store.
const ICON_TABS: readonly IconTab[] = [
  { path: "career", view: "pass", tip: "progress", icon: () => <NavPass /> },
  { path: "agents", tip: "agents", icon: () => <NavAgents /> },
  { path: "career", tip: "career", icon: () => <NavCareer /> },
  { path: "play", tip: "modes", icon: () => <NavEvent /> },
  { path: "play", tip: "premier", icon: () => <NavPremier />, isShortcut: true },
  { path: "collection", tip: "collection", icon: () => <NavCollection /> },
  { path: "store", tip: "store", icon: () => <NavStore /> },
];

const isLive = () => game()?.phase === "pregame" || game()?.phase === "ingame";

export function CurrentNav() {
  const location = useLocation();
  const current = () => location.pathname.replace(/^\//, "").split("/")[0] || "home";
  const view = () => new URLSearchParams(location.search).get("view") ?? undefined;
  const isActive = (tab: IconTab) => !tab.isShortcut && current() === tab.path && view() === tab.view;
  return (
    <>
      <header class={styles.bar} data-part="nav">
        <A
          href="/home"
          class={styles.play}
          data-active={current() === "home" ? "" : undefined}
          onMouseEnter={() => playCue("hover")}
          onClick={() => playCue("tab")}
        >
          <ValLogo size={30} class={styles.playLogo} />
          <span class={styles.playLabel}>{vt("play")}</span>
        </A>
        <nav class={styles.icons} aria-label="Menu">
          <For each={ICON_TABS}>
            {(tab) => (
              <A
                href={tab.view ? `/${tab.path}?view=${tab.view}` : `/${tab.path}`}
                class={styles.icon}
                data-part="tab"
                data-active={isActive(tab) ? "" : undefined}
                aria-label={vt(tab.tip)}
                onMouseEnter={() => playCue("hover")}
                onClick={() => playCue("tab")}
              >
                {tab.icon()}
                <span class={styles.tip}>{vt(tab.tip)}</span>
              </A>
            )}
          </For>
          <Show when={isLive()}>
            <A href="/live" class={styles.icon} data-active={current() === "live" ? "" : undefined} onClick={() => playCue("tab")}>
              <span class={styles.liveDot} />
              <span class={styles.tip}>{vt("live")}</span>
            </A>
          </Show>
        </nav>
        <div class={styles.side}>
          <button
            class={styles.sideButton}
            title="Studio (Ctrl+E)"
            onMouseEnter={() => playCue("hover")}
            onClick={() => {
              playCue(isEditing() ? "back" : "confirm");
              setEditMode(!isEditing());
            }}
          >
            <NavMail />
          </button>
          <span class={styles.coin} data-sensitive>
            <NavVp />
            <span>{wallet() ? groupNumber(wallet()?.valorant_points ?? 0) : "-"}</span>
          </span>
          <span class={styles.coin} data-sensitive>
            <NavRp />
            <span>{wallet() ? groupNumber(wallet()?.radianite_points ?? 0) : "-"}</span>
          </span>
          <span class={styles.coin} data-sensitive>
            <NavKc />
            <span>{wallet() ? groupNumber(wallet()?.kingdom_credits ?? 0) : "-"}</span>
          </span>
          <button class={styles.gear} title="Settings (Esc)" onMouseEnter={() => playCue("hover")} onClick={openEscMenu}>
            <NavGear />
          </button>
        </div>
      </header>
      <ValSocial />
    </>
  );
}
