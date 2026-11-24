//! Agent-select view model: the pregame match joined with agent art, names and ranks.

use std::collections::{HashMap, HashSet};

use domain::ids::Puuid;
use domain::static_data::map_by_map_id_path;
use riot::api::glz::pregame_match::{PregameMatch, PregamePlayer};
use serde::Serialize;
use ts_rs::TS;

use crate::assets::{AssetIndex, image_url};
use crate::names::{RiotName, shown_name};
use crate::party::{RankBadge, rank_badge};

/// One ally in agent select.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PregamePlayerView {
    pub puuid: String,
    pub is_self: bool,
    pub game_name: String,
    pub tag_line: String,
    pub agent_uuid: Option<String>,
    pub agent_name: Option<String>,
    pub agent_icon: Option<String>,
    /// `""`, `selected` or `locked`.
    pub selection: String,
    pub account_level: Option<u32>,
    pub rank: RankBadge,
}

/// The agent-select scene.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PregameView {
    pub match_id: String,
    pub map_name: String,
    pub map_splash: Option<String>,
    pub queue_label: String,
    pub is_ranked: bool,
    /// `Blue` (attackers first) or `Red`.
    pub team_id: String,
    /// Seconds left when this view was built; the UI counts down from `observed_at_ms`.
    pub time_remaining_s: f64,
    pub observed_at_ms: f64,
    pub allies: Vec<PregamePlayerView>,
    pub enemy_lock_count: u32,
    pub enemy_team_size: u32,
    pub own_agent_uuid: Option<String>,
    pub is_own_locked: bool,
    /// Agents allies already locked (cannot be picked).
    pub taken_agents: Vec<String>,
}

/// Inputs besides the match.
pub struct PregameContext<'a> {
    pub index: &'a AssetIndex,
    pub own: &'a Puuid,
    pub names: &'a HashMap<Puuid, RiotName>,
    /// Who sees the names of players hiding theirs (see `shown_name`).
    pub party: &'a HashSet<Puuid>,
    pub now_ms: f64,
}

fn player_view(player: &PregamePlayer, context: &PregameContext<'_>) -> Option<PregamePlayerView> {
    let puuid = player.subject.clone()?;
    let agent = player
        .character_id
        .as_ref()
        .filter(|id| !id.is_empty())
        .and_then(|id| context.index.agent(id.as_str()));
    let identity = &player.player_identity;
    let name = shown_name(context.names, &puuid, identity.incognito, context.party);
    Some(PregamePlayerView {
        is_self: &puuid == context.own,
        puuid: puuid.to_string(),
        game_name: name.game_name,
        tag_line: name.tag_line,
        agent_uuid: player
            .character_id
            .as_ref()
            .map(ToString::to_string)
            .filter(|id| !id.is_empty()),
        agent_name: agent.as_ref().map(|agent| agent.display_name.clone()),
        agent_icon: agent.and_then(|agent| agent.display_icon.as_deref().map(image_url)),
        selection: player.character_selection_state.clone(),
        account_level: (!identity.hide_account_level).then_some(identity.account_level),
        rank: rank_badge(context.index, player.competitive_tier),
    })
}

/// Map name and splash; the bundled table names maps the asset cache does not know yet.
fn map_art(pregame: &PregameMatch, index: &AssetIndex) -> (String, Option<String>) {
    let internal_id = pregame.map_id.rsplit('/').nth(1).unwrap_or_default();
    let map = index.map_by_internal_id(internal_id);
    let name = map
        .as_ref()
        .map(|map| map.display_name.clone())
        .or_else(|| map_by_map_id_path(&pregame.map_id).map(|entry| entry.display_name()))
        .unwrap_or_else(|| "Unknown map".to_owned());
    (
        name,
        map.and_then(|map| map.splash.as_deref().map(image_url)),
    )
}

