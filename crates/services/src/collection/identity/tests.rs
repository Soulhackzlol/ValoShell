use riot::api::pd::loadout::{Expression, Identity};

use super::*;
use crate::assets::{AssetSource, fixtures};

const VANDAL: &str = "weapon-vandal";
const BUDDY_LEVEL: &str = "buddy-level-1";

fn index() -> AssetIndex {
    AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
}

fn gun(id: &str, instance: Option<&str>) -> Gun {
    Gun {
        id: id.to_owned(),
        charm_id: instance.map(|_| "buddy-1".to_owned()),
        charm_level_id: instance.map(|_| BUDDY_LEVEL.to_owned()),
        charm_instance_id: instance.map(str::to_owned),
        ..Gun::default()
    }
}

fn loadout() -> PlayerLoadout {
    PlayerLoadout {
        guns: vec![gun(VANDAL, None), gun("weapon-other", Some("copy-a"))],
        active_expressions: vec![
            Expression {
                type_id: ITEM_TYPE_SPRAYS.to_owned(),
                asset_id: "old-spray".to_owned(),
                ..Expression::default()
            },
            Expression {
                type_id: ITEM_TYPE_FLEX.to_owned(),
                asset_id: "flex-1".to_owned(),
                ..Expression::default()
            },
        ],
        identity: Identity {
            player_card_id: "CARD-1".to_owned(),
            player_title_id: "title-1".to_owned(),
            ..Identity::default()
        },
        ..PlayerLoadout::default()
    }
}

fn owned(ids: &[&str]) -> HashSet<String> {
    ids.iter().map(|id| (*id).to_owned()).collect()
}

fn copy(instance: &str) -> BuddyCopy {
    BuddyCopy {
        level_id: BUDDY_LEVEL.to_owned(),
        instance_id: instance.to_owned(),
    }
}

fn apply(
    loadout: &mut PlayerLoadout,
    change: &IdentityChange,
    ids: &[&str],
    buddies: &[BuddyCopy],
) -> Result<(), ActionError> {
    let owned = owned(ids);
    let ownership = Ownership {
        owned: &owned,
        buddies,
    };
    apply_change(loadout, &index(), change, &ownership)
}

#[test]
fn identity_names_the_card_title_and_wheel() {
    let view = identity_view(&index(), &loadout());

    assert_eq!(
        view.card.as_ref().map(|card| card.name.as_str()),
        Some("Prime Card")
    );
    assert!(view.card.and_then(|card| card.wide_image).is_some());
    assert_eq!(
        view.title.map(|title| title.name),
        Some("Radiant".to_owned())
    );
    let kinds: Vec<CosmeticKind> = view.expressions.iter().map(|slot| slot.kind).collect();
    assert_eq!(kinds, [CosmeticKind::Spray, CosmeticKind::Flex]);
    assert_eq!(
        view.expressions[0].item, None,
        "an unknown spray shows as empty"
    );
    assert_eq!(
        view.expressions[1]
            .item
            .as_ref()
            .map(|item| item.name.as_str()),
        Some("Ghost Datalink")
    );
}

#[test]
fn only_known_guns_get_a_buddy_line() {
    let view = identity_view(&index(), &loadout());

    let weapons: Vec<&str> = view
        .buddies
        .iter()
        .map(|line| line.weapon_name.as_str())
        .collect();
    assert_eq!(weapons, ["Vandal"]);
}

#[test]
fn options_include_what_is_worn_even_if_not_owned() {
    let options = cosmetic_options(
        &index(),
        CosmeticKind::Spray,
        &owned(&["spray-1"]),
        &["old-spray".to_owned()],
    );

    let names: Vec<&str> = options.iter().map(|option| option.name.as_str()).collect();
    assert_eq!(
        names,
        ["Nice Spray"],
        "unknown ids are left out, known ones named"
    );
}

#[test]
fn an_owned_card_is_equipped_and_an_unowned_one_refused() {
    let mut loadout = loadout();

    let refused = apply(
        &mut loadout,
        &IdentityChange::Card {
            id: "card-2".to_owned(),
        },
        &["card-1"],
        &[],
    );
    assert!(refused.is_err());
    assert_eq!(loadout.identity.player_card_id, "CARD-1");

    apply(
        &mut loadout,
        &IdentityChange::Card {
            id: "CARD-1".to_owned(),
        },
        &["card-1"],
        &[],
    )
    .unwrap();
    assert_eq!(loadout.identity.player_card_id, "card-1");
}

#[test]
fn a_wheel_change_swaps_only_the_asset() {
    let mut loadout = loadout();

    let change = IdentityChange::Expression {
        slot: 0,
        id: "spray-1".to_owned(),
    };
    apply(&mut loadout, &change, &["spray-1"], &[]).unwrap();

    assert_eq!(loadout.active_expressions[0].asset_id, "spray-1");
    assert_eq!(loadout.active_expressions[0].type_id, ITEM_TYPE_SPRAYS);
    let missing = IdentityChange::Expression {
        slot: 9,
        id: "spray-1".to_owned(),
    };
    assert!(apply(&mut loadout, &missing, &["spray-1"], &[]).is_err());
}

#[test]
fn a_wheel_slot_takes_items_of_its_own_kind() {
    let loadout = loadout();

    let spray_slot = IdentityChange::Expression {
        slot: 0,
        id: "x".to_owned(),
    };
    let flex_slot = IdentityChange::Expression {
        slot: 1,
        id: "x".to_owned(),
    };

    assert_eq!(
        change_kind(&loadout, &spray_slot),
        Some(CosmeticKind::Spray)
    );
    assert_eq!(change_kind(&loadout, &flex_slot), Some(CosmeticKind::Flex));
}

