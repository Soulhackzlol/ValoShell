// VALORANT (current client) pieces for the play screen: the featured banner, the mode card
// with the party buttons, daily bonuses and missions, the five-banner lineup, FIND MATCH, the
// news tiles and the party chat line. Every piece reads its colours and words from its props
// (empty = the client's own), so each one can be restyled from the Studio inspector.
import { Index, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChartNoAxesColumn, X } from "lucide-solid";
import type { MemberView } from "~/bindings/MemberView";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { useLineupSlots } from "~/pieces/home";
import { openExternal } from "~/pieces/widgets";
import { agentByUpperName, catalog } from "~/state/catalog";
import { setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { copyPartyCode } from "~/state/partyCode";
import { isConnected, ownRiotId } from "~/state/session";
import { pushToast } from "~/state/toasts";
import { newsView, storeView } from "~/state/views";
import { Art } from "~/ui/Art";
import { ChatFrame, ChatUnread } from "./chatFrame";
import { useChatLine } from "./chatLine";
import { CustomModeRows, isCustomLobby } from "./currentCustom";
import { usePlay } from "./usePlay";
import { ChatGlyph, CodeGlyph, CompetitiveGlyph, LeaveGlyph, PadlockGlyph, RangeGlyph, SpikeGlyph } from "./valIcons";
import { type TextKey, queueName, valLang, vt } from "./valText";
import styles from "./current.module.css";

// ---- prop helpers -----------------------------------------------------------------------

/** A text prop, or the client's own wording when left empty. */
export function textProp(props: PieceProps, key: string, fallback: TextKey): string {
  const value = props.piece.props[key];
  return typeof value === "string" && value.trim() ? value : vt(fallback);
}

function numberProp(props: PieceProps, key: string, fallback: number): number {
  const value = props.piece.props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringProp(props: PieceProps, key: string): string {
  const value = props.piece.props[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Colour props become CSS variables on the piece, so the stylesheet keeps the defaults. */
export function colorVars(props: PieceProps, keys: readonly string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of keys) {
    const value = stringProp(props, key);
    if (value) vars[`--val-${key}`] = value;
  }
  return vars;
}

/** A map splash for a queue: the one the piece names, else a stable pick per queue. */
function splashFor(mapName: string, seed: string): string | null {
  const maps = catalog().maps.filter((map) => map.splash && !map.is_team_deathmatch);
  if (maps.length === 0) return null;
  const named = maps.find((map) => map.display_name.toLowerCase() === mapName.toLowerCase());
  if (named) return named.splash;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return maps[hash % maps.length]?.splash ?? null;
}

/** Modes whose card shows an agent close-up in the client; the others show a map. */
const MODE_AGENTS: Record<string, string> = {
  competitive: "Tejo",
  premier: "Brimstone",
};

/** Agent art for a mode card: the piece's pick, else the mode's own, else any agent. */
function modeAgent(name: string, queueId: string) {
  const wanted = name || MODE_AGENTS[queueId] || "Tejo";
  return agentByUpperName(wanted.toUpperCase()) ?? catalog().agents.find((agent) => agent.portrait);
}

function boolProp(props: PieceProps, key: string): boolean {
  return props.piece.props[key] !== false;
}

// ---- featured banner (top-left diagonal art) ---------------------------------------------

/** The banner art's own colour, for the stripe under it: the average of its vivid pixels,
    softened toward the client's off-white, as the client tints the band per bundle. */
function stripeColor(src: string, done: (color: string) => void): void {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, 24, 24);
    let data: Uint8ClampedArray;
    try {
      data = context.getImageData(0, 0, 24, 24).data;
    } catch {
      return;
    }
    const sum = [0, 0, 0];
    let weight = 0;
    for (let at = 0; at < data.length; at += 4) {
      const [r = 0, g = 0, b = 0] = [data[at], data[at + 1], data[at + 2]];
      const vivid = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
      const w = vivid * vivid * ((data[at + 3] ?? 0) / 255);
      sum[0] = (sum[0] ?? 0) + r * w;
      sum[1] = (sum[1] ?? 0) + g * w;
      sum[2] = (sum[2] ?? 0) + b * w;
      weight += w;
    }
    if (weight < 1) return;
    const [r, g, b] = sum.map((value) => Math.round(value / weight));
    done(`color-mix(in srgb, rgb(${r} ${g} ${b}) 70%, #c9c2b0)`);
  };
  image.src = src;
}

/** The client's corner art right now: the VCT Wolves capsule, framed as the client frames it,
    with its gold stripe (sampled). Your own image replaces it and tints the stripe itself. */
const FEATURED_BANNER = "https://media.valorant-api.com/bundles/0dc9affa-4ede-c55c-c768-7395a2f94a1d/displayicon.png";
const FEATURED_STRIPE = "#c5b173";

/** The stripe colour picked from the banner art, shared with the bottom-right corner stripe. */
const [autoStripe, setAutoStripe] = createSignal<string | null>(FEATURED_STRIPE);

/** The client's banner edge, traced at 1:1 in the banner's 462 x 425 pixels: a 4 px line down
    the art's diagonal, a 36 px band beside it for the first 54 px under the bar (outside the
    art), and a 38 px band over the art from 229 px down, each cut flat where it starts or ends. */
const BANNER_STRIPE = [
  "M425 0 H429 L0 429 V425 Z",
  "M425 0 H461 L407 54 H371 Z",
  "M162 229 H200 L0 429 V391 Z",
].join(" ");

export function ValBanner(props: PieceProps) {
  onMount(() => {
    if (!storeView.value() && !storeView.isLoading()) void storeView.load();
  });
  const own = () => stringProp(props, "image");
  createEffect(() => {
    const src = own();
    setAutoStripe(src ? null : FEATURED_STRIPE);
    if (src) stripeColor(src, setAutoStripe);
  });
  return (
    <div class={styles.banner} style={{ ...(autoStripe() ? { "--auto-stripe": autoStripe() ?? "" } : {}), ...colorVars(props, ["stripe"]) }}>
      <div class={styles.bannerArt}>
        <Art
          src={own() || FEATURED_BANNER}
          class={own() ? styles.bannerImage : styles.bannerFeatured}
          fallback={<span class={styles.bannerEmpty} />}
        />
      </div>
      <svg class={styles.bannerStripe} viewBox="0 0 462 425" preserveAspectRatio="none" aria-hidden="true">
        <path d={BANNER_STRIPE} />
      </svg>
    </div>
  );
}

/** The client's bottom-right corner: a 4 px line running down the diagonal behind the news,
    widening into a 30 px band for the last 77 px. Drawn in the piece's own 360 x 332 pixels,
    scaled evenly from its bottom-left so the line stays at 45 degrees in any window shape. */
export function ValCorner(props: PieceProps) {
  return (
    <svg
      class={styles.corner}
      viewBox="0 0 360 332"
      preserveAspectRatio="xMinYMax slice"
      style={{ ...(autoStripe() ? { "--auto-stripe": autoStripe() ?? "" } : {}), ...colorVars(props, ["stripe"]) }}
      aria-hidden="true"
    >
      <path d="M369 0 H373 L41 332 H37 Z M87 255 H118 L41 332 H10 Z" />
    </svg>
  );
}

// ---- mode card and party buttons ---------------------------------------------------------

export function ValMode(props: PieceProps) {
  const navigate = useNavigate();
  const view = () => party();
  const isOpen = () => view()?.is_open ?? false;
  const isAlone = () => (view()?.members.length ?? 1) <= 1;
  const modeName = () => {
    const queue = view()?.queue;
    return queue ? queueName(queue.id, queue.label) : "—";
  };
  const queueId = () => view()?.queue.id ?? "unrated";
  const splash = () => {
    const image = stringProp(props, "image");
    if (image) return image;
    const map = stringProp(props, "map");
    if (map) return splashFor(map, queueId());
    if (stringProp(props, "agent")) return null;
    // The client's own card art for the mode; Premier has none and keeps its agent close-up.
    const art = view()?.queue.art;
    if (art) return art;
    return MODE_AGENTS[queueId()] ? null : splashFor("", queueId());
  };
  const agent = () => modeAgent(stringProp(props, "agent"), queueId());
  const copyCode = async () => {
    playCue("confirm");
    let code = view()?.invite_code ?? null;
    if (!code) {
      await partyActions.generateCode();
      code = party()?.invite_code ?? null;
    }
    if (code) await copyPartyCode(code, vt("codeCopied"));
  };
  return (
    <section class={styles.mode} data-custom={isCustomLobby() ? "" : undefined} style={colorVars(props, ["button", "edge"])}>
      <button
        class={styles.modeCard}
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          playCue("tab");
          navigate("/play");
        }}
      >
        <Show
          when={splash()}
          fallback={
            <span class={styles.modeAgent}>
              <Art src={agent()?.background} class={styles.modeAgentBack} fallback={<span />} />
              <Art src={agent()?.portrait} class={styles.modeAgentFace} fallback={<span class={styles.modeEmpty} />} />
            </span>
          }
        >
          {(image) => <Art src={image()} class={styles.modeImage} fallback={<span class={styles.modeEmpty} />} />}
        </Show>
        <span class={styles.modeShade} />
        <span class={styles.modeName}>
          <Show
            when={view()?.queue.icon}
            fallback={
              <Show when={queueId() === "competitive"} fallback={<SpikeGlyph size={26} />}>
                <CompetitiveGlyph size={22} />
              </Show>
            }
          >
            {(icon) => <img class={styles.modeGlyph} src={icon()} alt="" draggable={false} />}
          </Show>
          {modeName()}
        </span>
      </button>
      <Show when={isCustomLobby()}>
        <CustomModeRows />
      </Show>
      <Show when={boolProp(props, "showLeaderboard") && queueId() === "competitive"}>
        <button class={styles.modeButton} data-size="short" onMouseEnter={() => playCue("hover")} onClick={() => navigate("/career")}>
          <span>{vt("leaderboard")}</span>
          <ChartNoAxesColumn size={18} strokeWidth={2.6} />
        </button>
      </Show>
      <button class={styles.modeButton} onMouseEnter={() => playCue("hover")} onClick={() => pushToast("info", textProp(props, "rangeLabel", "range"), vt("rangeNote"))}>
        <span>{textProp(props, "rangeLabel", "range")}</span>
        <RangeGlyph size={28} />
      </button>
      <button class={styles.modeButton} disabled={!isConnected()} onMouseEnter={() => playCue("hover")} onClick={() => void copyCode()}>
        <Show when={view()?.invite_code} fallback={<span>{textProp(props, "codeLabel", "partyCode")}</span>}>
          {(code) => <span data-sensitive>{code()}</span>}
        </Show>
        <CodeGlyph size={29} />
      </button>
      <button
        class={styles.modeButton}
        data-size="toggle"
        disabled={!(view()?.is_owner ?? false)}
        onMouseEnter={() => playCue("hover")}
        onClick={() => {
          playCue("tab");
          void partyActions.setOpen(!isOpen());
        }}
      >
        <span>{isOpen() ? vt("partyOpen") : vt("partyClosed")}</span>
        <span class={styles.toggle} data-on={isOpen() ? "" : undefined}>
          <svg viewBox="0 0 52 18" aria-hidden="true">
            <path d="M9 1 H44 L51 9 L44 17 H9 A8 8 0 0 1 9 1 Z" />
            <path class={styles.toggleBar} d="M9 4.5 H42.5 L47 9 L42.5 13.5 H9 Z" />
          </svg>
          <span class={styles.toggleKnob}>
            <PadlockGlyph isOpen={isOpen()} />
          </span>
        </span>
      </button>
      <button class={styles.modeButton} disabled={isAlone()} onMouseEnter={() => playCue("hover")} onClick={() => void partyActions.leave()}>
        <span>{textProp(props, "leaveLabel", "leaveParty")}</span>
        <LeaveGlyph size={26} />
      </button>
    </section>
  );
}

