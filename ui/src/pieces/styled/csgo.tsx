// CS:GO (Panorama)-style pieces, after the 2018 main menu: the profile card (avatar, level
// coin, rank bar), the store strip (featured offer with countdown, offers with green price
// buttons, pager), the friends/party panel with icon tabs, and the News page (blog tabs with
// VALORANT's real news, article, stat column, map tiles). Plus the matchmaking box and the skill-group plate.
import { For, Index, Match, Show, Switch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { ChevronLeft, ChevronRight, Percent, Search, Swords, Trophy, User, UserPlus, Users } from "lucide-solid";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { catalog } from "~/state/catalog";
import { friendActivity, friends, setDrawerOpen } from "~/state/friends";
import { party, partyActions } from "~/state/party";
import { ownRiotId } from "~/state/session";
import { sensitiveTitle } from "~/state/settings";
import { careerView, newsView, storeView } from "~/state/views";
import { Art } from "~/ui/Art";
import { formatDuration } from "~/pieces/store";
import { rankColor } from "~/pieces/home";
import { openExternal } from "~/pieces/widgets";
import { Silhouette } from "./avatars";
import { usePlay } from "./usePlay";
import styles from "./csgo.module.css";
import { useOpenMatch } from "~/menu/openMatch";

// ---- matchmaking box --------------------------------------------------------------------

export function CsgoPlay(props: PieceProps) {
  const play = usePlay();
  const showModes = () => props.piece.props["showModes"] !== false;
  const buttonLabel = () => {
    if (play.searchClock() !== null) return "Cancel";
    if (play.penaltyClock()) return play.penaltyClock();
    if (!play.isOwner()) return play.isReady() ? "Ready" : "Accept";
    return "Go";
  };
  return (
    <section class={styles.box} data-searching={play.searchClock() !== null ? "" : undefined}>
      <header class={styles.titleBar}>
        <span>Matchmaking</span>
        <span class={styles.titleMode}>{play.current()?.label ?? "—"}</span>
      </header>
      <Show when={showModes()}>
        <ul class={styles.modeList} role="radiogroup">
          <For each={play.queues()}>
            {(queue) => (
              <li>
                <button
                  role="radio"
                  aria-checked={play.current()?.id === queue.id}
                  class={styles.modeRow}
                  data-active={play.current()?.id === queue.id ? "" : undefined}
                  disabled={!play.isOwner()}
                  onMouseEnter={() => playCue("hover")}
                  onClick={() => play.pickQueue(queue)}
                >
                  <span class={styles.check} />
                  {queue.label}
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <footer class={styles.footer}>
        <span class={styles.status}>
          <Show when={play.searchClock()} fallback={`${play.partySize()} / ${play.maxSize()} in party`}>
            {(clock) => <span class="num">Searching… {clock()}</span>}
          </Show>
        </span>
        <button
          class={styles.go}
          data-part="play"
          disabled={play.searchClock() === null && !play.canStart()}
          onMouseEnter={() => playCue("hover")}
          onClick={() => play.press()}
        >
          {buttonLabel()}
        </button>
      </footer>
    </section>
  );
}

// ---- skill group ------------------------------------------------------------------------

export function CsgoSkill(_props: PieceProps) {
  onMount(() => {
    if (!careerView.value()) void careerView.load();
  });
  const self = () => party()?.members.find((member) => member.is_self);
  const view = () => careerView.value();
  return (
    <section class={styles.skill}>
      <header class={styles.skillHead}>Competitive skill group</header>
      <div class={styles.skillBody}>
        <div class={styles.plate} style={{ "--rank": rankColor(view()?.rank.color ?? null) }}>
          <Art src={view()?.rank.icon} class={styles.plateIcon} fallback={<span class={styles.plateEmpty}>?</span>} />
        </div>
        <div class={styles.skillText}>
          <span class={styles.skillName}>
            <Show when={view()} fallback={careerView.isLoading() ? "Loading…" : "Not connected"}>
              {(current) => (current().placements_left > 0 ? "Not ranked yet" : current().rank.name)}
            </Show>
          </span>
          <Show when={view()}>
            {(current) => (
              <span class={styles.skillStats}>
                Wins: <b class="num">{current().wins}</b>
                <Show when={current().placements_left > 0}>
                  {" "}· {current().placements_left} placements left
                </Show>
              </span>
            )}
          </Show>
        </div>
      </div>
      <div class={styles.levelRow}>
        <span class={`${styles.levelBadge} num`}>{self()?.account_level ?? "—"}</span>
        <div class={styles.levelBar}>
          <i style={{ width: `${Math.min(100, view()?.rr ?? 0)}%` }} />
        </div>
        <span class={`${styles.levelText} num`}>{view()?.rr ?? 0} / 100 RR</span>
      </div>
    </section>
  );
}

// ---- news column ------------------------------------------------------------------------

function useNow(intervalMs: number): () => number {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => window.clearInterval(timer));
  return now;
}

function useLoaded(): void {
  onMount(() => {
    if (!careerView.value()) void careerView.load();
    if (!storeView.value()) void storeView.load();
  });
}


// ---- profile card -----------------------------------------------------------------------

export function CsgoProfile(_props: PieceProps) {
  useLoaded();
  const self = () => party()?.members.find((member) => member.is_self);
  const view = () => careerView.value();
  const rr = () => Math.min(100, view()?.rr ?? 0);
  const winRate = () => {
    const current = view();
    return current && current.games > 0 ? Math.round((current.wins / current.games) * 100) : 0;
  };
  return (
    <section class={styles.profile}>
      <div class={styles.profileTop}>
        <span class={styles.avatar}>
          <Art src={self()?.card_small ?? self()?.card_tall} class={styles.avatarImage} fallback={<Silhouette />} />
        </span>
        <span class={`${styles.coin} num`} title="Account level">
          {self()?.account_level ?? "–"}
        </span>
        <div class={styles.profileText}>
          <span class={styles.profileName} data-sensitive>
            {ownRiotId()?.name ?? "Not connected"}
          </span>
          <span class={styles.profileEmblem}>
            <Art src={view()?.rank.icon} class={styles.profileEmblemIcon} fallback={<span class={styles.profileEmblemEmpty} />} />
          </span>
          <div class={styles.xpRow}>
            <span>
              <b>{view()?.rank.name ?? "Unranked"}</b> {rr()} RR
            </span>
            <span class={styles.xpNext}>Next: {100 - rr()} RR</span>
          </div>
          <div class={styles.xpBar}>
            <i style={{ width: `${rr()}%` }} />
          </div>
        </div>
      </div>
      <div class={styles.profileStats}>
        <span title="Wins this act">
          <Trophy size={14} />
          <b class="num">{view()?.wins ?? 0}</b>
        </span>
        <span title="Games this act">
          <Swords size={14} />
          <b class="num">{view()?.games ?? 0}</b>
        </span>
        <span title="Win rate">
          <Percent size={14} />
          <b class="num">{winRate()}</b>
        </span>
      </div>
    </section>
  );
}

// ---- store strip ------------------------------------------------------------------------

const OFFERS_PER_PAGE = 2;

/** `2 Days 11 Hours 32 Mins 22 Secs`. */
function longCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days} Days ${hours} Hours ${minutes} Mins ${seconds % 60} Secs`;
}

export function CsgoStore(_props: PieceProps) {
  useLoaded();
  const navigate = useNavigate();
  const now = useNow(1000);
  const [page, setPage] = createSignal(0);
  const view = () => storeView.value();
  const bundle = () => view()?.bundles[0];
  const offers = () => view()?.daily ?? [];
  const pageCount = () => Math.max(1, Math.ceil(offers().length / OFFERS_PER_PAGE));
  // Clamped: a store refresh can leave fewer pages than the one open.
  const safePage = () => Math.min(page(), pageCount() - 1);
  const shown = () => offers().slice(safePage() * OFFERS_PER_PAGE, (safePage() + 1) * OFFERS_PER_PAGE);
  const left = () => {
    const current = view();
    const featured = bundle();
    return current && featured ? featured.ends_in_s - (now() - current.observed_at_ms) / 1000 : 0;
  };
  const turn = (step: 1 | -1) => {
    playCue("tab");
    setPage((current) => (Math.min(current, pageCount() - 1) + step + pageCount()) % pageCount());
  };
  const openStore = () => {
    playCue("confirm");
    navigate("/store");
  };
  return (
    <section class={styles.strip}>
      <article class={styles.feature}>
        <Art src={bundle()?.image} class={styles.featureImage} fallback={<span class={styles.featureImage} />} />
        <div class={styles.featureFoot}>
          <button class={styles.blueButton} onClick={openStore}>
            View your offers
          </button>
          <span class={styles.featureTime}>
            Offers available till:
            <br />
            <span class="num">{longCountdown(left())}</span>
          </span>
        </div>
      </article>
      <For each={shown()}>
        {(item) => (
          <article class={styles.offer}>
            <div class={styles.offerText}>
              <b>{item.name}</b>
              <span>Today's offer in your store.</span>
            </div>
            <Art src={item.image} class={styles.offerImage} fallback={<span class={styles.offerImage} />} />
            <button class={styles.greenButton} onClick={openStore}>
              <span class="num">{(item.discounted_price ?? item.price).toLocaleString()}</span> VP
            </button>
          </article>
        )}
      </For>
      <footer class={styles.pager}>
        <button aria-label="Previous" onClick={() => turn(-1)}>
          <ChevronLeft size={16} />
        </button>
        <For each={Array.from({ length: pageCount() }, (_, index) => index)}>
          {(index) => <i data-active={index === safePage() ? "" : undefined} />}
        </For>
        <button aria-label="Next" onClick={() => turn(1)}>
          <ChevronRight size={16} />
        </button>
      </footer>
    </section>
  );
}

// ---- friends / party panel --------------------------------------------------------------

type SocialTab = "friends" | "party";

export function CsgoSocial(_props: PieceProps) {
  const [tab, setTab] = createSignal<SocialTab>("friends");
  const [riotId, setRiotId] = createSignal("");
  const online = () => friends().filter((friend) => friend.status !== "offline");
  const members = () => party()?.members ?? [];
  const openSlots = () => Math.max(0, (party()?.max_size ?? 5) - members().length);
  const pick = (next: SocialTab) => {
    playCue("tab");
    setTab(next);
  };
  const invite = (id: string) => {
    if (id.includes("#")) void partyActions.invite(id);
  };
  return (
    <section class={styles.social}>
      <header class={styles.socialTabs}>
        <button data-active={tab() === "friends" ? "" : undefined} title="Friends online" onClick={() => pick("friends")}>
          <User size={20} />
          <sub class="num">{online().length}</sub>
        </button>
        <button data-active={tab() === "party" ? "" : undefined} title="Your party" onClick={() => pick("party")}>
          <Users size={20} />
          <sub class="num">{members().length}</sub>
        </button>
        <button title="All friends" onClick={() => setDrawerOpen(true)}>
          <UserPlus size={20} />
        </button>
      </header>
      <div class={styles.socialTitle}>{tab() === "friends" ? "Friends online" : "Your party"}</div>
      <div class={styles.socialList}>
        <Switch>
          <Match when={tab() === "friends"}>
            <For each={online()} fallback={<p class={styles.socialEmpty}>Nobody is online.</p>}>
              {(friend) => (
                <div class={styles.socialRow}>
                  <span class={styles.socialAvatar} data-status={friend.status}>
                    <Art src={friend.card_small} class={styles.avatarImage} fallback={<Silhouette />} />
                  </span>
                  <span class={styles.socialText}>
                    <b data-sensitive>{friend.game_name}</b>
                    <span>{friendActivity(friend)}</span>
                  </span>
                  <button class={styles.plus} title="Invite to party" onClick={() => invite(`${friend.game_name}#${friend.tag_line}`)}>
                    +
                  </button>
                </div>
              )}
            </For>
          </Match>
          <Match when={tab() === "party"}>
            <div class={styles.lobby}>
              <span class={styles.lobbyTitle}>{party()?.queue.label ?? "Party"}</span>
              <div class={styles.lobbySlots}>
                <Index each={members()}>
                  {(member) => (
                    <span class={styles.socialAvatar} title={sensitiveTitle(`${member().game_name} · ${member().rank.name}`)}>
                      <Art src={member().card_small ?? member().card_tall} class={styles.avatarImage} fallback={<Silhouette />} />
                    </span>
                  )}
                </Index>
                <For each={Array.from({ length: openSlots() })}>
                  {() => (
                    <button class={styles.plus} title="Invite" onClick={() => setDrawerOpen(true)}>
                      +
                    </button>
                  )}
                </For>
              </div>
              <span class={styles.lobbyLine} data-sensitive>{members().map((member) => member.game_name).join(", ") || "Not connected"}</span>
            </div>
          </Match>
        </Switch>
      </div>
      <form
        class={styles.socialSearch}
        onSubmit={(event) => {
          event.preventDefault();
          invite(riotId().trim());
          setRiotId("");
        }}
      >
        <Search size={15} />
        <input value={riotId()} placeholder="Invite Name#TAG…" onInput={(event) => setRiotId(event.currentTarget.value)} />
      </form>
    </section>
  );
}

