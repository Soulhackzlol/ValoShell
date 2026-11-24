// Rules shared by every style's match report (glassResults.tsx, styledResults.tsx): your line as
// tiles, the two teams best-first and each team's MVP, so the looks only decide how they draw.
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";
import type { PostMatchView } from "~/bindings/PostMatchView";

/** "+18" / "-12" / "0", as RR changes read. */
export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** Your line as label/value pairs; "—" where Riot sent no figure. */
export function ownTiles(view: PostMatchView): [string, string][] {
  const stats = view.stats;
  const kd = stats.deaths === 0 ? stats.kills : stats.kills / stats.deaths;
  const percent = stats.headshot_percent === null ? "—" : `${Math.round(stats.headshot_percent)}%`;
  return [
    ["K / D / A", `${stats.kills}/${stats.deaths}/${stats.assists}`],
    ["ACS", String(Math.round(stats.acs))],
    ["K/D", kd.toFixed(2)],
    ["ADR", stats.adr === null ? "—" : String(Math.round(stats.adr))],
    ["Headshot", percent],
    ["First bloods", String(stats.first_bloods)],
  ];
}

const byAcs = (a: PostMatchPlayer, b: PostMatchPlayer) => b.acs - a.acs;

/** Your team and theirs, each best combat score first, as every shooter's scoreboard orders it. */
export function teamsOf(players: readonly PostMatchPlayer[]): {
  allies: PostMatchPlayer[];
  enemies: PostMatchPlayer[];
} {
  return {
    allies: players.filter((player) => player.is_ally).sort(byAcs),
    enemies: players.filter((player) => !player.is_ally).sort(byAcs),
  };
}

/** The team's MVP: its best combat score, or null for an empty team or a team that scored nothing. */
export function mvpOf(team: readonly PostMatchPlayer[]): string | null {
  const best = [...team].sort(byAcs)[0];
  return best && best.acs > 0 ? best.puuid : null;
}
