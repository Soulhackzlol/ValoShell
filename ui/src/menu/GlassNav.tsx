// Glass style nav: three floating capsules. You on the left, the screens in the middle as a
// segmented control whose highlight glides to the picked tab, and search, currencies and
// system buttons on the right. Q/E and Esc stay with TopNav; the search capsule opens Ctrl+K.
import { For, Show, createEffect, on, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { Paintbrush, Search, Settings, Users } from "lucide-solid";
import { pointerGlow, pop, roll, stretch } from "~/pieces/styled/glassMotion";
import { KcCoin, RpCoin, VpCoin } from "~/pieces/styled/valIcons";
import { isDrawerOpen, onlineCount, setDrawerOpen } from "~/state/friends";
import { party } from "~/state/party";
import { connection, game, ownRiotId } from "~/state/session";
import { wallet } from "~/state/wallet";
import { isEditing, setEditMode } from "~/studio/store";
import { Art } from "~/ui/Art";
import { openCommandPalette } from "./CommandPalette";
import { openEscMenu } from "./EscMenu";
import { TABS } from "./scenes";
import { playCue } from "./sound";
import styles from "./GlassNav.module.css";

export function GlassNav() {
  const location = useLocation();
  const current = () => location.pathname.replace(/^\//, "").split("/")[0] || "home";
  const index = () => TABS.findIndex((tab) => tab.id === current());
  const self = () => party()?.members.find((member) => member.is_self);
  const isLive = () => game()?.phase === "pregame" || game()?.phase === "ingame";
  let thumb: HTMLSpanElement | undefined;
  let badge: HTMLSpanElement | undefined;
  // The highlight stretches like liquid on its way to the new tab.
  createEffect(on(index, (next, previous) => previous !== undefined && previous >= 0 && next >= 0 && stretch(thumb, next - previous), { defer: true }));
  createEffect(on(onlineCount, () => pop(badge, 1.4), { defer: true }));
  return (
    <header class={styles.nav} data-part="nav">
      <div ref={(element) => pointerGlow(element)} class={styles.capsule}>
        <span class={styles.glare} aria-hidden="true" />
        <span class={styles.avatar}>
          <Art src={self()?.card_small ?? null} class={styles.avatarImage} fallback={<span class={styles.avatarEmpty} />} />
          <i class={styles.presence} data-state={connection().state} />
        </span>
        <span class={styles.who}>
          <b data-sensitive>{self()?.game_name || ownRiotId()?.name || "Offline"}</b>
          <small>{self()?.account_level ? `Level ${self()?.account_level}` : connection().state.replace(/_/g, " ")}</small>
        </span>
      </div>
      <nav ref={(element) => pointerGlow(element)} class={styles.tabs} style={{ "--count": TABS.length, "--index": Math.max(0, index()) }} aria-label="Menu">
        <span class={styles.glare} aria-hidden="true" />
        <span ref={thumb} class={styles.thumb} data-hidden={index() === -1 ? "" : undefined} />
        <For each={TABS}>
          {(tab) => (
            <A
              href={`/${tab.id}`}
              class={styles.tab}
              data-part="tab"
              data-active={current() === tab.id ? "" : undefined}
              onMouseEnter={() => playCue("hover")}
              onClick={() => playCue("tab")}
            >
              {tab.label}
            </A>
          )}
        </For>
      </nav>
      <div class={styles.right}>
        <Show when={isLive()}>
          <A href="/live" class={styles.live} onClick={() => playCue("tab")}>
            <i /> Live
          </A>
        </Show>
        <button class={styles.search} onMouseEnter={() => playCue("hover")} onClick={openCommandPalette}>
          <Search size={15} />
          <span>Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div ref={(element) => pointerGlow(element)} class={styles.capsule} data-sensitive>
          <span class={styles.glare} aria-hidden="true" />
          <Coin icon={<VpCoin size={15} />} value={wallet()?.valorant_points} />
          <Coin icon={<RpCoin size={15} />} value={wallet()?.radianite_points} />
          <Coin icon={<KcCoin size={15} />} value={wallet()?.kingdom_credits} />
        </div>
        <div ref={(element) => pointerGlow(element)} class={styles.capsule}>
          <span class={styles.glare} aria-hidden="true" />
          <IconButton
            label="Friends"
            isActive={isDrawerOpen()}
            onClick={() => {
              playCue(isDrawerOpen() ? "back" : "confirm");
              setDrawerOpen(!isDrawerOpen());
            }}
          >
            <Users size={17} />
            <Show when={onlineCount() > 0}>
              <span ref={badge} class={styles.badge}>
                {onlineCount()}
              </span>
            </Show>
          </IconButton>
          <IconButton
            label="Studio (Ctrl+E)"
            isActive={isEditing()}
            onClick={() => {
              playCue(isEditing() ? "back" : "confirm");
              setEditMode(!isEditing());
            }}
          >
            <Paintbrush size={17} />
          </IconButton>
          <IconButton label="Settings (Esc)" onClick={openEscMenu}>
            <Settings size={17} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}

function Coin(props: { icon: JSX.Element; value: number | undefined }) {
  let digits: HTMLSpanElement | undefined;
  // Spending rolls the number down, earning rolls it up.
  createEffect(
    on(
      () => props.value,
      (next, previous) => next !== undefined && previous !== undefined && next !== previous && roll(digits, next > previous ? 1 : -1),
      { defer: true },
    ),
  );
  return (
    <span class={styles.coin}>
      {props.icon}
      <span ref={digits} class={styles.coinValue}>
        {props.value === undefined ? "–" : props.value.toLocaleString()}
      </span>
    </span>
  );
}

function IconButton(props: { label: string; isActive?: boolean; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      class={styles.iconButton}
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
