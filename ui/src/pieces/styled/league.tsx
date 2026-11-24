// League client pieces. The home hub: the newest article as the big banner with two hextech
// buttons, the next ones stacked beside it. The lobby: game modes down the left, the party as
// tall banners across the middle (empty ones invite), FIND MATCH under them. The party on its
// own: the same banners, the open ones opening the friends list.
import { For, Index, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Crown, Plus } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { party, partyActions } from "~/state/party";
import { newsView } from "~/state/views";
import { Art } from "~/ui/Art";
import { openExternal } from "../widgets";
import { openInvites, usePartySlots } from "./socialActions";
import { usePlay } from "./usePlay";
import styles from "./league.module.css";

// ---- home -------------------------------------------------------------------------------

export function LolHome(_props: PieceProps) {
  const navigate = useNavigate();
  onMount(() => {
    if (!newsView.value() && !newsView.isLoading()) void newsView.load();
  });
  const items = () => newsView.value()?.items ?? [];
  const hero = () => items()[0];
  const side = () => items().slice(1, 4);
  return (
    <section class={styles.home}>
      <article class={styles.hero} style={{ "--art": hero()?.image ? `url("${hero()?.image}")` : "none" }}>
        <div class={styles.heroText}>
          <span class={styles.kicker}>{hero()?.category.replace(/_/g, " ") || "VALORANT"}</span>
          <h2 class={styles.heroTitle}>{hero()?.title ?? "Welcome back"}</h2>
          <Show when={hero()?.summary}>
            <p class={styles.heroSummary}>{hero()?.summary}</p>
          </Show>
          <div class={styles.heroButtons}>
            <button
              class={styles.hexButton}
              data-tone="teal"
              onMouseEnter={() => playCue("hover")}
              onClick={() => {
                playCue("confirm");
                navigate("/play");
              }}
            >
              Play now
            </button>
            <Show when={hero()?.url}>
              {(url) => (
                <button class={styles.hexButton} onMouseEnter={() => playCue("hover")} onClick={() => void openExternal(url())}>
                  Learn more
                </button>
              )}
            </Show>
          </div>
        </div>
      </article>
      <div class={styles.side}>
        <For each={side()}>
          {(item) => (
            <button class={styles.tile} onMouseEnter={() => playCue("hover")} onClick={() => void openExternal(item.url)}>
              <span class={styles.tileArt} style={{ "--art": item.image ? `url("${item.image}")` : "none" }} />
              <span class={styles.tileText}>
                <small>{item.category.replace(/_/g, " ")}</small>
                <b>{item.title}</b>
              </span>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}

// ---- lobby ------------------------------------------------------------------------------

export function LolLobby(_props: PieceProps) {
  const play = usePlay();
  const members = () => party()?.members ?? [];
  const slots = () => Array.from({ length: Math.max(play.maxSize(), members().length) }, (_, index) => members()[index] ?? null);
  const isOpen = () => party()?.is_open ?? false;
  const mainLabel = () => {
    if (play.searchClock() !== null) return "Cancel";
    if (play.penaltyClock()) return `Restricted ${play.penaltyClock()}`;
    if (!play.isOwner()) return play.isReady() ? "Not ready" : "Ready";
    return play.isCustom() ? "Start game" : "Find match";
  };
  return (
    <section class={styles.lobby}>
      <aside class={styles.modes}>
        <span class={styles.modesHead}>Game modes</span>
        <For each={play.queues()}>
          {(queue) => (
            <button
              class={styles.mode}
              data-active={play.current()?.id === queue.id ? "" : undefined}
              disabled={!play.isOwner() || play.searchClock() !== null}
              onMouseEnter={() => playCue("hover")}
              onClick={() => play.pickQueue(queue)}
            >
              <span class={styles.modeIcon}>
                <Art src={queue.icon} fallback={<i />} />
              </span>
              <span>{queue.label}</span>
            </button>
          )}
        </For>
      </aside>
      <div class={styles.stage}>
        <header class={styles.lobbyHead}>
          <h2>{play.current()?.label ?? "Lobby"}</h2>
          <span>
            {play.partySize()} / {play.maxSize()} · {isOpen() ? "Open party" : "Invite only"}
          </span>
          <Show when={play.isOwner()}>
            <button class={styles.textButton} onClick={() => void partyActions.setOpen(!isOpen())}>
              {isOpen() ? "Close party" : "Open party"}
            </button>
          </Show>
        </header>
        <div class={styles.banners}>
          <Index each={slots()}>{(member) => <Banner member={member()} />}</Index>
        </div>
        <footer class={styles.lobbyFoot}>
          <Show when={play.searchClock()}>
            {(clock) => (
              <span class={styles.searching}>
                In queue <b class="num">{clock()}</b>
              </span>
            )}
          </Show>
          <button
            class={styles.findMatch}
            data-state={play.searchClock() !== null ? "queue" : undefined}
            disabled={play.searchClock() === null && !play.canStart()}
            onMouseEnter={() => playCue("hover")}
            onClick={() => play.press()}
          >
            {mainLabel()}
          </button>
          <Show when={members().length > 1}>
            <button class={styles.textButton} onClick={() => void partyActions.leave()}>
              Leave party
            </button>
          </Show>
        </footer>
      </div>
    </section>
  );
}

export function LolParty(_props: PieceProps) {
  const slots = usePartySlots();
  return (
    <section class={styles.party}>
      <div class={styles.banners}>
        <Index each={slots()}>{(member) => <Banner member={member()} onInvite={openInvites} />}</Index>
      </div>
    </section>
  );
}

function EmptyBanner(props: { onInvite?: (() => void) | undefined }) {
  // A function, not one element: each branch needs its own copy of the nodes.
  const content = () => (
    <>
      <span class={styles.bannerPlus}>
        <Plus size={18} />
      </span>
      <small>Invite from Social</small>
    </>
  );
  return (
    <Show when={props.onInvite} fallback={<div class={styles.banner} data-empty>{content()}</div>}>
      {(onInvite) => (
        <button class={styles.banner} data-empty onMouseEnter={() => playCue("hover")} onClick={() => onInvite()()}>
          {content()}
        </button>
      )}
    </Show>
  );
}

function Banner(props: { member: MemberView | null; onInvite?: () => void }) {
  return (
    <Show
      when={props.member}
      fallback={<EmptyBanner onInvite={props.onInvite} />}
    >
      {(member) => (
        <div class={styles.banner} data-self={member().is_self ? "" : undefined} style={{ "--art": member().card_tall ? `url("${member().card_tall}")` : "none" }}>
          <span class={styles.bannerIcon}>
            <Art src={member().card_small} fallback={<i />} />
          </span>
          <b class={styles.bannerName} data-sensitive>
            <Show when={member().is_owner}>
              <Crown size={11} />
            </Show>
            {member().game_name}
          </b>
          <span class={styles.bannerRank}>
            <Art src={member().rank.icon} fallback={null} />
            {member().rank.name}
          </span>
          <Show when={member().is_ready && !member().is_owner}>
            <span class={styles.ready}>Ready</span>
          </Show>
        </div>
      )}
    </Show>
  );
}
