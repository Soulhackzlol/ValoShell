//! Competitive leaderboards.

use std::collections::HashMap;
use std::fmt::Write;

use domain::ids::Puuid;
use serde::Deserialize;

use crate::http::{Host, Request};

/// The client asks for this many rows per page.
pub const DEFAULT_PAGE_SIZE: u32 = 510;

/// Leaderboard regions. BR and LATAM play on the NA shard but are ranked on their own boards.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Affinity {
    Eu,
    Na,
    Latam,
    Br,
    Ap,
    Kr,
}

impl Affinity {
    fn as_str(self) -> &'static str {
        match self {
            Self::Eu => "eu",
            Self::Na => "na",
            Self::Latam => "latam",
            Self::Br => "br",
            Self::Ap => "ap",
            Self::Kr => "kr",
        }
    }
}

/// Paging and the optional name search of one leaderboard request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LeaderboardPage {
    pub start_index: u32,
    pub size: u32,
    pub name_query: Option<String>,
}

impl Default for LeaderboardPage {
    fn default() -> Self {
        Self {
            start_index: 0,
            size: DEFAULT_PAGE_SIZE,
            name_query: None,
        }
    }
}

/// `GET /mmr/v1/leaderboards/affinity/{affinity}/queue/competitive/season/{season_id}`.
///
/// UNVERIFIED on 13.08: the leaderboard tab never appears in the client logs; the path and
/// shape come from older docs that agree with each other.
pub fn get_leaderboard(affinity: Affinity, season_id: &str, page: &LeaderboardPage) -> Request {
    let mut path = format!(
        "/mmr/v1/leaderboards/affinity/{}/queue/competitive/season/{season_id}?startIndex={}&size={}",
        affinity.as_str(),
        page.start_index,
        page.size,
    );
    if let Some(name) = &page.name_query {
        path.push_str("&query=");
        path.push_str(&percent_encode(name));
    }
    Request::get(Host::Pd, path)
}

/// Escape everything outside RFC 3986 unreserved characters (Riot IDs contain spaces and `#`).
fn percent_encode(raw: &str) -> String {
    let mut encoded = String::with_capacity(raw.len());
    for byte in raw.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~') {
            encoded.push(char::from(byte));
        } else {
            // Writing to a String cannot fail.
            let _ = write!(encoded, "%{byte:02X}");
        }
    }
    encoded
}

/// One leaderboard page. UNVERIFIED on 13.08: mixed Pascal/camel casing is accepted.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "PascalCase", default)]
pub struct Leaderboard {
    pub deployment: String,
    #[serde(rename = "QueueID")]
    pub queue_id: String,
    #[serde(rename = "SeasonID")]
    pub season_id: String,
    #[serde(deserialize_with = "super::null_as_default")]
    pub players: Vec<LeaderboardPlayer>,
    #[serde(alias = "totalPlayers")]
    pub total_players: u32,
    #[serde(alias = "immortalStartingPage")]
    pub immortal_starting_page: u32,
    #[serde(alias = "immortalStartingIndex")]
    pub immortal_starting_index: u32,
    #[serde(alias = "topTierRRThreshold")]
    pub top_tier_rr_threshold: u32,
    #[serde(alias = "tierDetails", deserialize_with = "super::null_as_default")]
    pub tier_details: HashMap<String, TierDetail>,
    #[serde(alias = "startIndex")]
    pub start_index: u32,
    #[serde(alias = "query")]
    pub query: String,
}

/// A ranked player row.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct LeaderboardPlayer {
    #[serde(rename = "PlayerCardID")]
    pub player_card_id: String,
    #[serde(rename = "TitleID")]
    pub title_id: String,
    #[serde(rename = "IsBanned")]
    pub is_banned: bool,
    #[serde(rename = "IsAnonymized")]
    pub is_anonymized: bool,
    pub puuid: Option<Puuid>,
    #[serde(rename = "gameName")]
    pub game_name: String,
    #[serde(rename = "tagLine")]
    pub tag_line: String,
    #[serde(rename = "leaderboardRank")]
    pub leaderboard_rank: u32,
    #[serde(rename = "rankedRating")]
    pub ranked_rating: u32,
    #[serde(rename = "numberOfWins")]
    pub number_of_wins: u32,
    #[serde(rename = "competitiveTier")]
    pub competitive_tier: u32,
}

/// Where a tier starts in the leaderboard.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TierDetail {
    pub ranked_rating_threshold: u32,
    pub starting_page: u32,
    pub starting_index: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaderboard_request_uses_affinity_season_and_paging() {
        let request = get_leaderboard(Affinity::Eu, "season-1", &LeaderboardPage::default());

        assert_eq!(request.host, Host::Pd);
        assert_eq!(
            request.path,
            "/mmr/v1/leaderboards/affinity/eu/queue/competitive/season/season-1?startIndex=0&size=510"
        );
    }

    #[test]
    fn name_query_is_percent_encoded() {
        let page = LeaderboardPage {
            name_query: Some("Neo #EUW".to_owned()),
            ..LeaderboardPage::default()
        };

        let request = get_leaderboard(Affinity::Na, "s", &page);

        assert!(request.path.ends_with("&query=Neo%20%23EUW"));
    }

    #[test]
    fn leaderboard_decodes_players_and_tiers() {
        let json = r#"{"Deployment":"eu","QueueID":"competitive","SeasonID":"s",
            "Players":[{"PlayerCardID":"c","TitleID":"t","IsBanned":false,"IsAnonymized":false,
              "puuid":"p","gameName":"Neo","tagLine":"EUW","leaderboardRank":1,
              "rankedRating":900,"numberOfWins":80,"competitiveTier":27}],
            "totalPlayers":15000,"immortalStartingPage":3,"immortalStartingIndex":300,
            "topTierRRThreshold":420,
            "tierDetails":{"27":{"rankedRatingThreshold":500,"startingPage":0,"startingIndex":0}},
            "startIndex":0,"query":""}"#;

        let board: Leaderboard = serde_json::from_str(json).expect("decodes");

        assert_eq!(board.total_players, 15000);
        assert_eq!(board.top_tier_rr_threshold, 420);
        assert_eq!(board.players[0].game_name, "Neo");
        assert_eq!(board.players[0].competitive_tier, 27);
        assert_eq!(board.tier_details["27"].ranked_rating_threshold, 500);
    }
}
