//! Premier: the player's team, as the client's Career page shows it. Read-only; the shapes were
//! checked against a live client (camelCase, unlike most pd endpoints). A player with no team
//! has an empty `rosterId`.

use domain::ids::Puuid;
use serde::Deserialize;

use crate::http::{Host, Request};

/// `GET /premier/v3/players/{puuid}`: the player's Premier record, holding their roster id.
pub fn get_premier_player(puuid: &Puuid) -> Request {
    Request::get(Host::Pd, format!("/premier/v3/players/{puuid}"))
}

/// `GET /premier/v2/rosters/{roster_id}`: a team's name, tag and current season.
pub fn get_premier_roster(roster_id: &str) -> Request {
    Request::get(Host::Pd, format!("/premier/v2/rosters/{roster_id}"))
}

/// The player answer; only the roster matters here.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PremierPlayer {
    pub roster_id: String,
}

impl PremierPlayer {
    /// The team's roster id, when the player is on one.
    pub fn team(&self) -> Option<&str> {
        (!self.roster_id.is_empty()).then_some(self.roster_id.as_str())
    }
}

/// A Premier team.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PremierRoster {
    pub name: String,
    pub tag: String,
    pub season: PremierSeason,
}

/// The team's standing this season.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PremierSeason {
    pub is_enrolled: bool,
    pub division: u32,
    pub points: u32,
    pub wins: u32,
    pub games_played: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_target_the_pd_host() {
        let player = get_premier_player(&Puuid::new("abc"));
        let roster = get_premier_roster("team-1");

        assert_eq!(
            (player.host, player.path.as_str()),
            (Host::Pd, "/premier/v3/players/abc")
        );
        assert_eq!(roster.path, "/premier/v2/rosters/team-1");
    }

    #[test]
    fn a_player_without_a_team_has_none() {
        let player: PremierPlayer =
            serde_json::from_str(r#"{"puuid":"abc","rosterId":""}"#).unwrap();

        assert_eq!(player.team(), None);
    }

    #[test]
    fn a_roster_decodes_its_name_tag_and_season() {
        let body = r#"{"rosterId":"team-1","name":"SinMira","tag":"SM","members":[],
            "season":{"isEnrolled":true,"division":7,"points":225,"wins":9,"gamesPlayed":12}}"#;

        let roster: PremierRoster = serde_json::from_str(body).unwrap();

        assert_eq!(
            (roster.name.as_str(), roster.tag.as_str()),
            ("SinMira", "SM")
        );
        assert_eq!((roster.season.division, roster.season.wins), (7, 9));
    }
}
