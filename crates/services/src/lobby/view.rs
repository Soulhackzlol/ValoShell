//! Live lobby view: every player of the current match with rank facts and party stacks.
//! Pure functions over the roster, the ranker rows fetched so far, names and parties.

use std::collections::{HashMap, HashSet};

use domain::ids::{AgentId, Puuid};
use domain::match_details::player_row::RankerRow;
use riot::api::glz::common::PlayerIdentity;
use riot::api::glz::coregame::CoregameMatch;
use riot::api::glz::pregame_match::{PregameMatch, PregameTeam};
use serde::Serialize;
use ts_rs::TS;

use crate::assets::{AssetIndex, image_url};
use crate::names::{RiotName, shown_name};
use crate::party::{RankBadge, rank_badge};

/// One player as the match roster lists them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RosterEntry {
    pub puuid: Puuid,
    pub is_ally: bool,
    pub agent: Option<AgentId>,
    pub account_level: Option<u32>,
    pub is_incognito: bool,
}

/// The match the lobby describes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Roster {
    pub match_id: String,
    pub is_pregame: bool,
    pub map_path: String,
    pub queue_id: String,
    pub entries: Vec<RosterEntry>,
}

fn entry(
    puuid: Option<&Puuid>,
    is_ally: bool,
    agent: Option<&AgentId>,
    identity: &PlayerIdentity,
) -> Option<RosterEntry> {
    Some(RosterEntry {
        puuid: puuid?.clone(),
        is_ally,
        agent: agent.filter(|id| !id.is_empty()).cloned(),
        account_level: (!identity.hide_account_level && identity.account_level > 0)
            .then_some(identity.account_level),
        is_incognito: identity.incognito,
    })
}

fn team_entries(team: Option<&PregameTeam>, is_ally: bool) -> Vec<RosterEntry> {
    team.iter()
        .flat_map(|team| &team.players)
        .filter_map(|player| {
            entry(
                player.subject.as_ref(),
                is_ally,
                player.character_id.as_ref(),
                &player.player_identity,
            )
        })
        .collect()
}

/// Roster from agent select (enemies appear only as they lock, if at all).
pub fn pregame_roster(pregame: &PregameMatch) -> Roster {
    let mut entries = team_entries(pregame.ally_team.as_ref(), true);
    entries.extend(team_entries(pregame.enemy_team.as_ref(), false));
    Roster {
        match_id: pregame
            .id
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_default(),
        is_pregame: true,
        map_path: pregame.map_id.clone(),
        queue_id: pregame.queue_id.clone(),
        entries,
    }
}

/// Roster from a live match; the own team decides who is an ally.
pub fn coregame_roster(core: &CoregameMatch, own: &Puuid) -> Roster {
    let own_team = core
        .players
        .iter()
        .find(|player| player.subject.as_ref() == Some(own))
        .map(|player| player.team_id.clone())
        .unwrap_or_default();
    let entries = core
        .players
        .iter()
        .filter(|player| !player.is_coach)
        .filter_map(|player| {
            let is_ally = !own_team.is_empty() && player.team_id == own_team;
            entry(
                player.subject.as_ref(),
                is_ally,
                player.character_id.as_ref(),
                &player.player_identity,
            )
        })
        .collect();
    Roster {
        match_id: core
            .match_id
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_default(),
        is_pregame: false,
        map_path: core.map_id.clone(),
        queue_id: core.queue_id().unwrap_or_default().to_owned(),
        entries,
    }
}

/// One row of the lobby table.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct LobbyPlayerView {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub is_self: bool,
    pub is_ally: bool,
    pub is_incognito: bool,
    pub agent_name: Option<String>,
    pub agent_icon: Option<String>,
    pub account_level: Option<u32>,
    /// `false` until this player's rank has been fetched.
    pub is_loaded: bool,
    /// The rank is deliberately not read (an enemy during agent select, setting off).
    pub is_rank_hidden: bool,
    pub rank: RankBadge,
    pub rr: i32,
    pub peak: RankBadge,
    pub win_rate: Option<f64>,
    pub games: u32,
    pub is_placement: bool,
    pub leaderboard_rank: u32,
    /// Players in this match sharing this player's party (1 = solo or unknown).
    pub stack_size: u32,
    /// Same number for members of the same stack (for colour), `None` when solo/unknown.
    pub stack_group: Option<u32>,
}

/// The lobby table.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct LobbyView {
    pub match_id: String,
    pub is_pregame: bool,
    /// `false` once the match ended (the table stays as "last match").
    pub is_live: bool,
    pub map_name: String,
    pub queue_label: String,
    pub allies: Vec<LobbyPlayerView>,
    pub enemies: Vec<LobbyPlayerView>,
    pub ally_average: Option<RankBadge>,
    pub enemy_average: Option<RankBadge>,
    pub is_complete: bool,
}

