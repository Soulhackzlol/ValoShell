// News, Progress and Chat markup that every style dresses with the sheet its Agent select and
// Lobby use (<style>Match.module.css: the panel, title strip, rows and buttons), so these
// screens share one material with the rest of the style. Layout lives in screenBase.module.css.
// News opens only https links; the chat line sends to party chat (chatLine.ts).
import { For, Show, onMount } from "solid-js";
import { MessageSquare } from "lucide-solid";
import type { MissionView } from "~/bindings/MissionView";
import type { NewsItem } from "~/bindings/NewsItem";
import type { ProgressView } from "~/bindings/ProgressView";
import { playCue } from "~/menu/sound";
import { openExternal } from "~/pieces/widgets";
import { newsView, progressView } from "~/state/views";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { ChatFrame, ChatUnread } from "./chatFrame";
import { useChatLine } from "./chatLine";
import { XP_PER_LEVEL, daysLeft, fillOf, isOpenableLink, storyDate } from "./screenData";
import type { Sheet } from "./styledMatch";
import base from "./screenBase.module.css";

const NEWS_ROWS = 6;
const CHAT_ICON_PX = 15;

/** What a style calls things on these screens ("Patch notes", "news --latest", "say_team"...). */
export interface ScreenWords {
  news: string;
  patch: string;
  pass: string;
  daily: string;
  weekly: string;
  chat: string;
  placeholder: string;
}

export const VALORANT_SCREEN_WORDS: ScreenWords = {
  news: "News",
  patch: "Patch notes",
  pass: "Battle pass",
  daily: "Daily",
  weekly: "Weekly",
  chat: "Party",
  placeholder: "Say something",
};

function Meter(props: { fill: number; css: Sheet }) {
  return (
    <span class={`${base.meter} ${props.css["meter"] ?? ""}`}>
      <i style={{ "--fill": props.fill }} />
    </span>
  );
}

function open(url: string): void {
  if (!isOpenableLink(url)) return;
  playCue("confirm");
  void openExternal(url);
}

function Story(props: { item: NewsItem; css: Sheet }) {
  return (
    <li>
      <button
        class={`${base.story} ${props.css["line"]}`}
        disabled={!isOpenableLink(props.item.url)}
        onMouseEnter={() => playCue("hover")}
        onClick={() => open(props.item.url)}
      >
        <Art src={props.item.image} class={base.storyArt} fallback={<span class={base.storyArt} />} />
        <span class={base.storyText}>
          <b class={props.css["lineName"]}>{props.item.title}</b>
          <Show when={props.item.summary}>
            <small class={base.storySummary}>{props.item.summary}</small>
          </Show>
        </span>
        <small class={props.css["lineRank"]}>{storyDate(props.item.published_at)}</small>
      </button>
    </li>
  );
}

function StyledNews(props: { css: Sheet; words: ScreenWords }) {
  onMount(() => {
    if (!newsView.value() && !newsView.isLoading()) void newsView.load();
  });
  const empty = () => (newsView.isLoading() ? "…" : "The news shows once playvalorant.com can be read.");
  return (
    <Show when={newsView.value()?.items.length} fallback={<p class={props.css["empty"]}>{empty()}</p>}>
      <section class={`${props.css["lobby"]} ${base.screen}`}>
        <header class={props.css["head"]}>
          <b>{props.words.news}</b>
          <Show when={newsView.value()?.patch_url}>
            {(url) => (
              <button class={`${props.css["dodge"]} ${base.push}`} onClick={() => open(url())}>
                {props.words.patch} {newsView.value()?.patch_version ?? ""}
              </button>
            )}
          </Show>
        </header>
        <ol class={base.stories}>
          <For each={newsView.value()?.items.slice(0, NEWS_ROWS)}>
            {(item) => <Story item={item} css={props.css} />}
          </For>
        </ol>
      </section>
    </Show>
  );
}

