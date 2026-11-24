use riot::api::pd::entitlements::{ITEM_TYPE_FLEX, ITEM_TYPE_SPRAYS};
use riot::api::pd::loadout::{Expression, Gun, Identity};

use super::*;
use crate::assets::{AssetSource, fixtures};

const VANDAL: &str = "weapon-vandal";

fn index() -> AssetIndex {
    AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
}

fn ids(values: &[&str]) -> HashSet<String> {
    values.iter().map(|value| (*value).to_owned()).collect()
}

fn loadout() -> PlayerLoadout {
    PlayerLoadout {
        guns: vec![Gun {
            id: VANDAL.to_owned(),
            skin_id: "skin-standard".to_owned(),
            skin_level_id: "standard-level".to_owned(),
            chroma_id: "standard-chroma".to_owned(),
            ..Gun::default()
        }],
        active_expressions: vec![
            Expression {
                type_id: ITEM_TYPE_SPRAYS.to_owned(),
                asset_id: "spray-old".to_owned(),
                ..Expression::default()
            },
            Expression {
                type_id: ITEM_TYPE_FLEX.to_owned(),
                asset_id: "flex-old".to_owned(),
                ..Expression::default()
            },
        ],
        identity: Identity {
            player_card_id: "card-old".to_owned(),
            player_title_id: "title-old".to_owned(),
            ..Identity::default()
        },
        ..PlayerLoadout::default()
    }
}

fn preset() -> LoadoutPreset {
    LoadoutPreset {
        version: PRESET_VERSION,
        guns: vec![PresetGun {
            weapon_id: VANDAL.to_owned(),
            skin_id: "skin-reaver".to_owned(),
            chroma_id: "chroma-1".to_owned(),
            buddy: Some(PresetBuddy {
                level_id: "buddy-level-1".to_owned(),
                instance_id: "copy-a".to_owned(),
            }),
        }],
        expressions: vec!["spray-1".to_owned(), "flex-1".to_owned()],
        card: "card-1".to_owned(),
        title: "title-1".to_owned(),
    }
}

struct Owns {
    skins: Owned,
    cards: HashSet<String>,
    titles: HashSet<String>,
    sprays: HashSet<String>,
    flex: HashSet<String>,
    buddies: Vec<BuddyCopy>,
}

fn owns_everything() -> Owns {
    Owns {
        skins: Owned {
            skin_levels: ids(&["level-1"]),
            chromas: HashSet::new(),
        },
        cards: ids(&["card-1"]),
        titles: ids(&["title-1"]),
        sprays: ids(&["spray-1"]),
        flex: ids(&["flex-1"]),
        buddies: vec![BuddyCopy {
            level_id: "buddy-level-1".to_owned(),
            instance_id: "copy-a".to_owned(),
        }],
    }
}

fn apply(loadout: &mut PlayerLoadout, preset: &LoadoutPreset, owns: &Owns) -> u32 {
    let ownership = PresetOwnership {
        skins: &owns.skins,
        cards: &owns.cards,
        titles: &owns.titles,
        sprays: &owns.sprays,
        flex: &owns.flex,
        buddies: &owns.buddies,
    };
    apply_preset(loadout, &index(), preset, &ownership)
}

#[test]
fn a_snapshot_keeps_skins_buddies_wheel_and_identity() {
    let mut loadout = loadout();
    loadout.guns[0].charm_level_id = Some("Buddy-Level-1".to_owned());
    loadout.guns[0].charm_instance_id = Some("copy-a".to_owned());

    let snapshot = preset_of(&loadout);

    assert_eq!(snapshot.version, PRESET_VERSION);
    assert_eq!(snapshot.guns[0].skin_id, "skin-standard");
    assert_eq!(
        snapshot.guns[0]
            .buddy
            .as_ref()
            .map(|buddy| buddy.level_id.as_str()),
        Some("buddy-level-1")
    );
    assert_eq!(snapshot.expressions, ["spray-old", "flex-old"]);
    assert_eq!(
        (snapshot.card.as_str(), snapshot.title.as_str()),
        ("card-old", "title-old")
    );
}

