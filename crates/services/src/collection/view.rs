//! Collection view models: the equipped skin per weapon and the owned options to equip.
//! Pure functions over the asset index, the loadout and the owned item ids.

use std::collections::HashSet;

use riot::api::pd::loadout::{Gun, PlayerLoadout};
use serde::Serialize;
use ts_rs::TS;

use crate::assets::{AssetIndex, Skin, Weapon, image_url};

/// Menu order of weapon categories (as the in-game collection lists them).
const CATEGORY_ORDER: [&str; 7] = [
    "Sidearm", "SMG", "Shotgun", "Rifle", "Sniper", "Heavy", "Melee",
];

/// Owned item ids, lowercase.
#[derive(Debug, Clone, Default)]
pub struct Owned {
    pub skin_levels: HashSet<String>,
    pub chromas: HashSet<String>,
}

/// One weapon slot with what it wears.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct WeaponSlot {
    pub weapon_id: String,
    pub weapon_name: String,
    /// `Rifle`, `Sidearm`...
    pub category: String,
    pub skin_id: String,
    pub skin_name: String,
    pub chroma_id: String,
    pub image: Option<String>,
    /// Edition of the equipped skin (`Select` ... `Ultra`); none for the standard skin.
    pub edition: Option<String>,
}

/// A chroma (colour variant) of a skin.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ChromaOption {
    pub chroma_id: String,
    pub name: String,
    pub swatch: Option<String>,
    pub image: Option<String>,
    /// The chroma's showcase video (streamed, not cached), when it has one.
    pub video: Option<String>,
    pub is_owned: bool,
}

/// One upgrade level of a skin.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct LevelOption {
    pub level_id: String,
    pub name: String,
    /// What the level adds: `VFX`, `Animation`, `Finisher`, `KillCounter`...; none for level 1.
    pub effect: Option<String>,
    /// The level's showcase video, when it has one.
    pub video: Option<String>,
    pub is_owned: bool,
}

/// An owned skin that can go on a weapon.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SkinOption {
    pub skin_id: String,
    pub name: String,
    pub image: Option<String>,
    pub chromas: Vec<ChromaOption>,
    /// Owned upgrade levels out of the skin's total.
    pub owned_levels: u32,
    pub total_levels: u32,
    pub levels: Vec<LevelOption>,
    /// `Select`, `Deluxe`, `Premium`, `Exclusive` or `Ultra`; none for default and battle pass skins.
    pub edition: Option<String>,
}

/// The collection scene.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct CollectionView {
    pub weapons: Vec<WeaponSlot>,
}

/// `EEquippableCategory::Rifle` -> `Rifle`.
fn category_of(weapon: &Weapon) -> String {
    weapon
        .category
        .as_deref()
        .and_then(|raw| raw.rsplit("::").next())
        .unwrap_or("Other")
        .to_owned()
}

fn category_rank(category: &str) -> usize {
    CATEGORY_ORDER
        .iter()
        .position(|known| *known == category)
        .unwrap_or(CATEGORY_ORDER.len())
}

/// The picture of a skin in one chroma: the chroma render, else the skin's own icon.
pub(super) fn skin_image(skin: &Skin, chroma_id: &str) -> Option<String> {
    let chroma = skin
        .chromas
        .iter()
        .find(|chroma| chroma.uuid.eq_ignore_ascii_case(chroma_id))
        .or_else(|| skin.chromas.first());
    chroma
        .and_then(|chroma| {
            chroma
                .full_render
                .clone()
                .or_else(|| chroma.display_icon.clone())
        })
        .or_else(|| skin.display_icon.clone())
        .as_deref()
        .map(image_url)
}

fn slot(index: &AssetIndex, weapon: &Weapon, gun: Option<&Gun>) -> WeaponSlot {
    let skin = gun.and_then(|gun| index.skin(&gun.skin_id));
    let chroma_id = gun
        .map(|gun| gun.chroma_id.to_lowercase())
        .unwrap_or_default();
    WeaponSlot {
        weapon_id: weapon.uuid.to_lowercase(),
        weapon_name: weapon.display_name.clone(),
        category: category_of(weapon),
        skin_id: skin
            .as_ref()
            .map(|skin| skin.uuid.to_lowercase())
            .unwrap_or_default(),
        skin_name: skin.as_ref().map_or_else(
            || weapon.display_name.clone(),
            |skin| skin.display_name.clone(),
        ),
        image: skin
            .as_ref()
            .and_then(|skin| skin_image(skin, &chroma_id))
            .or_else(|| weapon.display_icon.as_deref().map(image_url)),
        edition: skin
            .as_ref()
            .and_then(|skin| skin.content_tier_uuid.as_deref())
            .and_then(edition_of),
        chroma_id,
    }
}

