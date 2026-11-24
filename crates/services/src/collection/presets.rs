//! Loadout presets: a named snapshot of every gun's skin, chroma and buddy plus the card, title
//! and wheel, equipped again in one PUT. Applying checks ownership item by item: whatever is
//! no longer owned (or no longer exists) is skipped and counted, never forced.

use std::collections::HashSet;

use riot::api::pd::loadout::PlayerLoadout;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::identity::{BuddyCopy, CosmeticKind, set_buddy, set_expression};
use super::view::{CollectionView, Owned, equipped_gun, is_skin_owned};
use crate::assets::AssetIndex;

/// The preset file format; bump when a field changes meaning.
const PRESET_VERSION: u32 = 1;

/// One gun as the preset remembers it.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct PresetGun {
    pub weapon_id: String,
    pub skin_id: String,
    pub chroma_id: String,
    /// The buddy copy it wore, if any.
    pub buddy: Option<PresetBuddy>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct PresetBuddy {
    pub level_id: String,
    pub instance_id: String,
}

/// A saved loadout (stored as a JSON document in the `loadouts` folder).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct LoadoutPreset {
    pub version: u32,
    pub guns: Vec<PresetGun>,
    /// Wheel assets by slot position.
    pub expressions: Vec<String>,
    pub card: String,
    pub title: String,
}

/// What applying a preset changed.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PresetApplied {
    pub collection: CollectionView,
    /// Items left as they were because they are no longer owned or known.
    pub skipped: u32,
}

/// Everything the player owns that a preset may name.
pub struct PresetOwnership<'a> {
    pub skins: &'a Owned,
    pub cards: &'a HashSet<String>,
    pub titles: &'a HashSet<String>,
    pub sprays: &'a HashSet<String>,
    pub flex: &'a HashSet<String>,
    pub buddies: &'a [BuddyCopy],
}

/// The preset of the loadout as it is now.
pub fn preset_of(loadout: &PlayerLoadout) -> LoadoutPreset {
    let guns = loadout
        .guns
        .iter()
        .map(|gun| PresetGun {
            weapon_id: gun.id.to_lowercase(),
            skin_id: gun.skin_id.to_lowercase(),
            chroma_id: gun.chroma_id.to_lowercase(),
            buddy: gun
                .charm_level_id
                .as_ref()
                .zip(gun.charm_instance_id.as_ref())
                .map(|(level, instance)| PresetBuddy {
                    level_id: level.to_lowercase(),
                    instance_id: instance.clone(),
                }),
        })
        .collect();
    LoadoutPreset {
        version: PRESET_VERSION,
        guns,
        expressions: loadout
            .active_expressions
            .iter()
            .map(|expression| expression.asset_id.to_lowercase())
            .collect(),
        card: loadout.identity.player_card_id.to_lowercase(),
        title: loadout.identity.player_title_id.to_lowercase(),
    }
}

/// Put one gun's skin back; `false` when the skin is no longer owned or known, or (in a
/// hand-edited file) belongs to another weapon.
fn apply_skin(
    loadout: &mut PlayerLoadout,
    index: &AssetIndex,
    gun: &PresetGun,
    owned: &Owned,
) -> bool {
    let weapon = index
        .weapon_of_skin(&gun.skin_id)
        .filter(|weapon| weapon.uuid.eq_ignore_ascii_case(&gun.weapon_id));
    let (Some(weapon), Some(skin)) = (weapon, index.skin(&gun.skin_id)) else {
        return false;
    };
    let entry = is_skin_owned(&skin, &weapon, owned)
        .then(|| equipped_gun(&skin, &gun.chroma_id, owned))
        .flatten();
    let (Some((skin_id, level_id, chroma_id)), Some(target)) =
        (entry, loadout.gun_mut(&gun.weapon_id))
    else {
        return false;
    };
    target.skin_id = skin_id;
    target.skin_level_id = level_id;
    target.chroma_id = chroma_id;
    true
}

/// Put one gun's buddy back (or take it off); `false` when that copy is no longer owned.
fn apply_buddy(
    loadout: &mut PlayerLoadout,
    index: &AssetIndex,
    gun: &PresetGun,
    copies: &[BuddyCopy],
) -> bool {
    let copy = gun.buddy.as_ref().map(|buddy| {
        copies.iter().find(|copy| {
            copy.instance_id.eq_ignore_ascii_case(&buddy.instance_id)
                && copy.level_id.eq_ignore_ascii_case(&buddy.level_id)
        })
    });
    match copy {
        Some(None) => false,
        Some(Some(copy)) => set_buddy(loadout, index, Some(copy), &gun.weapon_id).is_ok(),
        None => set_buddy(loadout, index, None, &gun.weapon_id).is_ok(),
    }
}

/// The wheel back slot by slot, each only with an owned item of that slot's kind. Items swap
/// rather than repeat, so a preset that reorders the wheel never wears one item twice.
fn apply_wheel(
    loadout: &mut PlayerLoadout,
    preset: &LoadoutPreset,
    ownership: &PresetOwnership<'_>,
) -> u32 {
    let mut skipped = 0;
    for (slot, asset) in preset.expressions.iter().enumerate() {
        let Some(expression) = loadout.active_expressions.get(slot) else {
            break;
        };
        if expression.asset_id.eq_ignore_ascii_case(asset) {
            continue;
        }
        let is_flex = expression
            .type_id
            .eq_ignore_ascii_case(CosmeticKind::Flex.item_type());
        let owned = if is_flex {
            ownership.flex
        } else {
            ownership.sprays
        };
        if !owned.contains(asset) || set_expression(loadout, slot, asset).is_err() {
            skipped += 1;
        }
    }
    skipped
}

/// Swap `current` for `wanted` when owned (or already worn); `true` when it was skipped.
fn apply_identity_id(current: &mut String, wanted: &str, owned: &HashSet<String>) -> bool {
    if wanted.is_empty() || current.eq_ignore_ascii_case(wanted) {
        return false;
    }
    if !owned.contains(wanted) {
        return true;
    }
    *current = wanted.to_owned();
    false
}

/// Apply a preset onto a fresh loadout; returns how many items were skipped.
pub fn apply_preset(
    loadout: &mut PlayerLoadout,
    index: &AssetIndex,
    preset: &LoadoutPreset,
    ownership: &PresetOwnership<'_>,
) -> u32 {
    let mut skipped = 0;
    for gun in &preset.guns {
        skipped += u32::from(!apply_skin(loadout, index, gun, ownership.skins));
        skipped += u32::from(!apply_buddy(loadout, index, gun, ownership.buddies));
    }
    skipped += apply_wheel(loadout, preset, ownership);
    let identity = &mut loadout.identity;
    skipped += u32::from(apply_identity_id(
        &mut identity.player_card_id,
        &preset.card,
        ownership.cards,
    ));
    skipped += u32::from(apply_identity_id(
        &mut identity.player_title_id,
        &preset.title,
        ownership.titles,
    ));
    skipped
}

#[cfg(test)]
mod tests;