// ---- daily bonuses and missions ----------------------------------------------------------

/** The client's streak frame: four separate strokes that stop short of each point, each side
 *  lit differently (upper right brightest, lower left faintest). Sampled on 1920 x 1080. */
const DIAMOND_SIDES = [
  { x1: 2.5, y1: 29, x2: 29, y2: 2.5, alpha: 0.15 },
  { x1: 35, y1: 2.5, x2: 61.5, y2: 29, alpha: 0.23 },
  { x1: 61.5, y1: 35, x2: 35, y2: 61.5, alpha: 0.16 },
  { x1: 29, y1: 61.5, x2: 2.5, y2: 35, alpha: 0.12 },
] as const;

function DiamondFrame() {
  return (
    <svg class={styles.dailyFrame} viewBox="0 0 64 64" aria-hidden="true">
      {DIAMOND_SIDES.map((side) => (
        <line x1={side.x1} y1={side.y1} x2={side.x2} y2={side.y2} stroke={`rgb(236 232 225 / ${side.alpha})`} stroke-width="2.1" />
      ))}
    </svg>
  );
}

export function ValDailies(props: PieceProps) {
  const navigate = useNavigate();
  const goToProgress = () => {
    playCue("tab");
    navigate("/career");
  };
  return (
    <button class={styles.dailies} style={colorVars(props, ["text"])} onMouseEnter={() => playCue("hover")} onClick={goToProgress}>
      <span class={styles.dailyLabel}>
        {textProp(props, "bonusLabel", "dailyBonuses")}
        <b>{numberProp(props, "bonuses", 0)}/4</b>
      </span>
      <span class={styles.dailyDiamond}>
        <DiamondFrame />
        <b>{numberProp(props, "streak", 1)}</b>
      </span>
      <i class={styles.dailySep} />
      <span class={styles.missionLabel}>
        {textProp(props, "missionLabel", "missions")}
        <b>{numberProp(props, "missions", 0)}/3</b>
      </span>
      <span class={styles.missionIcon} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

// ---- lineup ------------------------------------------------------------------------------

/** Signal bars for a ping, like the client's corner meter. */
function pingBars(ping: number | null): number {
  if (ping === null) return 0;
  if (ping < 40) return 4;
  if (ping < 70) return 3;
  if (ping < 110) return 2;
  return 1;
}

const SLOT_POSITIONS = ["outer", "inner", "center", "inner", "outer"] as const;

export function ValLineup(props: PieceProps) {
  const slots = useLineupSlots();
  const showLevel = () => props.piece.props["showLevel"] !== false;
  return (
    <div class={styles.lineup} style={colorVars(props, ["ready", "gold", "slot"])}>
      <Index each={slots()}>
        {(member, index) => (
          <div class={styles.slot} data-pos={SLOT_POSITIONS[index]} data-side={index < 2 ? "left" : index > 2 ? "right" : "mid"}>
            <Show when={member()} fallback={index === 2 ? <OfflineBanner /> : <EmptyBanner />}>
              {(current) => <MemberBanner member={current()} showLevel={showLevel()} />}
            </Show>
          </div>
        )}
      </Index>
    </div>
  );
}

/** The level plate, traced off the client at 1:1: flat top and bottom, a cream curly brace
    for each end. */
const LEVEL_OUTLINE = "M11 1H39L44 6L46.5 9.5L44.5 11.5V13.5L46.5 15.5L44 19L39 24H11L6 19L3.5 15.5L5.5 13.5V11.5L3.5 9.5L6 6Z";
const LEVEL_BRACES = "M6.5 5.5L3.5 9.5L5.5 11.5V13.5L3.5 15.5L6.5 19.5 M43.5 5.5L46.5 9.5L44.5 11.5V13.5L46.5 15.5L43.5 19.5";

/** The title in the client's language: a Spanish client shows "Seis, siete", not "Six Seven". */
function memberTitle(member: MemberView): string | null {
  return valLang() === "es" ? member.title_es ?? member.title : member.title;
}

function MemberBanner(props: { member: MemberView; showLevel: boolean }) {
  const canKick = () => (party()?.is_owner ?? false) && !props.member.is_self;
  return (
    <article class={styles.banner2} data-self={props.member.is_self ? "" : undefined}>
      <div class={styles.cardArt} style={{ "--art": props.member.card_tall ? `url("${props.member.card_tall}")` : "none" }} />
      <div class={styles.cardShade} />
      <svg class={styles.cardLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M3 61 V75 L50 92 L97 75 V61" />
      </svg>
      <Show when={props.showLevel && props.member.account_level !== null}>
        <span class={styles.level}>
          <svg viewBox="0 0 50 25" aria-hidden="true">
            <path class={styles.levelBody} d={LEVEL_OUTLINE} />
            <path class={styles.levelBraceEdge} d={LEVEL_BRACES} />
            <path class={styles.levelBrace} d={LEVEL_BRACES} />
          </svg>
          <span>{props.member.account_level}</span>
        </span>
      </Show>
      <span class={styles.ping} title={props.member.ping_ms === null ? "" : `${props.member.ping_ms} ms`}>
        <Index each={[1, 2, 3, 4]}>{(bar) => <i data-on={bar() <= pingBars(props.member.ping_ms) ? "" : undefined} />}</Index>
      </span>
      <Show when={canKick()}>
        <button class={styles.kick} title="Remove from party" onClick={() => void partyActions.kick(props.member.puuid)}>
          <X size={14} />
        </button>
      </Show>
      <div class={styles.cardInfo}>
        <span class={styles.readyText} data-ready={props.member.is_ready ? "" : undefined}>
          {props.member.is_ready ? vt("ready") : vt("notReady")}
        </span>
        <i class={styles.readyLine} data-ready={props.member.is_ready ? "" : undefined} />
        <span class={styles.cardName} data-sensitive>
          {props.member.game_name || "Player"}
        </span>
        <Show when={memberTitle(props.member)}>{(title) => <span class={styles.cardTitle}>{title()}</span>}</Show>
        <span class={styles.chevrons} aria-hidden="true">
          <i data-side="l" />
          <svg class={styles.mute} width="22" height="18" viewBox="0 0 22 18" fill="currentColor" aria-hidden="true">
            <path d="M1 6 H5 L10.5 1.5 V16.5 L5 12 H1 Z" />
            <path d="M14 6.5 L19 11.5 M19 6.5 L14 11.5" stroke="currentColor" stroke-width="1.6" fill="none" />
          </svg>
          <i data-side="r" />
        </span>
        <Show when={props.member.rank.tier > 0 && props.member.rank.icon}>
          {(icon) => <Art src={icon()} class={styles.rank} fallback={<span class={styles.rank} />} alt={props.member.rank.name} />}
        </Show>
      </div>
    </article>
  );
}

function OfflineBanner() {
  return (
    <article class={styles.banner2} data-self="">
      <div class={styles.cardArt} style={{ "--art": "none" }} />
      <div class={styles.cardShade} />
      <div class={styles.cardInfo}>
        <span class={styles.readyText}>{isConnected() ? vt("notReady") : vt("offline")}</span>
        <i class={styles.readyLine} />
        <span class={styles.cardName} data-sensitive>
          {ownRiotId()?.name ?? "—"}
        </span>
      </div>
    </article>
  );
}

/** The client's invite mark, sampled at 1:1: a dark diamond halo, a hairline diamond, a 3 px
    ring round a navy diamond, and a 19 px plus. Half-diagonals 37, 25 and 19.5 px. */
function InviteMark() {
  const diamond = (half: number) => `M0 ${-half} L${half} 0 L0 ${half} L${-half} 0 Z`;
  return (
    <svg width="74" height="74" viewBox="-37 -37 74 74" aria-hidden="true">
      <path class={styles.markHalo} d={diamond(37)} />
      <path class={styles.markHairline} d={diamond(25)} />
      <path class={styles.markRing} d={diamond(19.5)} />
      <path class={styles.markPlus} d="M-9.5 0 H9.5 M0 -9.5 V9.5" />
    </svg>
  );
}

function EmptyBanner() {
  return (
    <button
      class={styles.empty}
      disabled={!isConnected()}
      title={vt("invite")}
      onMouseEnter={() => playCue("hover")}
      onClick={() => {
        playCue("confirm");
        setDrawerOpen(true);
      }}
    >
      {/* Traced off a 1080p client in percent of the slot: its outline (sides, then a V from
          79.6 %), a V from the sides at 69.8 %, and a line 7.8 % in that runs 46-77 % then
          closes into a V meeting at 94.6 %. */}
      <svg class={styles.emptyLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 V79.6 L50 100 L100 79.6 V0" />
        <path d="M0 69.8 L50 90.2 L100 69.8" />
        <path d="M7.8 46.4 V77.3 L50 94.6 L92.2 77.3 V46.4" />
      </svg>
      <span class={styles.plus}>
        <InviteMark />
      </span>
    </button>
  );
}

// ---- FIND MATCH ----------------------------------------------------------------------------

export function ValFind(props: PieceProps) {
  const play = usePlay();
  const label = () => {
    if (play.searchClock() !== null) return vt("cancel");
    if (play.penaltyClock()) return play.penaltyClock() ?? "";
    if (!play.isOwner() && party()) return play.isReady() ? vt("notReady") : vt("ready");
    if (isCustomLobby()) return vt("start");
    return textProp(props, "label", "findMatch");
  };
  return (
    <div class={styles.find} style={colorVars(props, ["fill", "frame"])}>
      <Show when={play.searchClock()}>
        {(clock) => (
          <span class={styles.queueClock}>
            {vt("inQueue")} <b>{clock()}</b>
          </span>
        )}
      </Show>
      <button
        class={styles.findButton}
        data-part="play"
        data-searching={play.searchClock() !== null ? "" : undefined}
        disabled={play.searchClock() === null && !play.canStart()}
        onMouseEnter={() => playCue("hover")}
        onClick={() => play.press()}
      >
        <span>{label()}</span>
      </button>
    </div>
  );
}

// ---- news tiles ----------------------------------------------------------------------------

const NEWS_ROTATE_MS = 8000;
const NEWS_SLIDES = 4;
/** The capsule the client features beside the lineup (VCT '26, LOUD). */
const FEATURED_CAPSULE = "https://media.valorant-api.com/bundles/8feb9ed1-441a-73b6-55ed-ff836011701e/verticalpromoimage.png";

type NewsSlide = { image: string | null; title: string; link: string };

/** "VOCÊ É BRABA // Game Changers Championship" as a title and the line under it. */
function splitHeadline(title: string): [string, string] {
  const at = title.indexOf(" // ");
  return at < 0 ? [title, ""] : [title.slice(0, at), title.slice(at + 4)];
}

function follow(event: MouseEvent, link: string): void {
  if (!/^https?:/.test(link)) return;
  event.preventDefault();
  void openExternal(link);
}

export function ValNews(props: PieceProps) {
  onMount(() => {
    if (!storeView.value() && !storeView.isLoading()) void storeView.load();
    if (!newsView.value() && !newsView.isLoading()) void newsView.load();
  });
  const daily = (index: number) => storeView.value()?.daily[index];
  const news = () => newsView.value()?.items ?? [];
  /** The second tile: the newest esports story, as the client promotes its events. */
  const promo = createMemo(() => news().find((item) => item.category === "esports") ?? news()[0]);
  const promoText = () => splitHeadline(stringProp(props, "title2") || promo()?.title || daily(0)?.name || "");
  /** The carousel: your own slide first when set, then the other news (store offers offline). */
  const slides = createMemo<NewsSlide[]>(() => {
    const own = stringProp(props, "title3") || stringProp(props, "image3") ? [{ image: stringProp(props, "image3") || null, title: stringProp(props, "title3"), link: stringProp(props, "link3") }] : [];
    const stories = news()
      .filter((item) => item !== promo())
      .map((item) => ({ image: item.image, title: item.title, link: item.url }));
    const view = storeView.value();
    const offers = [...(view?.bundles.slice(1) ?? []), ...(view?.daily.slice(1) ?? [])].map((item) => ({ image: item.image, title: item.name, link: "" }));
    return [...own, ...(stories.length > 0 ? stories : offers)].slice(0, NEWS_SLIDES);
  });
  const [slide, setSlide] = createSignal(0);
  const timer = window.setInterval(() => {
    const count = slides().length;
    if (count > 1) setSlide((at) => (at + 1) % count);
  }, NEWS_ROTATE_MS);
  onCleanup(() => window.clearInterval(timer));
  const current = () => slides()[slide()] ?? slides()[0];
  const promoLink = () => (stringProp(props, "title2") ? "" : (promo()?.url ?? ""));
  const patchLink = () => newsView.value()?.patch_url ?? "";
  return (
    <div class={styles.news}>
      <a class={styles.tile} data-size="big" href="/store" onMouseEnter={() => playCue("hover")}>
        <Art src={stringProp(props, "image1") || FEATURED_CAPSULE} class={styles.tileImage} fallback={<span class={styles.tileEmpty} />} />
        <span class={styles.tileShade} />
        <span class={styles.tileText}>
          <b class={styles.tileTitle}>{textProp(props, "title1", "featured")}</b>
          <span class={styles.tileSub}>{textProp(props, "sub1", "capsule")}</span>
          <span class={styles.tileDesc}>{textProp(props, "desc1", "capsuleNote")}</span>
        </span>
      </a>
      <a class={styles.tile} data-size="mid" href={promoLink() || "/store"} onClick={(event) => follow(event, promoLink())} onMouseEnter={() => playCue("hover")}>
        <Art src={stringProp(props, "image2") || promo()?.image || daily(0)?.image || null} class={styles.tileImage} fallback={<span class={styles.tileEmpty} />} />
        <span class={styles.tileShade} />
        <span class={styles.tileText}>
          <b class={styles.tileTitle}>{promoText()[0]}</b>
          <Show when={stringProp(props, "sub2") || promoText()[1]}>
            <span class={styles.tileSub}>{stringProp(props, "sub2") || promoText()[1]}</span>
          </Show>
        </span>
      </a>
      <a class={styles.tile} data-size="mid" href={current()?.link || "/store"} onClick={(event) => follow(event, current()?.link ?? "")} onMouseEnter={() => playCue("hover")}>
        <Art src={current()?.image} class={styles.tileImage} fallback={<span class={styles.tileEmpty} />} />
        <span class={styles.tileShade} />
        <span class={styles.tileText}>
          <b class={styles.slideTitle}>
            {current()?.title ?? ""}
            <Show when={current()?.link}>
              <ExternalGlyph />
            </Show>
          </b>
        </span>
        <Show when={slides().length > 1}>
          <span class={styles.dots}>
            <Index each={slides()}>
              {(_, at) => (
                <button
                  class={styles.dot}
                  data-active={at === slide() ? "" : undefined}
                  title={`${at + 1}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    playCue("tab");
                    setSlide(at);
                  }}
                />
              )}
            </Index>
          </span>
        </Show>
      </a>
      <a class={styles.patch} href={patchLink() || "#"} onClick={(event) => (patchLink() ? follow(event, patchLink()) : event.preventDefault())} onMouseEnter={() => playCue("hover")}>
        <span class={styles.patchTitle}>{vt("patchNotes")}</span>
        <span>{stringProp(props, "version") || newsView.value()?.patch_version || "13.08"}</span>
      </a>
    </div>
  );
}

/** The client's small "opens in the browser" box-and-arrow after a news title. */
function ExternalGlyph() {
  return (
    <svg class={styles.external} width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
      <path d="M4.5 1.5 H1 V10 H9.5 V6.5 M6.5 1 H10 V4.5 M10 1 L4.5 6.5" />
    </svg>
  );
}

// ---- party chat line -----------------------------------------------------------------------

export function ValChat(props: PieceProps) {
  const line = useChatLine();
  return (
    <ChatFrame line={line}>
      <form
        class={styles.chat}
        data-sending={line.isSending() ? "" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          line.submit();
        }}
      >
        <span class={styles.chatLabel}>{textProp(props, "label", "partyChat")}</span>
        <input
          value={line.text()}
          spellcheck={false}
          disabled={!line.canSend()}
          onInput={(event) => line.onInput(event.currentTarget.value)}
          onKeyDown={(event) => line.onKeyDown(event)}
          placeholder={line.placeholder("", vt("chatClosed"))}
        />
        <button type="button" data-part="chat-open" class={styles.chatOpen} title={vt("openChat")} aria-label={vt("openChat")} onClick={() => line.openChat()}>
          <ChatGlyph class={styles.chatIcon} />
          <ChatUnread line={line} />
        </button>
      </form>
    </ChatFrame>
  );
}