/// What the view is built from besides the roster.
pub struct LobbyInputs<'a> {
    pub index: &'a AssetIndex,
    pub own: &'a Puuid,
    pub names: &'a HashMap<Puuid, RiotName>,
    /// Who sees the names of players hiding theirs (see `shown_name`).
    pub party: &'a HashSet<Puuid>,
    pub rows: &'a HashMap<Puuid, RankerRow>,
    pub stacks: &'a HashMap<Puuid, (u32, u32)>,
    /// Enemy ranks are not shown (agent select with the reveal setting off).
    pub are_enemy_ranks_hidden: bool,
}

fn player_view(entry: &RosterEntry, inputs: &LobbyInputs<'_>) -> LobbyPlayerView {
    let agent = entry
        .agent
        .as_ref()
        .and_then(|id| inputs.index.agent(id.as_str()));
    let name = shown_name(inputs.names, &entry.puuid, entry.is_incognito, inputs.party);
    let is_rank_hidden = inputs.are_enemy_ranks_hidden && !entry.is_ally;
    let row = inputs.rows.get(&entry.puuid).filter(|_| !is_rank_hidden);
    let stack = inputs.stacks.get(&entry.puuid).copied();
    LobbyPlayerView {
        puuid: entry.puuid.to_string(),
        game_name: name.game_name,
        tag_line: name.tag_line,
        is_self: &entry.puuid == inputs.own,
        is_ally: entry.is_ally,
        is_incognito: entry.is_incognito,
        agent_name: agent.as_ref().map(|agent| agent.display_name.clone()),
        agent_icon: agent.and_then(|agent| agent.display_icon.as_deref().map(image_url)),
        account_level: entry.account_level,
        is_loaded: row.is_some(),
        is_rank_hidden,
        rank: rank_badge(
            inputs.index,
            row.map_or(0, |row| u32::from(row.current_tier)),
        ),
        rr: row.map_or(0, |row| row.rank_rating),
        peak: rank_badge(inputs.index, row.map_or(0, |row| u32::from(row.peak_tier))),
        win_rate: row.and_then(|row| row.win_rate.or(row.alt_win_rate)),
        games: row.map_or(0, |row| row.games_played),
        is_placement: row.is_some_and(|row| row.is_placement),
        leaderboard_rank: row.map_or(0, |row| row.leaderboard_rank),
        stack_size: stack.map_or(1, |(size, _)| size),
        stack_group: stack.filter(|(size, _)| *size > 1).map(|(_, group)| group),
    }
}

/// Average tier of the ranked players on a side (unranked players are left out).
fn average_rank(index: &AssetIndex, players: &[LobbyPlayerView]) -> Option<RankBadge> {
    let tiers: Vec<u32> = players
        .iter()
        .map(|player| player.rank.tier)
        .filter(|tier| *tier > 2)
        .collect();
    if tiers.is_empty() {
        return None;
    }
    let mean = tiers.iter().sum::<u32>() as f64 / tiers.len() as f64;
    Some(rank_badge(index, mean.round() as u32))
}

/// Allies first: stacks together, then by rank (highest first).
fn sort_side(players: &mut [LobbyPlayerView]) {
    players.sort_by(|a, b| {
        a.stack_group
            .unwrap_or(u32::MAX)
            .cmp(&b.stack_group.unwrap_or(u32::MAX))
            .then(b.rank.tier.cmp(&a.rank.tier))
    });
}

/// Build the lobby view.
pub fn lobby_view(roster: &Roster, inputs: &LobbyInputs<'_>) -> LobbyView {
    let (mut allies, mut enemies): (Vec<_>, Vec<_>) = roster
        .entries
        .iter()
        .map(|entry| player_view(entry, inputs))
        .partition(|player| player.is_ally);
    sort_side(&mut allies);
    sort_side(&mut enemies);
    let internal_id = roster.map_path.rsplit('/').nth(1).unwrap_or_default();
    LobbyView {
        match_id: roster.match_id.clone(),
        is_pregame: roster.is_pregame,
        is_live: true,
        map_name: inputs
            .index
            .map_by_internal_id(internal_id)
            .map(|map| map.display_name.clone())
            .unwrap_or_else(|| domain::static_data::map_display_name(internal_id)),
        queue_label: crate::party::queue_option(inputs.index, &roster.queue_id).label,
        ally_average: average_rank(inputs.index, &allies),
        enemy_average: average_rank(inputs.index, &enemies),
        is_complete: allies
            .iter()
            .chain(&enemies)
            .all(|player| player.is_loaded || player.is_rank_hidden),
        allies,
        enemies,
    }
}

