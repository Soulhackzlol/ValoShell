// Fortnite-style pieces, after the Battle Royale lobby: the party row (players standing in the
// scene with a name plate and level badge, big "+" slots to invite), the mode card with its art
// and the big yellow PLAY in the bottom-right, and the item shop where each skin's card takes
// the colour of its VALORANT edition (Select, Deluxe, Premium, Exclusive, Ultra), read from its
// price.
import { For, Index, Show, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Plus } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { StoreItem } from "~/bindings/StoreItem";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { useLineupSlots } from "~/pieces/home";
import { formatDuration } from "~/pieces/store";
import { editionOf } from "~/pieces/storeArt";
import { setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { storeView } from "~/state/views";
import { Art } from "~/ui/Art";
import { usePlay } from "./usePlay";
import styles from "./fortnite.module.css";

// ---- party row --------------------------------------------------------------------------

export function FnParty(_props: PieceProps) {
  const slots = useLineupSlots();
  return (
    <div class={styles.party}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} data-center={index === 2 ? "" : undefined} style={{ "--stagger": Math.abs(index - 2) }}>
            <Show
              when={member()}
              fallback={
                <button
                  class={styles.invite}
                  disabled={index === 2}
                  onMouseEnter={() => playCue("hover")}
                  onClick={() => {
                    playCue("confirm");
                    setDrawerOpen(true);
                  }}
                >
                  <span class={styles.plus}>
                    <Plus size={28} strokeWidth={3.2} />
                  </span>
                  <span class={styles.inviteText}>{index === 2 ? "Offline" : "Invite"}</span>
                </button>
              }
            >
              {(current) => <Banner member={current()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}

function Banner(props: { member: MemberView }) {
  return (
    <article class={styles.banner} data-self={props.member.is_self ? "" : undefined}>
      <div class={styles.bannerArt} style={{ "--art": props.member.card_tall ? `url("${props.member.card_tall}")` : "none" }} />
      <Show when={!props.member.card_tall}>
        <span class={styles.silhouette} aria-hidden="true">
          {props.member.game_name.slice(0, 1)}
        </span>
      </Show>
      <Show when={props.member.is_ready}>
        <span class={styles.readyTick}>Ready</span>
      </Show>
      {/* The glowing pad the lobby characters stand on. */}
      <span class={styles.pad} aria-hidden="true" />
      <div class={styles.plate}>
        <span class={styles.star} title="Account level">
          <span class="num">{props.member.account_level ?? "–"}</span>
        </span>
        <span class={styles.plateText}>
          <b data-sensitive>{props.member.game_name}</b>
          <small>{props.member.rank.tier >= 3 ? props.member.rank.name : "Unranked"}</small>
        </span>
      </div>
    </article>
  );
}

// ---- mode card and PLAY -----------------------------------------------------------------

export function FnPlay(_props: PieceProps) {
  const play = usePlay();
  const isOpen = () => party()?.is_open ?? false;
  const cycleQueue = () => {
    const queues = play.queues();
    const index = queues.findIndex((queue) => queue.id === play.current()?.id);
    const next = queues[(index + 1) % Math.max(1, queues.length)];
    if (next) play.pickQueue(next);
  };
  const buttonLabel = () => {
    if (play.searchClock() !== null) return "Cancel";
    if (play.penaltyClock()) return play.penaltyClock();
    if (!play.isOwner()) return play.isReady() ? "Ready!" : "Ready up";
    return "Play";
  };
  return (
    <section class={styles.play} data-searching={play.searchClock() !== null ? "" : undefined}>
      <button class={styles.modeCard} disabled={!play.isOwner()} onMouseEnter={() => playCue("hover")} onClick={cycleQueue}>
        <Art src={play.current()?.art ?? null} class={styles.modeArt} fallback={null} />
        <span class={styles.modeEyebrow}>Change</span>
        <span class={styles.modeName}>{play.current()?.label ?? "Offline"}</span>
        <span class={styles.modeMeta}>
          Party {play.partySize()}/{play.maxSize()} · {isOpen() ? "Public" : "Private"}
        </span>
      </button>
      <Show when={play.searchClock()}>
        {(clock) => <span class={`${styles.searching} num`}>Searching… {clock()}</span>}
      </Show>
      <div class={styles.playRow}>
        <button
          class={styles.privacy}
          disabled={!play.isOwner()}
          title="Party privacy"
          onClick={() => {
            playCue("tab");
            void partyActions.setOpen(!isOpen());
          }}
        >
          {isOpen() ? "Public" : "Private"}
        </button>
        <button
          class={styles.playButton}
          data-part="play"
          disabled={play.searchClock() === null && !play.canStart()}
          onMouseEnter={() => playCue("hover")}
          onClick={() => play.press()}
        >
          <span>{buttonLabel()}</span>
        </button>
      </div>
    </section>
  );
}

// ---- item shop --------------------------------------------------------------------------

export function FnShop(props: PieceProps) {
  const navigate = useNavigate();
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => window.clearInterval(timer));
  onMount(() => {
    if (!storeView.value()) void storeView.load();
  });
  const showBundle = () => props.piece.props["showBundle"] !== false;
  const view = () => storeView.value();
  const left = () => {
    const current = view();
    return current ? current.daily_ends_in_s - (now() - current.observed_at_ms) / 1000 : 0;
  };
  const open = () => {
    playCue("confirm");
    navigate("/store");
  };
  return (
    <section class={styles.shop}>
      <header class={styles.shopHead}>
        <span class={styles.shopTitle}>Item Shop</span>
        <span class={`${styles.shopTimer} num`}>New items in {formatDuration(left())}</span>
      </header>
      <Show when={view()} fallback={<p class={styles.shopEmpty}>{storeView.isLoading() ? "Loading the shop…" : "Connect to VALORANT to see the shop."}</p>}>
        {(current) => (
          <div class={styles.shopGrid} data-with-bundle={showBundle() && current().bundles[0] ? "" : undefined}>
            <Show when={showBundle() && current().bundles[0]}>
              {(bundle) => (
                <button class={styles.item} data-tone="featured" data-wide="" onClick={open}>
                  <Art src={bundle().image} class={styles.itemArt} fallback={<span class={styles.itemArt} />} />
                  <span class={styles.itemEdition}>Featured</span>
                  <span class={styles.itemFoot}>
                    <b>{bundle().name}</b>
                    <span class="num">{(bundle().discounted_price ?? bundle().price).toLocaleString()} VP</span>
                  </span>
                </button>
              )}
            </Show>
            <For each={current().daily}>{(item) => <ShopItem item={item} onOpen={open} />}</For>
          </div>
        )}
      </Show>
    </section>
  );
}

function ShopItem(props: { item: StoreItem; onOpen: () => void }) {
  const edition = () => editionOf(props.item.price);
  return (
    <button class={styles.item} data-tone={edition().tone} onClick={() => props.onOpen()}>
      <Art src={props.item.image} class={styles.itemArt} fallback={<span class={styles.itemArt} />} />
      <span class={styles.itemEdition}>{edition().name}</span>
      <span class={styles.itemFoot}>
        <b>{props.item.name}</b>
        <span class="num">{props.item.price.toLocaleString()} VP</span>
      </span>
    </button>
  );
}
