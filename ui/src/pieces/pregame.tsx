// Agent-select pieces: the header (map, mode, timer) and the ally roster. The agent picker
// with LOCK IN lives in agentPicker.tsx.
import { Index, Show, createSignal, onCleanup } from "solid-js";
import type { PieceProps } from "~/studio/registry";
import { agentByUuid } from "~/state/catalog";
import { pregame, timeLeft } from "~/state/pregame";
import { Empty } from "~/ui/controls";
import { rankColor } from "./home";
import styles from "./pregame.module.css";
import { Art } from "~/ui/Art";

/** A CSS `url()` for art, or `none`; layouts paint with it (the map banner, agent banners). */
export function cssUrl(src: string | null): string {
  return src ? `url("${src}")` : "none";
}

function useTick(intervalMs: number): () => number {
  const [now, setNow] = createSignal(Date.now());
  const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
  onCleanup(() => window.clearInterval(timer));
  return now;
}

export function PregameHeader(_props: PieceProps) {
  const now = useTick(200);
  return (
    <Show when={pregame()} fallback={<Empty title="Agent select">Appears here when a match is found.</Empty>}>
      {(view) => {
        const seconds = () => timeLeft(view(), now());
        return (
          <div
            class={styles.header}
            data-part="pregame-header"
            style={{ "--map-splash": cssUrl(view().map_splash) }}
          >
            <span class={styles.headerMode}>
              {view().queue_label}
              <Show when={view().team_id}>
                <span class={styles.side}>{view().team_id === "Blue" ? "Attack first" : "Defend first"}</span>
              </Show>
            </span>
            <span class={styles.headerMap}>{view().map_name}</span>
            <span class={`${styles.timer} num`} data-low={seconds() < 10 ? "" : undefined}>
              {Math.ceil(seconds())}
            </span>
            <span class={styles.enemy}>
              Enemy locked <b class="num">{view().enemy_lock_count}</b>/
              <span class="num">{view().enemy_team_size || 5}</span>
            </span>
          </div>
        );
      }}
    </Show>
  );
}

export function AllyRoster(_props: PieceProps) {
  return (
    <Show when={pregame()} fallback={<Empty title="Your team" />}>
      {(view) => (
        <ol class={styles.roster}>
          <Index each={view().allies}>
            {(ally, index) => (
              <li
                class={styles.ally}
                data-part="ally"
                style={{ "--stagger": index, "--agent-art": cssUrl(agentByUuid(ally().agent_uuid)?.portrait ?? null) }}
                data-self={ally().is_self ? "" : undefined}
                data-state={ally().selection || "none"}
              >
                <span class={styles.allyIcon}>
                  <Art
                    src={ally().agent_icon}
                    fallback={<span class={styles.allyEmpty}>{ally().agent_name?.slice(0, 2) ?? "?"}</span>}
                  />
                </span>
                <span class={styles.allyText}>
                  <span class={styles.allyAgent}>
                    {ally().agent_name ?? "Picking"}
                    <Show when={ally().selection === "locked"}>
                      <span class={styles.lockedTag}>Locked</span>
                    </Show>
                  </span>
                  <span class={styles.allyName} data-sensitive>
                    {ally().game_name || (ally().is_self ? "You" : "Teammate")}
                  </span>
                </span>
                <span class={styles.allyRank} style={{ "--rank": rankColor(ally().rank.color) }}>
                  <Art
                    src={ally().rank.icon}
                    alt={ally().rank.name}
                    fallback={ally().rank.tier > 0 ? ally().rank.name : ""}
                  />
                </span>
              </li>
            )}
          </Index>
        </ol>
      )}
    </Show>
  );
}
