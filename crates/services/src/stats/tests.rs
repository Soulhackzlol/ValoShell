use std::collections::HashMap;

use domain::ids::Puuid;
use serde_json::Value;

use super::*;
use crate::assets::AssetIndex;
use crate::post_match::{PostMatchInputs, post_match_view};

const DETAILS: &str = include_str!("../post_match/fixtures/match_details.json");

fn base() -> PostMatchView {
    let detail: Value = serde_json::from_str(DETAILS).unwrap();
    let index = AssetIndex::bundled();
    let own = Puuid::new("me");
    let known = HashMap::new();
    let inputs = PostMatchInputs {
        index: &index,
        own: &own,
        known: &known,
    };
    post_match_view(&detail, &inputs).unwrap()
}

/// A match on `map` with `agent`: `kills`/`deaths` over `rounds`, scoring `acs` per round.
fn summary(map: &str, agent: &str, result: MatchResult, numbers: [u32; 4]) -> PostMatchView {
    let [kills, deaths, rounds, acs] = numbers;
    let mut view = base();
    view.queue_id = "competitive".to_owned();
    view.map_name = map.to_owned();
    view.agent_name = Some(agent.to_owned());
    view.result = result;
    view.stats.kills = kills;
    view.stats.deaths = deaths;
    view.stats.assists = 1;
    view.stats.rounds_played = rounds;
    view.stats.combat_score = acs * rounds;
    view.stats.headshot_percent = Some(20.0);
    view.stats.adr = Some(150.0);
    view
}

#[test]
fn overall_weights_per_round_figures_by_rounds() {
    let mut long = summary("Ascent", "Jett", MatchResult::Victory, [20, 10, 20, 300]);
    long.stats.headshot_percent = Some(30.0);
    let short = summary("Bind", "Jett", MatchResult::Defeat, [5, 10, 10, 150]);

    let view = stats_view(&[long, short]);

    let overall = &view.overall;
    assert_eq!((overall.matches, overall.wins), (2, 1));
    assert_eq!(overall.win_rate, Some(50.0));
    assert_eq!(overall.kd, 1.3, "25 kills over 20 deaths");
    assert_eq!(overall.acs, 250.0, "(300*20 + 150*10) / 30 rounds");
    assert_eq!(overall.headshot_percent, Some(26.7), "(30*20 + 20*10) / 30");
    assert_eq!(overall.adr, Some(150.0));
}

#[test]
fn groups_are_most_played_first() {
    let matches = [
        summary("Ascent", "Sova", MatchResult::Victory, [10, 10, 20, 200]),
        summary("Bind", "Jett", MatchResult::Victory, [10, 10, 20, 200]),
        summary("Ascent", "Jett", MatchResult::Defeat, [10, 10, 20, 200]),
    ];

    let view = stats_view(&matches);

    let agents: Vec<(&str, u32)> = view
        .by_agent
        .iter()
        .map(|line| (line.name.as_str(), line.matches))
        .collect();
    assert_eq!(agents, [("Jett", 2), ("Sova", 1)]);
    assert_eq!(view.by_map[0].name, "Ascent");
    assert_eq!(view.by_map[0].win_rate, Some(50.0));
}

#[test]
fn draws_do_not_count_towards_the_win_rate() {
    let matches = [
        summary("Ascent", "Jett", MatchResult::Draw, [10, 10, 24, 200]),
        summary("Ascent", "Jett", MatchResult::Victory, [10, 10, 24, 200]),
    ];

    assert_eq!(stats_view(&matches).overall.win_rate, Some(100.0));
    assert_eq!(stats_view(&matches[..1]).overall.win_rate, None);
}

#[test]
fn deathmatch_and_custom_games_are_left_out() {
    let mut deathmatch = summary("Ascent", "Jett", MatchResult::Victory, [40, 10, 1, 0]);
    deathmatch.queue_id = "deathmatch".to_owned();
    let mut custom = summary("Ascent", "Jett", MatchResult::Victory, [40, 10, 24, 300]);
    custom.queue_id = String::new();
    let mut escalation = summary("Ascent", "Jett", MatchResult::Victory, [30, 5, 12, 200]);
    escalation.queue_id = "ggteam".to_owned();

    let view = stats_view(&[deathmatch, custom, escalation]);

    assert_eq!(view.overall.matches, 0);
    assert!(view.by_agent.is_empty());
    assert_eq!(view.overall.acs, 0.0);
}

#[test]
fn a_flawless_record_reports_kills_as_kd() {
    let view = stats_view(&[summary(
        "Ascent",
        "Jett",
        MatchResult::Victory,
        [7, 0, 13, 250],
    )]);

    assert_eq!(view.overall.kd, 7.0);
}