// ---- news page --------------------------------------------------------------------------

function openStory(event: MouseEvent, url: string): void {
  event.preventDefault();
  if (!/^https?:/.test(url)) return;
  playCue("confirm");
  void openExternal(url);
}

type NewsTab = "news" | "store" | "matches";
const MORE_NEWS = 5;

/** "2026-10-18T06:00:00Z" as the blog dated its posts: 2026.10.18. */
const blogDate = (iso: string) => iso.slice(0, 10).replaceAll("-", ".");
/** "game_updates" as a blog tag: Game updates. */
const blogTag = (category: string) => {
  const words = category.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const MAP_TILES = 4;
const NEWS_MATCHES = 6;

export function CsgoNews(props: PieceProps) {
  const { rowProps } = useOpenMatch();
  useLoaded();
  const startTab = (): NewsTab => {
    const chosen = props.piece.props["startTab"];
    return chosen === "matches" || chosen === "store" ? chosen : "news";
  };
  onMount(() => {
    if (!newsView.value() && !newsView.isLoading()) void newsView.load();
  });
  const stories = () => newsView.value()?.items ?? [];
  const [tab, setTab] = createSignal<NewsTab>(startTab());
  // Follow the Inspector when the start tab is changed there.
  createEffect(on(startTab, (next) => setTab(next), { defer: true }));
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
  const bundle = () => storeView.value()?.bundles[0];
  const career = () => careerView.value();
  const maps = () => catalog().maps.filter((map) => !map.is_team_deathmatch && map.list_icon).slice(0, MAP_TILES);
  const pick = (next: NewsTab) => {
    playCue("tab");
    setTab(next);
  };
  return (
    <section class={styles.news}>
      <header class={styles.newsHead}>News</header>
      <div class={styles.newsFrame}>
        <div class={styles.page}>
          <nav class={styles.pageTabs}>
            <button data-active={tab() === "news" ? "" : undefined} onClick={() => pick("news")}>
              Blog
            </button>
            <button data-active={tab() === "store" ? "" : undefined} onClick={() => pick("store")}>
              Store
            </button>
            <button data-active={tab() === "matches" ? "" : undefined} onClick={() => pick("matches")}>
              Matches
            </button>
          </nav>
          <div class={styles.pageBody}>
            <article class={styles.article}>
              <Switch>
                <Match when={tab() === "news"}>
                  <Show when={stories()[0]} fallback={<p class={styles.articleText}>{newsView.isLoading() ? "Loading…" : "The news could not be loaded."}</p>}>
                    {(lead) => (
                      <>
                        <h2 class={styles.articleTitle}>{lead().title}</h2>
                        <span class={styles.articleDate}>
                          {blogDate(lead().published_at)} - <b>{blogTag(lead().category)}</b>
                        </span>
                        <Show when={lead().summary}>
                          <p class={styles.articleText}>{lead().summary}</p>
                        </Show>
                        <a class={styles.figure} href={lead().url} onClick={(event) => openStory(event, lead().url)}>
                          <Art src={lead().image} class={styles.figureImage} fallback={<span class={`${styles.figureImage} ${styles.figureEmpty}`}>{lead().title}</span>} />
                          <figcaption>
                            {blogTag(lead().category)} | <b>{lead().title}</b>
                          </figcaption>
                        </a>
                        <h3 class={styles.articleHeading}>More news</h3>
                        <ul class={styles.storyList}>
                          <For each={stories().slice(1, 1 + MORE_NEWS)}>
                            {(story) => (
                              <li>
                                <a href={story.url} onMouseEnter={() => playCue("hover")} onClick={(event) => openStory(event, story.url)}>
                                  <Art src={story.image} class={styles.storyImage} fallback={<span class={styles.storyImage} />} />
                                  <span>
                                    <b>{story.title}</b>
                                    <small>
                                      {blogDate(story.published_at)} - {blogTag(story.category)}
                                    </small>
                                  </span>
                                </a>
                              </li>
                            )}
                          </For>
                        </ul>
                      </>
                    )}
                  </Show>
                </Match>
                <Match when={tab() === "store"}>
                  <Show when={bundle()} fallback={<p class={styles.articleText}>{storeView.isLoading() ? "Loading…" : "Connect to VALORANT to see the store."}</p>}>
                    {(featured) => (
                      <>
                        <h2 class={styles.articleTitle}>{featured().name}</h2>
                        <span class={styles.articleDate}>
                          {today} - <b>VP</b>
                        </span>
                        <p class={styles.articleText}>
                          Featured in your store for {formatDuration(featured().ends_in_s)}: {featured().items.length} items for{" "}
                          {(featured().discounted_price ?? featured().price).toLocaleString()} VP.
                        </p>
                        <h3 class={styles.articleHeading}>Today's offers</h3>
                        <p class={styles.articleText}>{storeView.value()?.daily.map((item) => item.name).join(", ")}</p>
                        <figure class={styles.figure}>
                          <Art
                            src={featured().image}
                            class={styles.figureImage}
                            fallback={<span class={`${styles.figureImage} ${styles.figureEmpty}`}>{featured().name}</span>}
                          />
                          <figcaption>
                            {featured().name} | <b>{featured().items[0]?.name ?? "Bundle"}</b>
                          </figcaption>
                        </figure>
                      </>
                    )}
                  </Show>
                </Match>
                <Match when={tab() === "matches"}>
                  <h2 class={styles.articleTitle}>Your last ranked games</h2>
                  <span class={styles.articleDate}>
                    {today} - <b>RR</b>
                  </span>
                  <ul class={styles.matchList}>
                    <For each={career()?.updates.slice(0, NEWS_MATCHES) ?? []} fallback={<li>No ranked games yet.</li>}>
                      {(update) => (
                        <li {...rowProps(update.match_id)}>
                          <Art src={update.map_image} class={styles.matchImage} fallback={<span class={styles.matchImage} />} />
                          <span>{update.map_name}</span>
                          <b class="num" data-down={update.rr_earned < 0 ? "" : undefined}>
                            {update.rr_earned > 0 ? "+" : ""}
                            {update.rr_earned}
                          </b>
                        </li>
                      )}
                    </For>
                  </ul>
                </Match>
              </Switch>
            </article>
            <aside class={styles.pageSide}>
              <div class={styles.bigStat}>
                <b class="num">{(career()?.wins ?? 0).toLocaleString()}</b>
                <span>Wins this act</span>
              </div>
              <div class={styles.sideCard}>
                <b>Your rank</b>
                <span>{career()?.rank.name ?? "Unranked"}</span>
              </div>
              <For each={maps()}>
                {(map) => (
                  <div class={styles.mapTile} style={{ "--tile": `url("${map.list_icon}")` }}>
                    <span>{map.display_name}</span>
                  </div>
                )}
              </For>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
