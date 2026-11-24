// The three VALORANT eras' own Modes, Rank and Profile. The client kept the same parts across
// eras (a rank emblem over its RR bar, the player card beside the name and title, modes as a
// tab row over the picked mode), and changed their material, so each era is one stylesheet on
// the same markup: the current client (valHome), the 2020 closed beta (betaHome) and 2022 (v22Home).
import { Index, Show } from "solid-js";
import { playCue } from "~/menu/sound";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { QUEUE_BLURBS } from "~/pieces/play";
import { rankLabel, rankPending, rankProgress, rrText, useProfile, useRank } from "./homeData";
import { type PlayState, usePlay } from "./usePlay";
import beta from "./betaHome.module.css";
import v22 from "./v22Home.module.css";
import val from "./valHome.module.css";

type Sheet = Record<string, string>;

function RankBlock(props: { css: Sheet; heading: string }) {
  const view = useRank();
  return (
    <section class={props.css["card"]}>
      <Show when={view()} fallback={<span class={props.css["small"]}>{rankPending()}</span>}>
        {(career) => (
          <>
            <Art src={career().rank.icon} class={props.css["emblem"]} fallback={<span class={props.css["emblem"]} />} />
            <div class={props.css["body"]}>
              <span class={props.css["small"]}>{props.heading}</span>
              <b class={props.css["name"]}>{rankLabel(career())}</b>
              <span class={props.css["bar"]} style={{ "--progress": rankProgress(career()) }} />
              <span class={props.css["small"]}>{rrText(career())}</span>
            </div>
          </>
        )}
      </Show>
    </section>
  );
}

function ProfileBlock(props: { css: Sheet }) {
  const profile = useProfile();
  return (
    <section class={props.css["card"]}>
      <Art
        src={profile.member()?.card_small}
        class={props.css["portrait"]}
        fallback={<span class={props.css["portrait"]} />}
      />
      <div class={props.css["body"]}>
        <b class={props.css["name"]} data-sensitive>
          {profile.name()}
          <Show when={profile.tag()}>
            <small class={props.css["tag"]}>#{profile.tag()}</small>
          </Show>
        </b>
        <Show when={profile.member()?.title}>{(title) => <span class={props.css["small"]}>{title()}</span>}</Show>
        <span class={props.css["level"]}>{profile.level()}</span>
      </div>
    </section>
  );
}

/** The picked mode under the tabs, as the client shows it: its art, name and one-line blurb. */
function ModeDetail(props: { css: Sheet; play: PlayState }) {
  return (
    <Show when={props.play.current()}>
      {(queue) => (
        <div class={props.css["detail"]}>
          <Art src={queue().art} class={props.css["detailArt"]} fallback={null} />
          <b class={props.css["detailName"]}>{queue().label}</b>
          <Show when={QUEUE_BLURBS[queue().id]}>
            {(blurb) => <span class={props.css["small"]}>{blurb()}</span>}
          </Show>
        </div>
      )}
    </Show>
  );
}

function ModesBlock(props: { css: Sheet }) {
  const play = usePlay();
  return (
    <section class={props.css["modes"]}>
      <div class={props.css["tabs"]} role="tablist">
        <Index each={play.queues()}>
          {(queue) => (
            <button
              role="tab"
              aria-selected={queue().id === play.current()?.id}
              class={props.css["mode"]}
              data-active={queue().id === play.current()?.id ? "" : undefined}
              disabled={!play.isOwner() || play.searchClock() !== null}
              onMouseEnter={() => playCue("hover")}
              onClick={() => play.pickQueue(queue())}
            >
              {queue().label}
            </button>
          )}
        </Index>
      </div>
      <ModeDetail css={props.css} play={play} />
    </section>
  );
}

export const ValRank = (_props: PieceProps) => <RankBlock css={val} heading="Competitive" />;
export const ValProfile = (_props: PieceProps) => <ProfileBlock css={val} />;
export const BetaModes = (_props: PieceProps) => <ModesBlock css={beta} />;
export const BetaRank = (_props: PieceProps) => <RankBlock css={beta} heading="Competitive · beta" />;
export const V22Modes = (_props: PieceProps) => <ModesBlock css={v22} />;
export const V22Rank = (_props: PieceProps) => <RankBlock css={v22} heading="Competitive" />;
export const V22Profile = (_props: PieceProps) => <ProfileBlock css={v22} />;
