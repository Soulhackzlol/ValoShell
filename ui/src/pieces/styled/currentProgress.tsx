// VALORANT (current client) Progress and mode-select pieces. Progress copies the client's
// page: daily checkpoints and weekly missions on the left, the battlepass reward up top and
// the objectives row below. It shows the player's real battle pass and weekly missions; with
// "Use my real progress" off (or offline) the figures are props the player sets instead.
// Daily checkpoints are always props: Riot's daily-ticket answer is not verified yet. With real
// progress the two agent tiles show the recruitment event and agent contracts instead.
import { For, Index, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Lock } from "lucide-solid";
import type { PieceProps } from "~/studio/registry";
import { playCue } from "~/menu/sound";
import { catalog } from "~/state/catalog";
import { type Loadable, progressView, storeView } from "~/state/views";
import { Art } from "~/ui/Art";
import { usePlay } from "./usePlay";
import { colorVars, textProp } from "./current";
import { AgentObjectives } from "./currentProgressAgents";
import { PassGlyph, KcCoin, VpCoin } from "./valIcons";
import { type TextKey, groupNumber, queueName, vt } from "./valText";
import styles from "./currentProgress.module.css";

function num(props: PieceProps, key: string, fallback: number): number {
  const value = props.piece.props[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Not loaded, not loading and not failed: the only state worth starting a load from. */
function isUnloaded(view: Pick<Loadable<unknown>, "value" | "isLoading" | "error">): boolean {
  return !view.value() && !view.isLoading() && !view.error();
}

function str(props: PieceProps, key: string, fallback = ""): string {
  const value = props.piece.props[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

const DAY_MS = 86_400_000;

/** The next daily (00:00 UTC) or weekly (Tuesday) reset, when Riot did not name one. */
function nextReset(now: number, isWeekly: boolean): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  if (isWeekly) while (next.getUTCDay() !== 2) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

/** `12:27:05` / `5:13:41:40` until `at`. */
function untilReset(now: number, at: number): string {
  let seconds = Math.max(0, Math.floor((at - now) / 1000));
  const days = Math.floor(seconds / 86_400);
  seconds -= days * 86_400;
  const pad = (value: number) => value.toString().padStart(2, "0");
  const clock = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return days > 0 ? `${days}:${clock}` : clock;
}

interface Weekly {
  label: string;
  done: number;
  goal: number;
  xp: number;
}

/** The hand-set weekly missions: text, the prop holding progress, goal. */
const SET_WEEKLY: ReadonlyArray<[TextKey, string, number]> = [
  ["useAbilities", "abilities", 200],
  ["dealDamage", "damage", 18_000],
  ["useUltimate", "ultimates", 15],
];
const SET_WEEKLY_XP = 18_500;

export function ValProgress(props: PieceProps) {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => window.clearInterval(timer));
  const isLive = () => props.piece.props["isLive"] !== false;
  // An effect, not onMount: flipping "Use my real progress" in Studio loads what it needs. A
  // failed load is not retried here (that would loop); views.ts reloads it on reconnect.
  createEffect(() => {
    if (isLive() && isUnloaded(progressView)) void progressView.load();
    if (!isLive() && isUnloaded(storeView)) void storeView.load();
  });
  const live = () => (isLive() ? progressView.value() : null);
  const pass = () => live()?.battle_pass ?? null;
  const weekly = (): Weekly[] => {
    const missions = live()?.weekly_missions;
    if (missions) return missions.map((mission) => ({ label: mission.title, done: mission.done, goal: mission.goal, xp: mission.xp }));
    return SET_WEEKLY.map(([text, key, goal]) => ({ label: vt(text), done: num(props, key, 0), goal, xp: SET_WEEKLY_XP }));
  };
  const weeklyReset = () => Date.parse(live()?.weekly_refill_at ?? "") || nextReset(now(), true);
  const tier = () => pass()?.tier ?? num(props, "tier", 16);
  const tierMax = () => pass()?.tier_count ?? num(props, "tierMax", 50);
  const xpLeft = () => pass()?.xp_left ?? num(props, "xpLeft", 7450);
  const season = () => pass()?.name ?? str(props, "season", vt("season"));
  const daysLeft = () => {
    const endsAt = Date.parse(pass()?.ends_at ?? "");
    return Number.isNaN(endsAt) ? num(props, "daysLeft", 76) : Math.max(0, Math.ceil((endsAt - now()) / DAY_MS));
  };
  const reward = () => (pass() ? (pass()?.next_reward?.name ?? "") : str(props, "reward", "Ghost Datalink"));
  const rewardImage = () => {
    if (pass()) return pass()?.next_reward?.image ?? null;
    return str(props, "rewardImage") || storeView.value()?.daily[0]?.image || null;
  };
  const needsPremium = () => pass()?.is_premium_owned !== true;
  const agent = () => str(props, "agent", "Brimstone");
  return (
    <div class={styles.page} style={colorVars(props, ["accent", "panel"])}>
      <section class={styles.missions}>
        <h2 class={styles.heading}>{vt("missions")}</h2>
        <div class={styles.box}>
          <header class={styles.boxHead}>
            <b>{vt("dailyMissions")}</b>
            <span>
              {vt("refreshesIn")} {untilReset(now(), nextReset(now(), false))}
            </span>
          </header>
          <p class={styles.boxNote}>{vt("dailyReward")}</p>
          <div class={styles.checkpoints}>
            <Index each={[1, 2, 3, 4]}>
              {(point) => (
                <span class={styles.checkpoint} data-done={point() <= num(props, "checkpoints", 0) ? "" : undefined}>
                  <b>{point()}</b>
                </span>
              )}
            </Index>
          </div>
          <div class={styles.checkpointBars}>
            <i />
            <i />
            <i />
          </div>
          <header class={styles.boxHead} data-weekly="">
            <b>{vt("weeklyMissions")}</b>
            <span>
              {vt("refreshesIn")} {untilReset(now(), weeklyReset())}
            </span>
          </header>
          <For each={weekly()}>
            {(mission) => (
              <div class={styles.weekly}>
                <i class={styles.weeklyMark} />
                <div class={styles.weeklyBody}>
                  <span>{mission.label}</span>
                  <span class={styles.bar}>
                    <i style={{ width: `${Math.min(100, (mission.done / Math.max(1, mission.goal)) * 100)}%` }} />
                  </span>
                  <span class={styles.weeklyNumbers}>
                    <span>
                      {groupNumber(mission.done)}/{groupNumber(mission.goal)}
                    </span>
                    <b>
                      +{groupNumber(mission.xp)} {vt("xp")}
                    </b>
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </section>
      <section class={styles.pass}>
        <h2 class={styles.heading}>{vt("battlepass")}</h2>
        <div class={styles.passBox}>
          <span class={styles.season}>{season()}</span>
          <span class={styles.ends}>
            {vt("endsIn")} <b>{daysLeft()} {vt("days")}</b>
          </span>
          <Art src={rewardImage()} class={styles.reward} fallback={<span />} />
          <Show when={needsPremium()}>
            <span class={styles.premium}>
              <Lock size={16} /> {vt("premiumNeeded")}
            </span>
          </Show>
          <span class={styles.rewardName}>{reward()}</span>
          <div class={styles.tierRow}>
            <PassGlyph size={22} />
            <span>
              {vt("tier")} {tier()} / {tierMax()}
            </span>
            <span class={styles.xpLeft}>
              {vt("xpLeft")}: {groupNumber(xpLeft())}
            </span>
          </div>
          <span class={styles.tierBar}>
            <i style={{ width: `${Math.min(100, (tier() / Math.max(1, tierMax())) * 100)}%` }} />
          </span>
          <Show when={needsPremium()}>
            <button class={styles.upgrade} disabled>
              <span>
                <VpCoin size={18} /> 1000
              </span>
              <small>{vt("upgradePass")}</small>
            </button>
          </Show>
        </div>
        <h2 class={styles.heading}>{vt("objectives")}</h2>
        <div class={styles.objectives}>
          <div class={styles.objective}>
            <b>{vt("battlepass")}</b>
            <small>
              {vt("tier").toUpperCase()}: {tier()} / 20
            </small>
            <span class={styles.segments}>
              <Index each={[0, 1, 2, 3, 4]}>{(index) => <i data-on={index() < 1 ? "" : undefined} />}</Index>
            </span>
            <span class={styles.objectiveIcon} data-free="">
              {vt("free")}
            </span>
          </div>
          <Show
            when={live()}
            fallback={
              <For each={[5000, 2500]}>
                {(cost) => (
                  <div class={styles.objective} data-locked="">
                    <b>
                      {vt("rewards")} {agent()}
                    </b>
                    <small>
                      {vt("unlockWith")} <KcCoin size={12} /> {cost}
                    </small>
                    <span class={styles.objectiveIcon}>
                      <Lock size={20} />
                    </span>
                  </div>
                )}
              </For>
            }
          >
            {(view) => <AgentObjectives view={view()} now={now()} />}
          </Show>
        </div>
      </section>
    </div>
  );
}

// ---- mode select ---------------------------------------------------------------------------

export function ValModes(props: PieceProps) {
  const play = usePlay();
  const navigate = useNavigate();
  // A different map behind every mode, spread across the pool so neighbours never match.
  const splash = (index: number) => {
    const maps = catalog().maps.filter((map) => map.splash && !map.is_team_deathmatch);
    return maps.length ? (maps[(index * 5 + 1) % maps.length]?.splash ?? null) : null;
  };
  return (
    <div class={styles.modes} style={colorVars(props, ["accent"])}>
      <h2 class={styles.modesTitle}>{textProp(props, "title", "pickMode")}</h2>
      <div class={styles.modeGrid}>
        <For each={play.queues()}>
          {(queue, index) => (
            <button
              class={styles.modeTile}
              data-active={play.current()?.id === queue.id ? "" : undefined}
              disabled={!play.isOwner()}
              onMouseEnter={() => playCue("hover")}
              onClick={() => {
                play.pickQueue(queue);
                if (props.piece.props["backOnPick"] !== false) navigate("/home");
              }}
            >
              <Art src={splash(index())} class={styles.modeImage} fallback={<span class={styles.modeEmpty} />} />
              <span class={styles.modeShade} />
              <span class={styles.modeName}>{queueName(queue.id, queue.label)}</span>
            </button>
          )}
        </For>
      </div>
      <Show when={play.queues().length === 0}>
        <p class={styles.modesEmpty}>{vt("offline")}</p>
      </Show>
    </div>
  );
}
