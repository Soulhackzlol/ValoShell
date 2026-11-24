// Parts every menu style's nav shares: tab links (with the style's own tab names and the hover
// and click cues), the wallet, the connection light and the system buttons (friends, Studio,
// settings, window).
import { For, Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Paintbrush, Power, Settings, Users } from "lucide-solid";
import { isTauri } from "~/ipc/runtime";
import { doc, isEditing, setEditMode } from "~/studio/store";
import { tabLabel } from "~/studio/skins";
import { isDrawerOpen, onlineCount, setDrawerOpen } from "~/state/friends";
import { connection, game } from "~/state/session";
import { wallet } from "~/state/wallet";
import type { SceneInfo } from "./scenes";
import { openEscMenu } from "./EscMenu";
import { playCue } from "./sound";
import styles from "./TopNav.module.css";

export const ICON_SIZE = 17;
export const isLive = () => game()?.phase === "pregame" || game()?.phase === "ingame";
export const label = (tab: SceneInfo) => tabLabel(doc.theme.skin, tab.id, tab.label);

export const LIVE_TAB: SceneInfo = { id: "live", label: "Live", isTab: false };

export function TabLink(props: { tab: SceneInfo; class: string | undefined; activeClass: string | undefined; children?: JSX.Element }) {
  return (
    <A
      href={`/${props.tab.id}`}
      class={props.class ?? ""}
      data-part="tab"
      activeClass={props.activeClass ?? ""}
      onMouseEnter={() => playCue("hover")}
      onClick={() => playCue("tab")}
    >
      {props.children ?? label(props.tab)}
    </A>
  );
}

export function SystemButtons() {
  return (
    <>
      <IconButton
        label="Friends"
        isActive={isDrawerOpen()}
        onClick={() => {
          playCue(isDrawerOpen() ? "back" : "confirm");
          setDrawerOpen(!isDrawerOpen());
        }}
      >
        <Users size={ICON_SIZE} />
        <Show when={onlineCount() > 0}>
          <span class={styles.badge}>{onlineCount()}</span>
        </Show>
      </IconButton>
      <IconButton
        label={isEditing() ? "Close Studio (Esc)" : "Studio: edit everything (Ctrl+E)"}
        isActive={isEditing()}
        onClick={() => {
          playCue(isEditing() ? "back" : "confirm");
          setEditMode(!isEditing());
        }}
      >
        <Paintbrush size={ICON_SIZE} />
      </IconButton>
      <IconButton label="Settings (Esc)" onClick={openEscMenu}>
        <Settings size={ICON_SIZE} />
      </IconButton>
      <Show when={isTauri}>
        <IconButton label="Minimise" onClick={() => void getCurrentWindow().minimize()}>
          <Minus size={ICON_SIZE} />
        </IconButton>
        <IconButton label="Hide to tray (Ctrl+Alt+V brings it back)" onClick={() => void getCurrentWindow().hide()}>
          <Power size={ICON_SIZE} />
        </IconButton>
      </Show>
    </>
  );
}

export function StatusLight() {
  return <span class={styles.status} data-state={connection().state} title={connection().state.replace(/_/g, " ")} />;
}


export function Wallet() {
  const currencies = () => {
    const balances = wallet();
    return [
      { id: "vp", label: "VP", value: balances?.valorant_points },
      { id: "rp", label: "RP", value: balances?.radianite_points },
      { id: "kc", label: "KC", value: balances?.kingdom_credits },
    ];
  };
  return (
    <div class={styles.wallet} data-part="wallet" data-sensitive>
      <For each={currencies()}>
        {(currency) => (
          <span class={styles.currency}>
            <span class={styles.currencyLabel}>{currency.label}</span>
            <span class="num">{currency.value === undefined ? "-" : currency.value.toLocaleString()}</span>
          </span>
        )}
      </For>
    </div>
  );
}

export function IconButton(props: { label: string; isActive?: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class={styles.iconButton}
      data-part="icon-button"
      data-active={props.isActive ? "" : undefined}
      aria-label={props.label}
      title={props.label}
      onMouseEnter={() => playCue("hover")}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  );
}
