//! Post-match view: the result, the player's own numbers and everyone's scoreboard line.
//! Pure functions over one match-details response and what the live lobby knew.

use std::collections::HashMap;

use domain::ids::Puuid;
use domain::match_details::{
    ExtractedOwnMatch, ScoreboardRow, extract_own_match, extract_scoreboard,
};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::assets::{AssetIndex, image_url};
use crate::career::RrUpdate;
use crate::names::RiotName;
use crate::party::{RankBadge, queue_option};

const COMPETITIVE: &str = "competitive";

/// How the match ended for the player.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum MatchResult {
    Victory,
    Defeat,
    Draw,
}

/// The player's own numbers.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct OwnStats {
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub combat_score: u32,
    pub rounds_played: u32,
    /// Average combat score (combat score per round).
    pub acs: f64,
    /// Average damage per round; `None` when the match reported no damage.
    pub adr: Option<f64>,
    /// Share of hits that were headshots, 0-100; `None` without any hit.
    pub headshot_percent: Option<f64>,
    pub first_bloods: u32,
    pub first_deaths: u32,
}

/// One scoreboard line. Names stay empty for players who hid theirs.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PostMatchPlayer {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub is_self: bool,
    pub is_ally: bool,
    pub is_incognito: bool,
    pub team_id: String,
    pub agent_name: Option<String>,
    pub agent_icon: Option<String>,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub score: u32,
    pub acs: f64,
    /// Players queued together: 1 solo, 2 a duo, 3 a trio...
    pub stack_size: u32,
    /// Same number for members of the same stack (for colour), `None` when solo.
    pub stack_group: Option<u32>,
}

/// The post-match screen.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PostMatchView {
    pub match_id: String,
    pub result: MatchResult,
    pub rounds_won: u32,
    pub rounds_lost: u32,
    pub map_name: String,
    pub map_splash: Option<String>,
    pub queue_id: String,
    pub queue_label: String,
    pub is_ranked: bool,
    /// Epoch ms.
    #[ts(type = "number")]
    pub started_at_ms: i64,
    pub agent_name: Option<String>,
    pub agent_icon: Option<String>,
    pub agent_portrait: Option<String>,
    pub stats: OwnStats,
    /// RR won or lost; `None` outside ranked or until Riot reports it.
    pub rr_change: Option<i32>,
    pub rr_after: Option<i32>,
    pub rank_after: Option<RankBadge>,
    /// Everyone, highest combat score first.
    pub players: Vec<PostMatchPlayer>,
    /// `true` once the player closed the screen (it stays readable as "last match").
    pub is_seen: bool,
}

/// What the live lobby knew about one player.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct KnownPlayer {
    pub name: RiotName,
    pub is_incognito: bool,
}

/// What the view is built from besides the match details.
pub struct PostMatchInputs<'a> {
    pub index: &'a AssetIndex,
    pub own: &'a Puuid,
    /// Players of this match as the live lobby saw them (the own name included).
    pub known: &'a HashMap<Puuid, KnownPlayer>,
}

fn count(value: i64) -> u32 {
    u32::try_from(value.max(0)).unwrap_or(u32::MAX)
}

fn per_round(total: i64, rounds: i64) -> f64 {
    if rounds <= 0 {
        return 0.0;
    }
    (total as f64 / rounds as f64 * 10.0).round() / 10.0
}

fn result_of(own: &ExtractedOwnMatch) -> MatchResult {
    if own.won {
        MatchResult::Victory
    } else if own.rounds_won == own.rounds_lost {
        MatchResult::Draw
    } else {
        MatchResult::Defeat
    }
}

fn own_stats(own: &ExtractedOwnMatch) -> OwnStats {
    let hits = own.headshots + own.bodyshots + own.legshots;
    OwnStats {
        kills: count(own.kills),
        deaths: count(own.deaths),
        assists: count(own.assists),
        combat_score: count(own.combat_score),
        rounds_played: count(own.rounds_played),
        acs: per_round(own.combat_score, own.rounds_played),
        adr: (own.damage > 0).then(|| per_round(own.damage, own.rounds_played)),
        headshot_percent: (hits > 0)
            .then(|| (own.headshots as f64 / hits as f64 * 1000.0).round() / 10.0),
        first_bloods: count(own.first_bloods),
        first_deaths: count(own.first_deaths),
    }
}

/// The name a scoreboard line may show: only players the lobby saw without incognito, and
/// never a name the lobby did not have unless Riot put it in the match itself.
fn shown_name(row: &ScoreboardRow, known: Option<&KnownPlayer>) -> (RiotName, bool) {
    let Some(known) = known else {
        return (RiotName::default(), false);
    };
    if known.is_incognito {
        return (RiotName::default(), true);
    }
    if !known.name.game_name.is_empty() {
        return (known.name.clone(), false);
    }
    let name = RiotName {
        game_name: row.game_name.clone().unwrap_or_default(),
        tag_line: row.tag_line.clone().unwrap_or_default(),
    };
    (name, false)
}