/// Every weapon in menu order with its equipped skin.
pub fn collection_view(index: &AssetIndex, loadout: &PlayerLoadout) -> CollectionView {
    let mut weapons: Vec<WeaponSlot> = index
        .weapons()
        .iter()
        .map(|weapon| {
            let gun = loadout
                .guns
                .iter()
                .find(|gun| gun.id.eq_ignore_ascii_case(&weapon.uuid));
            slot(index, weapon, gun)
        })
        .collect();
    weapons.sort_by(|a, b| {
        category_rank(&a.category)
            .cmp(&category_rank(&b.category))
            .then_with(|| a.weapon_name.cmp(&b.weapon_name))
    });
    CollectionView { weapons }
}

/// A skin is owned when its first level is (default skins are always owned).
pub(super) fn is_skin_owned(skin: &Skin, weapon: &Weapon, owned: &Owned) -> bool {
    let is_default = weapon
        .default_skin_uuid
        .as_deref()
        .is_some_and(|default| default.eq_ignore_ascii_case(&skin.uuid));
    is_default
        || skin
            .levels
            .first()
            .is_some_and(|level| owned.skin_levels.contains(&level.uuid.to_lowercase()))
}

fn skin_option(skin: &Skin, owned: &Owned) -> SkinOption {
    let chromas = chroma_options(skin, owned);
    let levels = level_options(skin, owned);
    let owned_levels = skin
        .levels
        .iter()
        .filter(|level| owned.skin_levels.contains(&level.uuid.to_lowercase()))
        .count();
    SkinOption {
        skin_id: skin.uuid.to_lowercase(),
        name: skin.display_name.clone(),
        image: skin_image(skin, ""),
        chromas,
        owned_levels: u32::try_from(owned_levels.max(1)).unwrap_or(1),
        total_levels: u32::try_from(skin.levels.len().max(1)).unwrap_or(1),
        levels,
        edition: skin.content_tier_uuid.as_deref().and_then(edition_of),
    }
}

fn chroma_options(skin: &Skin, owned: &Owned) -> Vec<ChromaOption> {
    skin.chromas
        .iter()
        .enumerate()
        .map(|(position, chroma)| ChromaOption {
            chroma_id: chroma.uuid.to_lowercase(),
            name: chroma.display_name.clone(),
            swatch: chroma.swatch.as_deref().map(image_url),
            image: chroma
                .full_render
                .clone()
                .or_else(|| chroma.display_icon.clone())
                .as_deref()
                .map(image_url),
            video: chroma.streamed_video.clone(),
            // The base chroma comes with the skin; the others are bought or unlocked.
            is_owned: position == 0 || owned.chromas.contains(&chroma.uuid.to_lowercase()),
        })
        .collect()
}

fn level_options(skin: &Skin, owned: &Owned) -> Vec<LevelOption> {
    skin.levels
        .iter()
        .enumerate()
        .map(|(position, level)| LevelOption {
            level_id: level.uuid.to_lowercase(),
            name: level.display_name.clone(),
            effect: level.level_item.as_deref().map(level_effect),
            video: level.streamed_video.clone(),
            // Level 1 comes with the skin.
            is_owned: position == 0 || owned.skin_levels.contains(&level.uuid.to_lowercase()),
        })
        .collect()
}

/// `EEquippableSkinLevelItem::VFX` -> `VFX`.
fn level_effect(item: &str) -> String {
    item.rsplit("::").next().unwrap_or(item).to_owned()
}

/// Content tier uuid -> edition name.
pub(crate) fn edition_of(tier_uuid: &str) -> Option<String> {
    let name = match tier_uuid.to_lowercase().as_str() {
        "12683d76-48d7-84a3-4e09-6985794f0445" => "Select",
        "0cebb8be-46d7-c12a-d306-e9907bfc5a25" => "Deluxe",
        "60bca009-4182-7998-dee7-b8a2558dc369" => "Premium",
        "e046854e-406c-37f4-6607-19a9ba8426fc" => "Exclusive",
        "411e4a55-4e59-7757-41f0-86a53f101bb5" => "Ultra",
        _ => return None,
    };
    Some(name.to_owned())
}