fn allies_of(pregame: &PregameMatch, context: &PregameContext<'_>) -> Vec<PregamePlayerView> {
    pregame
        .ally_team
        .iter()
        .flat_map(|team| &team.players)
        .filter_map(|player| player_view(player, context))
        .collect()
}

/// Build the view for the current pregame match.
pub fn pregame_view(pregame: &PregameMatch, context: &PregameContext<'_>) -> PregameView {
    let (map_name, map_splash) = map_art(pregame, context.index);
    let allies = allies_of(pregame, context);
    let own = allies.iter().find(|player| player.is_self);
    PregameView {
        match_id: pregame
            .id
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_default(),
        map_name,
        map_splash,
        queue_label: crate::party::queue_option(context.index, &pregame.queue_id).label,
        is_ranked: pregame.is_ranked,
        team_id: pregame
            .ally_team
            .as_ref()
            .map(|team| team.team_id.clone())
            .unwrap_or_default(),
        time_remaining_s: pregame.phase_time_remaining_seconds(),
        observed_at_ms: context.now_ms,
        own_agent_uuid: own.and_then(|player| player.agent_uuid.clone()),
        is_own_locked: own.is_some_and(|player| player.selection == "locked"),
        taken_agents: allies
            .iter()
            .filter(|player| !player.is_self && player.selection == "locked")
            .filter_map(|player| player.agent_uuid.clone())
            .collect(),
        allies,
        enemy_lock_count: pregame.enemy_team_lock_count,
        enemy_team_size: pregame.enemy_team_size,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../../riot/src/api/glz/fixtures/pregame_match.json");
    const ME: &str = "b47236a3-0000-0000-0000-000000000001";

    fn view() -> PregameView {
        let pregame: PregameMatch = serde_json::from_str(FIXTURE).unwrap();
        let index = AssetIndex::bundled();
        let own = Puuid::new(ME);
        let names = HashMap::new();
        let context = PregameContext {
            index: &index,
            own: &own,
            names: &names,
            party: &HashSet::new(),
            now_ms: 1000.0,
        };
        pregame_view(&pregame, &context)
    }

    #[test]
    fn a_hidden_ally_is_not_named_from_the_cache() {
        let mut pregame: PregameMatch = serde_json::from_str(FIXTURE).unwrap();
        let ally = pregame
            .ally_team
            .as_mut()
            .unwrap()
            .players
            .first_mut()
            .unwrap();
        ally.player_identity.incognito = true;
        let puuid = ally.subject.clone().unwrap();
        let names = HashMap::from([(puuid.clone(), crate::names::split_riot_id("Ace#1"))]);
        let index = AssetIndex::bundled();
        let own = Puuid::new("someone-else");
        let context = PregameContext {
            index: &index,
            own: &own,
            names: &names,
            party: &HashSet::new(),
            now_ms: 1000.0,
        };

        let view = pregame_view(&pregame, &context);

        let shown = view
            .allies
            .iter()
            .find(|player| player.puuid == puuid.to_string());
        assert_eq!(shown.map(|player| player.game_name.as_str()), Some(""));
    }

    #[test]
    fn map_and_queue_are_named() {
        let view = view();

        assert_eq!(view.map_name, "Ascent");
        assert_eq!(view.queue_label, "Competitive");
        assert_eq!(view.team_id, "Blue");
        assert!(view.is_ranked);
    }

    #[test]
    fn own_lock_is_read_from_the_ally_roster() {
        let view = view();

        assert!(view.is_own_locked);
        assert_eq!(
            view.own_agent_uuid.as_deref(),
            Some("add6443a-41bd-e414-f6ad-e58d267f4e95")
        );
        assert_eq!(view.allies[0].agent_name.as_deref(), Some("Jett"));
        assert!(view.taken_agents.is_empty());
    }

    #[test]
    fn timer_is_stamped_with_the_observation_time() {
        let view = view();

        assert!((view.time_remaining_s - 71.95).abs() < 0.01);
        assert!((view.observed_at_ms - 1000.0).abs() < f64::EPSILON);
    }
}
