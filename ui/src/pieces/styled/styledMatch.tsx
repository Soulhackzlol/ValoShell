// Agent select and Lobby markup that every style dresses with its own sheet and words. The
// parts stay the same in every game the styles echo (a hero, a roster grid and a lock-in bar;
// two team columns of player lines), so the difference lives in each style's
// <style>Match.module.css, not in thirteen copies of the logic (matchData.ts).
import { For, Index, Show } from "solid-js";
import type { AgentCard } from "~/bindings/AgentCard";
import type { LobbyPlayerView } from "~/bindings/LobbyPlayerView";
import type { RankBadge } from "~/bindings/RankBadge";
import { playCue } from "~/menu/sound";
import { rankColor } from "~/pieces/home";
import { lobby } from "~/state/lobby";
import type { PieceProps } from "~/studio/registry";
import { Art } from "~/ui/Art";
import { useConfirmPress } from "~/ui/confirmPress";
import { partyLabel, stackColor } from "~/ui/stacks";
import { type PickState, hasLobbyRr, lobbyName, lobbyRank, pickRoster, usePick } from "./matchData";

export type Sheet = Record<string, string>;

/** What a style calls things on these screens ("LOCK IN", "lock-in", "Ready"...). */
export interface MatchWords {
  lock: string;
  locked: string;
  dodge: string;
  /** The dodge button once pressed: a second press within a few seconds leaves the match. */
  dodgeArmed: string;
  allies: string;
  enemies: string;
  waitingPick: string;
  waitingLobby: string;
}

export const VALORANT_WORDS: MatchWords = {
  lock: "Lock in",
  locked: "Locked in",
  dodge: "Dodge",
  dodgeArmed: "Click again to dodge",
  allies: "Your team",
  enemies: "Enemy team",
  waitingPick: "Your roster appears in agent select.",
  waitingLobby: "Everyone in your match appears here once one starts.",
};

function Tile(props: { agent: AgentCard; pick: PickState; css: Sheet }) {
  const block = () => props.pick.blockOf(props.agent);
  return (
    <button
      class={props.css["tile"]}
      data-part="pick-tile"
      data-own={props.pick.own() === props.agent.uuid ? "" : undefined}
      data-block={block() ?? undefined}
      disabled={block() !== null}
      title={block() === "unowned" ? `${props.agent.display_name} (not unlocked)` : props.agent.display_name}
      onMouseEnter={() => {
        props.pick.hover(props.agent.uuid);
        playCue("hover");
      }}
      onMouseLeave={() => props.pick.hover(null)}
      onClick={() => props.pick.select(props.agent)}
    >
      <Art
        src={props.agent.icon}
        class={props.css["tileArt"]}
        fallback={<span>{props.agent.display_name.slice(0, 2)}</span>}
      />
    </button>
  );
}

function PickBar(props: { pick: PickState; css: Sheet; words: MatchWords }) {
  const dodge = useConfirmPress(() => props.pick.dodge());
  return (
    <footer class={props.css["bar"]}>
      <button
        class={props.css["dodge"]}
        disabled={props.pick.isLocked()}
        title="Leave this match (dodge penalty applies)"
        data-armed={dodge.isArmed() ? "" : undefined}
        onClick={() => dodge.press()}
      >
        {dodge.isArmed() ? props.words.dodgeArmed : props.words.dodge}
      </button>
      <span class={props.css["timer"]}>{props.pick.secondsLeft()}</span>
      <button
        class={props.css["lock"]}
        data-part="pick-lock"
        data-locked={props.pick.isLocked() ? "" : undefined}
        disabled={props.pick.isLocked() || !props.pick.own()}
        onClick={() => props.pick.lock()}
      >
        {props.pick.isLocked() ? props.words.locked : props.words.lock}
      </button>
    </footer>
  );
}

