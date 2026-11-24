use riot::api::pd::account::LevelProgress;
use riot::api::pd::contracts::{ContractProgress, MissionMetadata};

use super::*;
use crate::assets::{AssetSource, fixtures};

fn index() -> AssetIndex {
    AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
}

fn mission(id: &str, objective: &str, done: i64, complete: bool) -> RiotMission {
    RiotMission {
        id: id.to_owned(),
        objectives: [(objective.to_owned(), done)].into_iter().collect(),
        complete,
        ..RiotMission::default()
    }
}

fn contracts(tier: u32, towards_next: i64) -> Contracts {
    Contracts {
        contracts: vec![ContractProgress {
            contract_definition_id: "PASS-ACT-5".to_owned(),
            progression_level_reached: tier,
            progression_towards_next_level: towards_next,
            ..ContractProgress::default()
        }],
        missions: vec![
            mission("weekly-kills", "obj-kills", 37, false),
            mission("weekly-abilities", "obj-abilities", 12, true),
            mission("daily-win", "obj-win", 0, false),
            mission("unknown-mission", "obj-x", 5, false),
        ],
        mission_metadata: MissionMetadata {
            weekly_refill_time: "2026-10-27T00:00:00Z".to_owned(),
            ..MissionMetadata::default()
        },
        ..Contracts::default()
    }
}

fn account() -> AccountXp {
    AccountXp {
        progress: LevelProgress {
            level: 142,
            xp: 3100,
        },
        ..AccountXp::default()
    }
}

fn view(tier: u32, towards_next: i64, owned: Option<&HashSet<String>>) -> ProgressView {
    let contracts = contracts(tier, towards_next);
    let account = account();
    let inputs = ProgressInputs {
        contracts: &contracts,
        account: &account,
        act_id: "act-5",
        owned_contracts: owned,
        recruitment_event: None,
    };
    progress_view(&index(), &inputs)
}

#[test]
fn account_level_and_refill_are_read() {
    let view = view(0, 0, None);

    assert_eq!((view.account_level, view.account_xp), (142, 3100));
    assert_eq!(view.weekly_refill_at, "2026-10-27T00:00:00Z");
}

#[test]
fn battle_pass_is_the_contract_of_the_active_act() {
    let pass = view(1, 1200, None).battle_pass.expect("pass");

    assert_eq!(pass.name, "Season 2026 // Act V");
    assert_eq!((pass.tier, pass.tier_count), (1, 3));
    assert_eq!(pass.xp_left, 1800);
    assert_eq!(pass.ends_at.as_deref(), Some("2026-10-14T00:00:00Z"));
}

#[test]
fn next_reward_is_what_the_next_tier_unlocks() {
    let reward = view(1, 0, None)
        .battle_pass
        .and_then(|pass| pass.next_reward)
        .expect("reward");

    assert_eq!(reward.name, "Reaver Vandal");
    assert_eq!(
        reward.image,
        Some(image_url(
            "https://media.valorant-api.com/skinlevels/l1.png"
        ))
    );
}

#[test]
fn currency_rewards_name_the_amount() {
    let reward = view(2, 0, None)
        .battle_pass
        .and_then(|pass| pass.next_reward)
        .expect("reward");

    assert_eq!(reward.name, "10 VALORANT Points");
}

#[test]
fn a_finished_pass_has_no_next_reward_and_no_xp_left() {
    let pass = view(3, 0, None).battle_pass.expect("pass");

    assert_eq!(pass.next_reward, None);
    assert_eq!(pass.xp_left, 0);
}

#[test]
fn premium_ownership_is_unknown_without_entitlements() {
    let owned: HashSet<String> = ["pass-act-5".to_owned()].into_iter().collect();

    assert_eq!(view(0, 0, None).battle_pass.unwrap().is_premium_owned, None);
    assert_eq!(
        view(0, 0, Some(&owned))
            .battle_pass
            .unwrap()
            .is_premium_owned,
        Some(true)
    );
    assert_eq!(
        view(0, 0, Some(&HashSet::new()))
            .battle_pass
            .unwrap()
            .is_premium_owned,
        Some(false)
    );
}

#[test]
fn no_pass_when_the_act_is_unknown() {
    let contracts = contracts(0, 0);
    let account = account();
    let inputs = ProgressInputs {
        contracts: &contracts,
        account: &account,
        act_id: "",
        owned_contracts: None,
        recruitment_event: None,
    };

    assert_eq!(progress_view(&index(), &inputs).battle_pass, None);
}

#[test]
fn missions_are_split_by_kind_with_goals_and_progress() {
    let view = view(0, 0, None);

    let kills = &view.weekly_missions[0];
    assert_eq!(
        (kills.title.as_str(), kills.done, kills.goal, kills.xp),
        ("Kill Enemies", 37, 100, 23800)
    );
    assert!(!kills.is_complete);
    assert_eq!(
        view.weekly_missions[1].done, 200,
        "a complete mission shows its goal"
    );
    assert_eq!(view.daily_missions.len(), 1);
    assert_eq!(
        view.weekly_missions.len(),
        2,
        "undescribed missions are left out"
    );
}
