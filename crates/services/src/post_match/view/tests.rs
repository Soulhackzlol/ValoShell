use super::*;
use crate::party::rank_badge;

const DETAILS: &str = include_str!("../fixtures/match_details.json");

fn known() -> HashMap<Puuid, KnownPlayer> {
    let player = |name: &str, tag: &str, is_incognito: bool| KnownPlayer {
        name: RiotName {
            game_name: name.to_owned(),
            tag_line: tag.to_owned(),
        },
        is_incognito,
    };
    HashMap::from([
        (Puuid::new("me"), player("Player", "EUW", false)),
        (Puuid::new("duo"), player("Nova", "4242", false)),
        (Puuid::new("hidden"), player("", "", true)),
    ])
}

fn view_with(known: &HashMap<Puuid, KnownPlayer>) -> PostMatchView {
    let detail: Value = serde_json::from_str(DETAILS).unwrap();
    let index = AssetIndex::bundled();
    let own = Puuid::new("me");
    let inputs = PostMatchInputs {
        index: &index,
        own: &own,
        known,
    };
    post_match_view(&detail, &inputs).unwrap()
}

fn view() -> PostMatchView {
    view_with(&known())
}

fn line<'a>(view: &'a PostMatchView, puuid: &str) -> &'a PostMatchPlayer {
    view.players
        .iter()
        .find(|player| player.puuid == puuid)
        .unwrap()
}

#[test]
fn result_score_map_and_queue_are_read() {
    let view = view();

    assert_eq!(view.result, MatchResult::Victory);
    assert_eq!((view.rounds_won, view.rounds_lost), (13, 9));
    assert_eq!(view.map_name, "Ascent");
    assert_eq!(view.queue_id, "competitive");
    assert!(view.is_ranked);
    assert_eq!(view.started_at_ms, 1_700_000_000_000);
    assert_eq!(view.agent_name.as_deref(), Some("Jett"));
}

#[test]
fn own_stats_derive_acs_adr_and_headshot_share() {
    let stats = view().stats;

    assert_eq!((stats.kills, stats.deaths, stats.assists), (21, 14, 6));
    assert!((stats.acs - 250.9).abs() < 1e-9);
    assert_eq!(stats.adr, Some(9.8));
    assert_eq!(stats.headshot_percent, Some(20.0));
    assert_eq!((stats.first_bloods, stats.first_deaths), (1, 1));
}

#[test]
fn scoreboard_is_sorted_by_score_without_observers() {
    let view = view();

    let order: Vec<&str> = view.players.iter().map(|p| p.puuid.as_str()).collect();
    assert_eq!(order, ["hidden", "me", "duo", "stranger"]);
    assert!(line(&view, "me").is_self);
    assert!(line(&view, "duo").is_ally && !line(&view, "hidden").is_ally);
    assert!((line(&view, "duo").acs - 150.0).abs() < 1e-9);
}

#[test]
fn incognito_players_never_show_a_name() {
    let view = view();

    let hidden = line(&view, "hidden");
    assert!(hidden.is_incognito);
    assert_eq!(hidden.game_name, "");
    assert_eq!(line(&view, "duo").game_name, "Nova");
}

#[test]
fn players_the_lobby_never_saw_stay_unnamed() {
    let view = view();

    assert_eq!(line(&view, "stranger").game_name, "");
}

#[test]
fn match_names_fill_in_for_players_seen_without_incognito() {
    let mut known = known();
    known.insert(Puuid::new("stranger"), KnownPlayer::default());

    let view = view_with(&known);

    assert_eq!(line(&view, "stranger").game_name, "Leaky");
}

#[test]
fn equal_rounds_without_a_winner_is_a_draw() {
    let mut detail: Value = serde_json::from_str(DETAILS).unwrap();
    detail["teams"] = serde_json::json!([
        {"teamId": "Blue", "won": false, "roundsWon": 12},
        {"teamId": "Red", "won": false, "roundsWon": 12}
    ]);
    let (index, own, known) = (AssetIndex::bundled(), Puuid::new("me"), known());
    let inputs = PostMatchInputs {
        index: &index,
        own: &own,
        known: &known,
    };

    let view = post_match_view(&detail, &inputs).unwrap();

    assert_eq!(view.result, MatchResult::Draw);
}

#[test]
fn rr_update_is_attached() {
    let update = RrUpdate {
        match_id: "post-1".to_owned(),
        map_name: "Ascent".to_owned(),
        map_image: None,
        started_at_ms: 0,
        rr_earned: 21,
        rr_after: 61,
        rank_after: rank_badge(&AssetIndex::bundled(), 18),
        is_promotion: false,
        is_demotion: false,
        afk_penalty: 0,
    };

    let view = with_rr(view(), &update);

    assert_eq!((view.rr_change, view.rr_after), (Some(21), Some(61)));
    assert_eq!(view.rank_after.map(|rank| rank.tier), Some(18));
}

#[test]
fn a_match_without_the_player_gives_no_view() {
    let detail: Value = serde_json::from_str(DETAILS).unwrap();
    let (index, own, known) = (AssetIndex::bundled(), Puuid::new("someone-else"), known());
    let inputs = PostMatchInputs {
        index: &index,
        own: &own,
        known: &known,
    };

    assert!(post_match_view(&detail, &inputs).is_none());
}

#[test]
fn players_queued_together_share_a_stack() {
    let view = view();

    let (me, duo, solo) = (
        line(&view, "me"),
        line(&view, "duo"),
        line(&view, "stranger"),
    );

    assert_eq!((me.stack_size, duo.stack_size, solo.stack_size), (2, 2, 1));
    assert_eq!(me.stack_group, duo.stack_group);
    assert_eq!(solo.stack_group, None);
}