/// Stack size and group number per puuid, from the party ids Riot puts in the match itself.
/// Groups are numbered in roster order so the colours stay put between reads.
fn party_stacks(rows: &[ScoreboardRow]) -> HashMap<String, (u32, u32)> {
    let mut sizes: HashMap<&str, u32> = HashMap::new();
    for row in rows.iter().filter(|row| !row.party_id.is_empty()) {
        *sizes.entry(row.party_id.as_str()).or_default() += 1;
    }
    let mut groups: HashMap<&str, u32> = HashMap::new();
    let mut stacks = HashMap::new();
    for row in rows {
        let Some(&size) = sizes.get(row.party_id.as_str()).filter(|size| **size > 1) else {
            continue;
        };
        let next = u32::try_from(groups.len()).unwrap_or(u32::MAX);
        let group = *groups.entry(row.party_id.as_str()).or_insert(next);
        stacks.insert(row.puuid.clone(), (size, group));
    }
    stacks
}

fn player_line(
    row: &ScoreboardRow,
    own_team: &str,
    inputs: &PostMatchInputs<'_>,
    stacks: &HashMap<String, (u32, u32)>,
) -> PostMatchPlayer {
    let stack = stacks.get(&row.puuid).copied();
    let puuid = Puuid::new(&row.puuid);
    let (name, is_incognito) = shown_name(row, inputs.known.get(&puuid));
    let agent = inputs.index.agent(&row.agent_id);
    PostMatchPlayer {
        is_self: &puuid == inputs.own,
        puuid: row.puuid.clone(),
        game_name: name.game_name,
        tag_line: name.tag_line,
        is_ally: !own_team.is_empty() && row.team_id == own_team,
        is_incognito,
        team_id: row.team_id.clone(),
        agent_name: agent.as_ref().map(|agent| agent.display_name.clone()),
        agent_icon: agent.and_then(|agent| agent.display_icon.as_deref().map(image_url)),
        kills: count(row.kills),
        deaths: count(row.deaths),
        assists: count(row.assists),
        score: count(row.score),
        acs: per_round(row.score, row.rounds),
        stack_size: stack.map_or(1, |(size, _)| size),
        stack_group: stack.map(|(_, group)| group),
    }
}

fn scoreboard(detail: &Value, inputs: &PostMatchInputs<'_>) -> Vec<PostMatchPlayer> {
    let rows = extract_scoreboard(detail);
    let own_team = rows
        .iter()
        .find(|row| Puuid::new(&row.puuid) == *inputs.own)
        .map(|row| row.team_id.clone())
        .unwrap_or_default();
    let stacks = party_stacks(&rows);
    let mut players: Vec<PostMatchPlayer> = rows
        .iter()
        .map(|row| player_line(row, &own_team, inputs, &stacks))
        .collect();
    players.sort_by(|a, b| b.score.cmp(&a.score).then(b.kills.cmp(&a.kills)));
    players
}

/// Build the view, or `None` when the response is not a finished match the player was in.
pub fn post_match_view(detail: &Value, inputs: &PostMatchInputs<'_>) -> Option<PostMatchView> {
    let own = extract_own_match(detail, inputs.own.as_str(), None)?;
    let internal_id = own.map_id.rsplit('/').nth(1).unwrap_or_default();
    let map = inputs.index.map_by_internal_id(internal_id);
    let agent = inputs.index.agent(&own.agent_id);
    Some(PostMatchView {
        match_id: own.match_id.clone(),
        result: result_of(&own),
        rounds_won: count(own.rounds_won),
        rounds_lost: count(own.rounds_lost),
        map_name: map.as_ref().map_or_else(
            || domain::static_data::map_display_name(internal_id),
            |map| map.display_name.clone(),
        ),
        map_splash: map.and_then(|map| map.splash.as_deref().map(image_url)),
        queue_label: queue_option(inputs.index, &own.queue).label,
        is_ranked: own.queue == COMPETITIVE,
        queue_id: own.queue.clone(),
        started_at_ms: (own.started_at * 1000.0) as i64,
        agent_name: agent.as_ref().map(|agent| agent.display_name.clone()),
        agent_icon: agent
            .as_ref()
            .and_then(|agent| agent.display_icon.as_deref().map(image_url)),
        agent_portrait: agent.and_then(|agent| agent.full_portrait.as_deref().map(image_url)),
        stats: own_stats(&own),
        rr_change: None,
        rr_after: None,
        rank_after: None,
        players: scoreboard(detail, inputs),
        is_seen: false,
    })
}

/// Add the RR change Riot reported for this match.
pub fn with_rr(mut view: PostMatchView, update: &RrUpdate) -> PostMatchView {
    view.rr_change = Some(update.rr_earned);
    view.rr_after = Some(update.rr_after);
    view.rank_after = Some(update.rank_after.clone());
    view
}

#[cfg(test)]
mod tests;
