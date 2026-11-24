// The name a scoreboard line shows, shared by every post-match look so the rule lives once:
// a player who hid their name stays "Hidden", one the match left unnamed shows their agent.
import type { PostMatchPlayer } from "~/bindings/PostMatchPlayer";

export function playerName(player: PostMatchPlayer): string {
  if (player.game_name) return player.game_name;
  if (player.is_incognito) return "Hidden";
  return player.agent_name ?? "Player";
}