/// Owned skins of one weapon, the default skin first, then alphabetical.
pub fn skin_options(index: &AssetIndex, weapon_id: &str, owned: &Owned) -> Vec<SkinOption> {
    let Some(weapon) = index.weapon(weapon_id) else {
        return Vec::new();
    };
    let mut options: Vec<(bool, SkinOption)> = weapon
        .skins
        .iter()
        .filter_map(|reference| index.skin(&reference.uuid))
        .filter(|skin| is_skin_owned(skin, &weapon, owned))
        .map(|skin| {
            let is_default = weapon
                .default_skin_uuid
                .as_deref()
                .is_some_and(|default| default.eq_ignore_ascii_case(&skin.uuid));
            (is_default, skin_option(&skin, owned))
        })
        .collect();
    options.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));
    options.into_iter().map(|(_, option)| option).collect()
}

/// The gun entry to write: the highest owned level of the skin and the requested chroma
/// (falling back to the base chroma when that one is not owned).
pub fn equipped_gun(
    skin: &Skin,
    chroma_id: &str,
    owned: &Owned,
) -> Option<(String, String, String)> {
    let level = skin
        .levels
        .iter()
        .rev()
        .find(|level| owned.skin_levels.contains(&level.uuid.to_lowercase()))
        .or_else(|| skin.levels.first())?;
    let base = skin.chromas.first()?;
    let chroma = skin
        .chromas
        .iter()
        .enumerate()
        .find(|(position, chroma)| {
            chroma.uuid.eq_ignore_ascii_case(chroma_id)
                && (*position == 0 || owned.chromas.contains(&chroma.uuid.to_lowercase()))
        })
        .map_or(base, |(_, chroma)| chroma);
    Some((
        skin.uuid.to_lowercase(),
        level.uuid.to_lowercase(),
        chroma.uuid.to_lowercase(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetSource, fixtures};

    #[test]
    fn level_effects_and_editions_read_cleanly() {
        assert_eq!(level_effect("EEquippableSkinLevelItem::VFX"), "VFX");
        assert_eq!(
            edition_of("411E4A55-4E59-7757-41F0-86A53F101BB5").as_deref(),
            Some("Ultra")
        );
        assert_eq!(edition_of("tier-1"), None);
    }

    fn index() -> AssetIndex {
        AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
    }

    fn owned(levels: &[&str], chromas: &[&str]) -> Owned {
        Owned {
            skin_levels: levels.iter().map(|id| id.to_lowercase()).collect(),
            chromas: chromas.iter().map(|id| id.to_lowercase()).collect(),
        }
    }

    #[test]
    fn owned_skins_are_listed_by_first_level() {
        let index = index();

        let none = skin_options(&index, "weapon-vandal", &owned(&[], &[]));
        let reaver = skin_options(&index, "weapon-vandal", &owned(&["level-1"], &[]));

        assert!(none.is_empty());
        assert_eq!(reaver.len(), 1);
        assert_eq!(reaver[0].name, "Reaver Vandal");
        assert_eq!((reaver[0].owned_levels, reaver[0].total_levels), (1, 2));
        let levels: Vec<(bool, Option<&str>)> = reaver[0]
            .levels
            .iter()
            .map(|level| (level.is_owned, level.video.as_deref()))
            .collect();
        assert_eq!(
            levels,
            [
                (true, None),
                (false, Some("https://media.valorant-api.com/video/l2.mp4"))
            ]
        );
        assert!(reaver[0].chromas[0].is_owned);
    }

    #[test]
    fn equipping_uses_the_highest_owned_level_and_falls_back_to_the_base_chroma() {
        let index = index();
        let skin = index.skin("skin-reaver").unwrap();

        let (skin_id, level, chroma) =
            equipped_gun(&skin, "not-owned", &owned(&["level-1", "level-2"], &[])).unwrap();

        assert_eq!(skin_id, "skin-reaver");
        assert_eq!(level, "level-2");
        assert_eq!(chroma, "chroma-1");
    }

    #[test]
    fn view_lists_weapons_with_their_equipped_skin() {
        let index = index();
        let loadout: PlayerLoadout = serde_json::from_str(
            r#"{"Guns":[{"ID":"WEAPON-VANDAL","SkinID":"skin-reaver","SkinLevelID":"level-1","ChromaID":"chroma-1"}]}"#,
        )
        .unwrap();

        let view = collection_view(&index, &loadout);

        let vandal = view
            .weapons
            .iter()
            .find(|weapon| weapon.weapon_name == "Vandal")
            .unwrap();
        assert_eq!(vandal.category, "Rifle");
        assert_eq!(vandal.skin_name, "Reaver Vandal");
        assert_eq!(vandal.chroma_id, "chroma-1");
    }
}