function Missions(props: { title: string; missions: MissionView[]; css: Sheet }) {
  return (
    <Show when={props.missions.length > 0}>
      <section class={props.css["team"]}>
        <header class={props.css["teamHead"]}>
          <b>{props.title}</b>
        </header>
        <For each={props.missions}>
          {(mission) => (
            <div class={`${base.mission} ${props.css["line"]}`} data-done={mission.is_complete ? "" : undefined}>
              <span class={props.css["lineName"]}>{mission.title}</span>
              <small class={props.css["lineRank"]}>+{mission.xp.toLocaleString()} XP</small>
              <Meter fill={fillOf(mission.done, mission.goal)} css={props.css} />
            </div>
          )}
        </For>
      </section>
    </Show>
  );
}

function Pass(props: { view: ProgressView; css: Sheet; words: ScreenWords }) {
  return (
    <section class={`${props.css["team"]} ${base.pass}`}>
      <header class={props.css["teamHead"]}>
        <b>{props.words.pass}</b>
        <span>Level {props.view.account_level}</span>
      </header>
      <Meter fill={fillOf(props.view.account_xp, XP_PER_LEVEL)} css={props.css} />
      <Show when={props.view.battle_pass}>
        {(pass) => (
          <div class={`${base.reward} ${props.css["line"]}`}>
            <Art src={pass().next_reward?.image} class={base.rewardArt} fallback={<span class={base.rewardArt} />} />
            <small class={props.css["lineRank"]}>{pass().name}</small>
            <b class={props.css["lineName"]}>{pass().next_reward?.name ?? "Every tier done"}</b>
            <small class={props.css["lineRank"]}>
              Tier {pass().tier} / {pass().tier_count}
              <Show when={daysLeft(pass()) !== null}> · {daysLeft(pass())} days left</Show>
            </small>
            <Meter fill={fillOf(pass().tier, pass().tier_count)} css={props.css} />
          </div>
        )}
      </Show>
    </section>
  );
}

function StyledProgress(props: { css: Sheet; words: ScreenWords }) {
  onMount(() => {
    if (!progressView.value() && !progressView.isLoading()) void progressView.load();
  });
  const empty = () => (progressView.isLoading() ? "…" : "Your progress shows once VALORANT is open.");
  return (
    <Show when={progressView.value()} fallback={<p class={props.css["empty"]}>{empty()}</p>}>
      {(view) => (
        <section class={`${props.css["lobby"]} ${base.screen}`}>
          <div class={base.progress}>
            <Pass view={view()} css={props.css} words={props.words} />
            <div class={base.missionLists}>
              <Missions title={props.words.daily} missions={view().daily_missions} css={props.css} />
              <Missions title={props.words.weekly} missions={view().weekly_missions} css={props.css} />
            </div>
          </div>
        </section>
      )}
    </Show>
  );
}

function StyledChat(props: { css: Sheet; words: ScreenWords; label: string }) {
  const line = useChatLine();
  return (
    <ChatFrame line={line}>
      <form
        class={`${base.chat} ${props.css["field"] ?? ""}`}
        data-sending={line.isSending() ? "" : undefined}
        onSubmit={(event) => {
          event.preventDefault();
          line.submit();
        }}
      >
        <span class={base.chatLabel}>{props.label || props.words.chat}</span>
        <input
          class={base.chatInput}
          value={line.text()}
          spellcheck={false}
          disabled={!line.canSend()}
          onInput={(event) => line.onInput(event.currentTarget.value)}
          onKeyDown={(event) => line.onKeyDown(event)}
          placeholder={line.placeholder(props.words.placeholder)}
        />
        <button
          type="button"
          data-part="chat-open"
          class={base.chatOpen}
          title="Open chat"
          aria-label="Open chat"
          onClick={() => line.openChat()}
        >
          <MessageSquare size={CHAT_ICON_PX} />
          <ChatUnread line={line} />
        </button>
      </form>
    </ChatFrame>
  );
}

function labelOf(props: PieceProps): string {
  const label = props.piece.props["label"];
  return typeof label === "string" ? label.trim() : "";
}

/** A style's News, Progress and Chat pieces from its sheet and words. */
export function screenLooks(css: Sheet, words: ScreenWords) {
  return {
    News: (_props: PieceProps) => <StyledNews css={css} words={words} />,
    Progress: (_props: PieceProps) => <StyledProgress css={css} words={words} />,
    Chat: (props: PieceProps) => <StyledChat css={css} words={words} label={labelOf(props)} />,
  };
}