function MatchPick(props: { css: Sheet; words: MatchWords }) {
  const pick = usePick();
  return (
    <Show when={pick.view()} fallback={<p class={props.css["empty"]}>{props.words.waitingPick}</p>}>
      {(view) => (
        <section class={props.css["pick"]} data-part="pick-board">
          <header class={props.css["head"]}>
            <b>{view().map_name}</b>
            <span>{view().queue_label}</span>
          </header>
          <div class={props.css["hero"]} data-locked={pick.isLocked() ? "" : undefined}>
            <Art
              src={pick.shown()?.portrait}
              class={props.css["heroArt"]}
              fallback={<span class={props.css["heroArt"]} />}
            />
            <b class={props.css["heroName"]}>{pick.shown()?.display_name ?? "Pick an agent"}</b>
            <span class={props.css["heroRole"]}>{pick.shown()?.role ?? ""}</span>
          </div>
          <div class={props.css["roster"]}>
            <For each={pickRoster()}>
              {(group) => (
                <div class={props.css["group"]}>
                  <span class={props.css["groupName"]}>{group.role}</span>
                  <For each={group.agents}>{(agent) => <Tile agent={agent} pick={pick} css={props.css} />}</For>
                </div>
              )}
            </For>
          </div>
          <PickBar pick={pick} css={props.css} words={props.words} />
        </section>
      )}
    </Show>
  );
}

function LobbyLine(props: { player: LobbyPlayerView; css: Sheet }) {
  const player = () => props.player;
  return (
    <li
      class={props.css["line"]}
      data-self={player().is_self ? "" : undefined}
      style={{ "--stack": stackColor(player().stack_group), "--rank": rankColor(player().rank.color) }}
    >
      <Art
        src={player().agent_icon}
        class={props.css["lineAgent"]}
        fallback={<span class={props.css["lineAgent"]} />}
      />
      <span class={props.css["lineName"]} data-sensitive>
        {lobbyName(player())}
        <Show when={partyLabel(player().stack_size)}>
          {(party) => <small class={props.css["stack"]}>{party()}</small>}
        </Show>
      </span>
      <span class={props.css["lineRank"]}>
        <Art src={player().is_rank_hidden ? null : player().rank.icon} class={props.css["rankIcon"]} fallback={null} />
        {lobbyRank(player())}
        <Show when={hasLobbyRr(player())}>
          <small> {player().rr} RR</small>
        </Show>
      </span>
    </li>
  );
}

function Team(props: { title: string; players: LobbyPlayerView[]; average: RankBadge | null; css: Sheet }) {
  return (
    <section class={props.css["team"]}>
      <header class={props.css["teamHead"]}>
        <b>{props.title}</b>
        <Show when={props.average}>{(average) => <span>avg {average().name}</span>}</Show>
      </header>
      <ol class={props.css["lines"]}>
        <Index each={props.players}>{(player) => <LobbyLine player={player()} css={props.css} />}</Index>
      </ol>
    </section>
  );
}

function MatchLobby(props: { css: Sheet; words: MatchWords }) {
  return (
    <Show when={lobby()} fallback={<p class={props.css["empty"]}>{props.words.waitingLobby}</p>}>
      {(view) => (
        <section class={props.css["lobby"]}>
          <header class={props.css["head"]}>
            <b>{view().map_name}</b>
            <span>{view().is_live ? (view().is_pregame ? "Agent select" : "Live") : "Last match"}</span>
            <span>{view().queue_label}</span>
          </header>
          <div class={props.css["teams"]}>
            <Team title={props.words.allies} players={view().allies} average={view().ally_average} css={props.css} />
            <Show when={view().enemies.length > 0}>
              <Team
                title={props.words.enemies}
                players={view().enemies}
                average={view().enemy_average}
                css={props.css}
              />
            </Show>
          </div>
        </section>
      )}
    </Show>
  );
}

/** A style's Agent select and Lobby pieces from its sheet and words. */
export function matchLooks(css: Sheet, words: MatchWords) {
  return {
    Pick: (_props: PieceProps) => <MatchPick css={css} words={words} />,
    Lobby: (_props: PieceProps) => <MatchLobby css={css} words={words} />,
  };
}