#[test]
fn a_free_buddy_copy_is_used_before_moving_one() {
    let mut loadout = loadout();

    let change = IdentityChange::Buddy {
        weapon_id: VANDAL.to_owned(),
        id: Some(BUDDY_LEVEL.to_owned()),
    };
    apply(
        &mut loadout,
        &change,
        &[],
        &[copy("copy-a"), copy("copy-b")],
    )
    .unwrap();

    assert_eq!(loadout.guns[0].charm_instance_id.as_deref(), Some("copy-b"));
    assert_eq!(loadout.guns[0].charm_id.as_deref(), Some("buddy-1"));
    assert_eq!(
        loadout.guns[1].charm_instance_id.as_deref(),
        Some("copy-a"),
        "the other gun keeps its copy"
    );
}

#[test]
fn the_only_copy_moves_from_the_gun_that_wore_it() {
    let mut loadout = loadout();

    let change = IdentityChange::Buddy {
        weapon_id: VANDAL.to_owned(),
        id: Some(BUDDY_LEVEL.to_owned()),
    };
    apply(&mut loadout, &change, &[], &[copy("copy-a")]).unwrap();

    assert_eq!(loadout.guns[0].charm_instance_id.as_deref(), Some("copy-a"));
    assert_eq!(loadout.guns[1].charm_instance_id, None);
    assert_eq!(loadout.guns[1].charm_level_id, None);
}

#[test]
fn a_buddy_can_be_taken_off_and_unowned_ones_are_refused() {
    let mut loadout = loadout();

    let off = IdentityChange::Buddy {
        weapon_id: "weapon-other".to_owned(),
        id: None,
    };
    apply(&mut loadout, &off, &[], &[]).unwrap();
    assert_eq!(loadout.guns[1].charm_id, None);

    let unowned = IdentityChange::Buddy {
        weapon_id: VANDAL.to_owned(),
        id: Some(BUDDY_LEVEL.to_owned()),
    };
    assert!(apply(&mut loadout, &unowned, &[], &[]).is_err());
}

#[test]
fn changes_decode_from_the_ui_shape() {
    let change: IdentityChange =
        serde_json::from_str(r#"{"kind":"buddy","weapon_id":"w","id":null}"#).unwrap();

    assert_eq!(
        change,
        IdentityChange::Buddy {
            weapon_id: "w".to_owned(),
            id: None
        }
    );
}

const FREE_CARD: &str = "9fb348bc-41a0-91ad-8a3e-818035c4e561";
const FREE_SPRAY: &str = "0a6db78c-48b9-a32d-c47a-82be597584c1";

fn spray_slot(asset: &str) -> Expression {
    Expression {
        type_id: ITEM_TYPE_SPRAYS.to_owned(),
        asset_id: asset.to_owned(),
        ..Expression::default()
    }
}

fn wheel(assets: &[&str]) -> Vec<String> {
    assets.iter().map(|asset| (*asset).to_owned()).collect()
}

#[test]
fn free_items_count_as_owned_for_their_own_kind_only() {
    let cards = with_free_items(owned(&["card-1"]), &index(), CosmeticKind::Card);
    let sprays = with_free_items(HashSet::new(), &index(), CosmeticKind::Spray);

    assert!(cards.contains(FREE_CARD) && cards.contains("card-1"));
    assert!(!cards.contains(FREE_SPRAY), "a spray is never a card");
    assert!(sprays.contains(FREE_SPRAY) && sprays.contains(EMPTY_SPRAY));
}

#[test]
fn a_spray_worn_in_another_slot_swaps_instead_of_repeating() {
    let mut loadout = loadout();
    loadout.active_expressions = vec![spray_slot("spray-1"), spray_slot("spray-2")];

    set_expression(&mut loadout, 1, "SPRAY-1").unwrap();

    let assets: Vec<String> = loadout
        .active_expressions
        .iter()
        .map(|expression| expression.asset_id.clone())
        .collect();
    assert_eq!(assets, wheel(&["spray-2", "spray-1"]));
}

#[test]
fn the_empty_slot_may_repeat() {
    let mut loadout = loadout();
    loadout.active_expressions = vec![spray_slot(EMPTY_SPRAY), spray_slot("spray-2")];

    set_expression(&mut loadout, 1, EMPTY_SPRAY).unwrap();

    assert_eq!(loadout.active_expressions[0].asset_id, EMPTY_SPRAY);
    assert_eq!(loadout.active_expressions[1].asset_id, EMPTY_SPRAY);
}

#[test]
fn knives_never_get_a_buddy() {
    let mut loadout = loadout();
    loadout.guns.push(gun("weapon-knife", None));
    let before = serde_json::to_value(&loadout).unwrap();

    let refused = set_buddy(
        &mut loadout,
        &index(),
        Some(&copy("copy-a")),
        "weapon-knife",
    );

    assert!(refused.is_err());
    assert_eq!(serde_json::to_value(&loadout).unwrap(), before);
}

#[test]
fn a_refused_buddy_leaves_every_gun_as_it_was() {
    let mut loadout = loadout();
    let before = serde_json::to_value(&loadout).unwrap();
    let unknown = BuddyCopy {
        level_id: "no-such-level".to_owned(),
        instance_id: "copy-a".to_owned(),
    };

    assert!(set_buddy(&mut loadout, &index(), Some(&unknown), VANDAL).is_err());
    assert_eq!(
        serde_json::to_value(&loadout).unwrap(),
        before,
        "the other gun keeps copy-a"
    );
}