#[test]
fn an_owned_preset_applies_in_full() {
    let mut loadout = loadout();

    let skipped = apply(&mut loadout, &preset(), &owns_everything());

    assert_eq!(skipped, 0);
    let gun = &loadout.guns[0];
    assert_eq!(
        (gun.skin_id.as_str(), gun.skin_level_id.as_str()),
        ("skin-reaver", "level-1")
    );
    assert_eq!(
        gun.chroma_id, "chroma-1",
        "the base chroma comes with the skin"
    );
    assert_eq!(gun.charm_instance_id.as_deref(), Some("copy-a"));
    assert_eq!(loadout.active_expressions[0].asset_id, "spray-1");
    assert_eq!(loadout.active_expressions[1].asset_id, "flex-1");
    assert_eq!(loadout.identity.player_card_id, "card-1");
    assert_eq!(loadout.identity.player_title_id, "title-1");
}

#[test]
fn items_no_longer_owned_are_skipped_and_counted() {
    let mut loadout = loadout();
    let owns = Owns {
        skins: Owned::default(),
        cards: HashSet::new(),
        buddies: Vec::new(),
        ..owns_everything()
    };

    let skipped = apply(&mut loadout, &preset(), &owns);

    assert_eq!(skipped, 3, "skin, buddy and card");
    assert_eq!(loadout.guns[0].skin_id, "skin-standard");
    assert_eq!(loadout.guns[0].charm_instance_id, None);
    assert_eq!(loadout.identity.player_card_id, "card-old");
    assert_eq!(
        loadout.identity.player_title_id, "title-1",
        "the rest still applies"
    );
}

#[test]
fn a_wheel_slot_only_takes_its_own_kind() {
    let mut loadout = loadout();
    let mut swapped = preset();
    swapped.expressions = vec!["flex-1".to_owned(), "spray-1".to_owned()];

    let skipped = apply(&mut loadout, &swapped, &owns_everything());

    assert_eq!(skipped, 2);
    assert_eq!(loadout.active_expressions[0].asset_id, "spray-old");
    assert_eq!(loadout.active_expressions[1].asset_id, "flex-old");
}

#[test]
fn a_gun_without_a_buddy_in_the_preset_loses_its_buddy() {
    let mut loadout = loadout();
    loadout.guns[0].charm_instance_id = Some("copy-b".to_owned());
    loadout.guns[0].charm_level_id = Some("buddy-level-1".to_owned());
    let mut bare = preset();
    bare.guns[0].buddy = None;

    apply(&mut loadout, &bare, &owns_everything());

    assert_eq!(loadout.guns[0].charm_instance_id, None);
}

#[test]
fn presets_round_trip_as_json() {
    let saved = serde_json::to_value(preset()).unwrap();

    let loaded: LoadoutPreset = serde_json::from_value(saved).unwrap();

    assert_eq!(loaded, preset());
}

const FREE_SPRAY: &str = "0a6db78c-48b9-a32d-c47a-82be597584c1";

#[test]
fn a_reordered_wheel_swaps_and_never_wears_one_spray_twice() {
    let mut loadout = loadout();
    for (expression, asset) in loadout
        .active_expressions
        .iter_mut()
        .zip([FREE_SPRAY, "spray-1"])
    {
        expression.type_id = ITEM_TYPE_SPRAYS.to_owned();
        expression.asset_id = asset.to_owned();
    }
    let mut preset = preset();
    preset.expressions = vec!["spray-1".to_owned(), FREE_SPRAY.to_owned()];
    let mut owns = owns_everything();
    owns.sprays.insert(FREE_SPRAY.to_owned());

    apply(&mut loadout, &preset, &owns);

    let assets: Vec<&str> = loadout
        .active_expressions
        .iter()
        .map(|expression| expression.asset_id.as_str())
        .collect();
    assert_eq!(assets, ["spray-1", FREE_SPRAY]);
}

#[test]
fn a_skin_is_never_put_on_another_weapon() {
    let mut loadout = loadout();
    loadout.guns.push(Gun {
        id: "weapon-phantom".to_owned(),
        skin_id: "phantom-standard".to_owned(),
        ..Gun::default()
    });
    let mut preset = preset();
    preset.guns = vec![PresetGun {
        weapon_id: "weapon-phantom".to_owned(),
        skin_id: "skin-reaver".to_owned(),
        ..PresetGun::default()
    }];

    let skipped = apply(&mut loadout, &preset, &owns_everything());

    assert_eq!(loadout.guns[1].skin_id, "phantom-standard");
    assert_eq!(skipped, 1, "only the skin is skipped");
}