/// Stack size and a group number per player, from party ids seen in presences.
pub fn stack_groups(
    sizes: &HashMap<Puuid, u32>,
    parties: &HashMap<Puuid, domain::ids::PartyId>,
) -> HashMap<Puuid, (u32, u32)> {
    let mut groups: HashMap<&domain::ids::PartyId, u32> = HashMap::new();
    let mut ordered: Vec<(&Puuid, &domain::ids::PartyId)> = parties.iter().collect();
    ordered.sort();
    for (_, party) in &ordered {
        let next = u32::try_from(groups.len()).unwrap_or(0);
        groups.entry(party).or_insert(next);
    }
    sizes
        .iter()
        .filter_map(|(puuid, size)| {
            let group = groups.get(parties.get(puuid)?)?;
            Some((puuid.clone(), (*size, *group)))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const PREGAME: &str = include_str!("../../../riot/src/api/glz/fixtures/pregame_match.json");
    const COREGAME: &str = include_str!("../../../riot/src/api/glz/fixtures/coregame_match.json");

    fn row(tier: u8) -> RankerRow {
        RankerRow {
            current_tier: tier,
            rank_rating: 40,
            games_played: 10,
            is_placement: false,
            leaderboard_rank: 0,
            act_wins: 0,
            win_rate: Some(55.0),
            alt_win_rate: None,
            alt_win_rate_queue: String::new(),
            peak_tier: tier + 1,
        }
    }

    #[test]
    fn pregame_roster_lists_allies_with_agents() {
        let pregame: PregameMatch = serde_json::from_str(PREGAME).unwrap();

        let roster = pregame_roster(&pregame);

        assert!(roster.is_pregame);
        assert_eq!(roster.entries.len(), 2);
        assert!(roster.entries.iter().all(|entry| entry.is_ally));
        assert!(roster.entries[0].agent.is_some());
    }

    #[test]
    fn coregame_roster_splits_teams_by_the_own_team() {
        let core: CoregameMatch = serde_json::from_str(COREGAME).unwrap();
        let own = core.players[0].subject.clone().unwrap();

        let roster = coregame_roster(&core, &own);

        assert!(!roster.is_pregame);
        assert!(roster.entries.iter().any(|entry| entry.is_ally));
        assert!(roster.entries.iter().any(|entry| !entry.is_ally));
    }

    #[test]
    fn view_fills_ranks_progressively_and_averages_ranked_players() {
        let core: CoregameMatch = serde_json::from_str(COREGAME).unwrap();
        let own = core.players[0].subject.clone().unwrap();
        let roster = coregame_roster(&core, &own);
        let index = AssetIndex::bundled();
        let mut rows = HashMap::new();
        rows.insert(own.clone(), row(15));
        let names = HashMap::new();
        let stacks = HashMap::new();
        let inputs = LobbyInputs {
            index: &index,
            own: &own,
            names: &names,
            party: &HashSet::new(),
            rows: &rows,
            stacks: &stacks,
            are_enemy_ranks_hidden: false,
        };

        let view = lobby_view(&roster, &inputs);

        let me = view.allies.iter().find(|player| player.is_self).unwrap();
        assert!(me.is_loaded);
        assert_eq!(me.rank.tier, 15);
        assert_eq!(me.peak.tier, 16);
        assert!(!view.is_complete);
        assert_eq!(view.ally_average.map(|rank| rank.tier), Some(15));
    }

    #[test]
    fn hidden_enemy_ranks_stay_hidden_even_when_known() {
        let core: CoregameMatch = serde_json::from_str(COREGAME).unwrap();
        let own = core.players[0].subject.clone().unwrap();
        let roster = coregame_roster(&core, &own);
        let index = AssetIndex::bundled();
        let rows: HashMap<Puuid, RankerRow> = roster
            .entries
            .iter()
            .map(|entry| (entry.puuid.clone(), row(15)))
            .collect();
        let (names, stacks) = (HashMap::new(), HashMap::new());
        let inputs = LobbyInputs {
            index: &index,
            own: &own,
            names: &names,
            party: &HashSet::new(),
            rows: &rows,
            stacks: &stacks,
            are_enemy_ranks_hidden: true,
        };

        let view = lobby_view(&roster, &inputs);

        assert!(!view.enemies.is_empty());
        assert!(
            view.enemies
                .iter()
                .all(|enemy| enemy.is_rank_hidden && !enemy.is_loaded)
        );
        assert!(
            view.allies
                .iter()
                .all(|ally| ally.is_loaded && !ally.is_rank_hidden)
        );
        assert_eq!(view.enemy_average, None);
        assert!(view.is_complete);
    }

    #[test]
    fn stacks_get_one_group_number_per_party() {
        let (a, b, c) = (Puuid::new("a"), Puuid::new("b"), Puuid::new("c"));
        let party = domain::ids::PartyId::new("p1");
        let parties = HashMap::from([
            (a.clone(), party.clone()),
            (b.clone(), party),
            (c.clone(), domain::ids::PartyId::new("p2")),
        ]);
        let sizes = HashMap::from([(a.clone(), 2), (b.clone(), 2), (c.clone(), 1)]);

        let groups = stack_groups(&sizes, &parties);

        assert_eq!(groups[&a].1, groups[&b].1);
        assert_ne!(groups[&a].1, groups[&c].1);
        assert_eq!(groups[&a].0, 2);
    }
}
