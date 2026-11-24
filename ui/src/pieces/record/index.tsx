// The Service Record: rank, RR, recent ranked games and the act's numbers on one piece, drawn
// the way each style's own game draws its career screen (Halo 3's Service Record, the CS 1.6
// Statistics dialog, a terminal printout, Minecraft's Statistics, a Fortnite season page, the
// VALORANT beta's Progression, the 2022 career page, an Apple summary for Glass, Cyberpunk's
// character sheet, Persona 5's Social Stats, League's Ranked tab, the Pip-Boy's STATS, CS:GO's
// Panorama profile, CS2's Premier rating). Auto picks the style's own.
import { type Component, Match, Show, Switch, createMemo } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { PieceProps } from "~/studio/registry";
import { doc } from "~/studio/store";
import type { Skin } from "~/studio/types";
import { careerView } from "~/state/views";
import { RankCard, RrHistory, Status, useCareer } from "../career";
import { type RecordProps, recordStats } from "./shared";
import { HaloRecord } from "./halo";
import { Cs16Record } from "./cs16";
import { TerminalRecord } from "./terminal";
import { MinecraftRecord } from "./minecraft";
import { FortniteRecord } from "./fortnite";
import { BetaRecord } from "./beta";
import { ValnowRecord } from "./valnow";
import { GlassRecord } from "./glass";
import { NightCityRecord } from "./nightcity";
import { PhantomRecord } from "./phantom";
import { LeagueRecord } from "./league";
import { PipboyRecord } from "./pipboy";
import { CsgoRecord } from "./csgo";
import { Cs2Record } from "./cs2";
import styles from "./record.module.css";

/** Every look but "modern", which is drawn from the career pieces themselves. */
const RECORDS = {
  halo: HaloRecord,
  cs16: Cs16Record,
  terminal: TerminalRecord,
  minecraft: MinecraftRecord,
  fortnite: FortniteRecord,
  beta: BetaRecord,
  valnow: ValnowRecord,
  glass: GlassRecord,
  nightcity: NightCityRecord,
  phantom: PhantomRecord,
  league: LeagueRecord,
  pipboy: PipboyRecord,
  csgo: CsgoRecord,
  cs2: Cs2Record,
} satisfies Record<string, Component<RecordProps>>;

export type RecordLayout = "modern" | keyof typeof RECORDS;

/** The record's look when set to Auto: what the style's own game would show. */
const AUTO_RECORD: Record<Skin, RecordLayout> = {
  modern: "modern",
  beta: "beta",
  current: "valnow",
  glass: "glass",
  valnow: "valnow",
  csgo: "csgo",
  cs2: "cs2",
  cs16: "cs16",
  terminal: "terminal",
  fortnite: "fortnite",
  minecraft: "minecraft",
  halo: "halo",
  pipboy: "pipboy",
  league: "league",
  phantom: "phantom",
  nightcity: "nightcity",
};

export const RECORD_LAYOUTS: readonly { value: string; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "modern", label: "Rank card + history" },
  { value: "halo", label: "Halo 3 Service Record" },
  { value: "cs16", label: "CS 1.6 Statistics" },
  { value: "terminal", label: "Terminal printout" },
  { value: "minecraft", label: "Minecraft Statistics" },
  { value: "fortnite", label: "Fortnite career" },
  { value: "beta", label: "Beta Progression" },
  { value: "valnow", label: "VALORANT 2022 career" },
  { value: "glass", label: "Glass summary" },
  { value: "nightcity", label: "Cyberpunk character sheet" },
  { value: "phantom", label: "Persona 5 Social Stats" },
  { value: "league", label: "League Ranked tab" },
  { value: "pipboy", label: "Pip-Boy STATS" },
  { value: "csgo", label: "CS:GO profile" },
  { value: "cs2", label: "CS2 Premier" },
];

export function ServiceRecord(props: PieceProps) {
  useCareer();
  const layout = (): RecordLayout => {
    const chosen = props.piece.props["layout"];
    return typeof chosen === "string" && chosen !== "auto" ? (chosen as RecordLayout) : AUTO_RECORD[doc.theme.skin];
  };
  return (
    <Switch>
      <Match when={layout() === "modern"}>
        <div class={styles.modern}>
          <div class={styles.modernRank}>
            <RankCard {...props} />
          </div>
          <div class={styles.modernHistory}>
            <RrHistory {...props} />
          </div>
        </div>
      </Match>
      <Match when={true}>
        <Show when={careerView.value()} fallback={<Status what="Service record" />}>
          {(view) => {
            const stats = createMemo(() => recordStats(view()));
            return (
              <Dynamic
                component={RECORDS[layout() as Exclude<RecordLayout, "modern">]}
                view={view()}
                stats={stats()}
                isEditing={props.isEditing}
              />
            );
          }}
        </Show>
      </Match>
    </Switch>
  );
}
