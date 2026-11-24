//! The end-of-match scoreboard: every player's K/D/A, combat score and damage, as the
//! post-match screen shows it. Names are kept only as Riot sent them; the caller decides
//! whether a player's name may be shown.

use std::collections::HashMap;

use serde::Serialize;
use serde_json::Value;

use super::json::{items, object, optional_text, roster, subject, team_id, text, whole};
use super::rounds::{player_stats, round_results};

/// One player's line on the scoreboard.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct ScoreboardRow {
    pub puuid: String,
    pub team_id: String,
    /// Agent uuid; empty when the response has none.
    pub agent_id: String,
    /// `None` when Riot sent a blank name.
    pub game_name: Option<String>,
    pub tag_line: Option<String>,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub score: i64,
    pub rounds: i64,
    /// Damage dealt to other players, summed over the rounds.
    pub damage: i64,
    /// Riot's party id: players queued together share it. Empty when the response has none.
    pub party_id: String,
}

/// Every player of a finished match in roster order (observers dropped, a puuid listed twice
/// keeps its first position with the later entry's values).
pub fn extract_scoreboard(detail: &Value) -> Vec<ScoreboardRow> {
    if !detail.is_object() {
        return Vec::new();
    }
    let mut rows: Vec<ScoreboardRow> = Vec::new();
    let mut positions: HashMap<String, usize> = HashMap::new();
    for entry in roster(detail) {
        let row = scoreboard_row(entry);
        if row.puuid.is_empty() {
            continue;
        }
        match positions.get(&row.puuid) {
            Some(&position) => rows[position] = row,
            None => {
                positions.insert(row.puuid.clone(), rows.len());
                rows.push(row);
            }
        }
    }
    add_damage(detail, &mut rows, &positions);
    rows
}

fn scoreboard_row(entry: &Value) -> ScoreboardRow {
    let stats = object(entry, &["stats", "Stats"]);
    let count = |key: &str| whole(stats.get(key));
    let game_name = optional_text(entry, &["gameName", "GameName"]);
    ScoreboardRow {
        puuid: subject(entry),
        team_id: team_id(entry),
        agent_id: text(entry, &["characterId", "CharacterID"]),
        tag_line: game_name
            .as_ref()
            .and_then(|_| optional_text(entry, &["tagLine", "TagLine"])),
        game_name,
        kills: count("kills"),
        deaths: count("deaths"),
        assists: count("assists"),
        score: count("score"),
        rounds: count("roundsPlayed"),
        damage: 0,
        party_id: text(entry, &["partyId", "PartyID"]),
    }
}

fn add_damage(detail: &Value, rows: &mut [ScoreboardRow], positions: &HashMap<String, usize>) {
    for round in round_results(detail) {
        for stat in player_stats(round) {
            let Some(&position) = positions.get(&subject(stat)) else {
                continue;
            };
            rows[position].damage += items(stat, &["damage", "Damage"])
                .iter()
                .map(|entry| whole(entry.get("damage")))
                .sum::<i64>();
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn player(subject: &str, team: &str, name: &str) -> Value {
        json!({"subject": subject, "teamId": team, "characterId": "agent-1",
               "gameName": name, "tagLine": "EUW",
               "stats": {"kills": 7, "deaths": 4, "assists": 3, "score": 2100, "roundsPlayed": 9}})
    }

    fn sample() -> Value {
        json!({
            "players": [player("a", "Blue", "Ace"), player("b", "Red", ""),
                        {"subject": "obs", "isObserver": true}],
            "roundResults": [
                {"playerStats": [{"subject": "a", "damage": [{"damage": 150}, {"damage": 40}]}]},
                {"playerStats": [{"subject": "a", "damage": [{"damage": 10}]},
                                 {"subject": "b", "damage": [{"damage": 99}]}]},
            ],
        })
    }

    #[test]
    fn rows_carry_kda_score_and_rounds() {
        let rows = extract_scoreboard(&sample());

        assert_eq!(rows.len(), 2);
        let ace = &rows[0];
        assert_eq!((ace.kills, ace.deaths, ace.assists), (7, 4, 3));
        assert_eq!((ace.score, ace.rounds), (2100, 9));
        assert_eq!(
            (ace.team_id.as_str(), ace.agent_id.as_str()),
            ("Blue", "agent-1")
        );
    }

    #[test]
    fn damage_is_summed_over_rounds() {
        let rows = extract_scoreboard(&sample());

        assert_eq!(rows[0].damage, 200);
        assert_eq!(rows[1].damage, 99);
    }

    #[test]
    fn blank_names_are_none_and_drop_the_tag() {
        let rows = extract_scoreboard(&sample());

        assert_eq!(rows[0].game_name.as_deref(), Some("Ace"));
        assert_eq!(rows[1].game_name, None);
        assert_eq!(rows[1].tag_line, None);
    }

    #[test]
    fn non_objects_give_no_rows() {
        assert!(extract_scoreboard(&json!([1, 2])).is_empty());
    }
}
