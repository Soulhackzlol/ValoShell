//! Identity cosmetics: the player card, title, the spray/flex wheel and each gun's buddy.
//! Changes only swap ids inside entries the loadout already has (card, title, an expression's
//! asset, a gun's charm), so the slot layout Riot decides is never rebuilt by guesswork.

use std::collections::HashSet;

use riot::api::pd::entitlements::{
    ITEM_TYPE_BUDDIES, ITEM_TYPE_FLEX, ITEM_TYPE_PLAYER_CARDS, ITEM_TYPE_PLAYER_TITLES,
    ITEM_TYPE_SPRAYS,
};
use riot::api::pd::loadout::{Gun, PlayerLoadout};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::action::ActionError;
use crate::assets::{AssetIndex, image_url};

const MELEE_CATEGORY: &str = "EEquippableCategory::Melee";
/// The empty wheel slot ("None", asset `UnequipSpray`): the only item several slots may share.
const EMPTY_SPRAY: &str = "d7efbdd5-4a77-f858-a133-cfb8956ca1fe";
/// Free items every account wears without an entitlement, so Riot never lists them as owned:
/// the VALORANT card, the "None" title, the VALORANT spray and the empty slot (valorant-api.com
/// asset paths `Playercard_Default`, `PlayerTitle_Default`, `Spray_Default_VALLogo`,
/// `UnequipSpray`). Other cards under `PlayerCards/Default/` are not free, so ids, not paths.
const FREE_COSMETICS: [&str; 4] = [
    "9fb348bc-41a0-91ad-8a3e-818035c4e561",
    "d13e579c-435e-44d4-cec2-6eae5a3c5ed4",
    "0a6db78c-48b9-a32d-c47a-82be597584c1",
    EMPTY_SPRAY,
];

/// A kind of identity cosmetic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum CosmeticKind {
    Card,
    Title,
    Spray,
    Flex,
    Buddy,
}

impl CosmeticKind {
    /// The entitlement item type that lists owned items of this kind.
    pub fn item_type(self) -> &'static str {
        match self {
            Self::Card => ITEM_TYPE_PLAYER_CARDS,
            Self::Title => ITEM_TYPE_PLAYER_TITLES,
            Self::Spray => ITEM_TYPE_SPRAYS,
            Self::Flex => ITEM_TYPE_FLEX,
            Self::Buddy => ITEM_TYPE_BUDDIES,
        }
    }

    fn of_item_type(type_id: &str) -> Option<Self> {
        [Self::Spray, Self::Flex]
            .into_iter()
            .find(|kind| kind.item_type().eq_ignore_ascii_case(type_id))
    }
}

/// One cosmetic, named and pictured.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct CosmeticOption {
    /// Lowercase; for buddies the buddy level id the guns carry.
    pub id: String,
    pub name: String,
    pub image: Option<String>,
    /// The wide banner of a player card.
    pub wide_image: Option<String>,
}

/// One slot of the spray/flex wheel.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ExpressionSlot {
    /// Position in the loadout's wheel.
    pub slot: u32,
    pub kind: CosmeticKind,
    pub item: Option<CosmeticOption>,
}

/// The buddy hanging on one gun.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct GunBuddy {
    pub weapon_id: String,
    pub weapon_name: String,
    pub buddy: Option<CosmeticOption>,
}

/// What the player wears besides skins.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct IdentityView {
    pub card: Option<CosmeticOption>,
    pub title: Option<CosmeticOption>,
    pub expressions: Vec<ExpressionSlot>,
    pub buddies: Vec<GunBuddy>,
}

/// One change the player asked for.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum IdentityChange {
    Card {
        id: String,
    },
    Title {
        id: String,
    },
    /// The item must be of the slot's kind (a spray slot takes sprays).
    Expression {
        slot: u32,
        id: String,
    },
    /// `id: null` takes the buddy off.
    Buddy {
        weapon_id: String,
        id: Option<String>,
    },
}

/// One owned buddy copy: the level it is and the instance id a gun must carry.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuddyCopy {
    pub level_id: String,
    pub instance_id: String,
}

/// Name and pictures of one cosmetic, from the asset cache.
pub fn cosmetic(index: &AssetIndex, kind: CosmeticKind, id: &str) -> Option<CosmeticOption> {
    let art = |art: &Option<String>| art.as_deref().map(image_url);
    let (name, image, wide_image) = match kind {
        CosmeticKind::Card => index.player_card(id).map(|card| {
            (
                card.display_name.clone(),
                art(&card.small_art),
                art(&card.wide_art),
            )
        })?,
        CosmeticKind::Title => index.player_title(id).map(|title| {
            let text = title
                .title_text
                .clone()
                .unwrap_or_else(|| title.display_name.clone());
            (text, None, None)
        })?,
        CosmeticKind::Spray => index.spray(id).map(|spray| {
            let image = spray
                .full_transparent_icon
                .as_ref()
                .or(spray.display_icon.as_ref());
            (
                spray.display_name.clone(),
                image.map(|url| image_url(url)),
                None,
            )
        })?,
        CosmeticKind::Flex => index
            .flex(id)
            .map(|flex| (flex.display_name.clone(), art(&flex.display_icon), None))?,
        CosmeticKind::Buddy => index
            .buddy_level(id)
            .map(|level| (level.display_name.clone(), art(&level.display_icon), None))?,
    };
    Some(CosmeticOption {
        id: id.to_lowercase(),
        name,
        image,
        wide_image,
    })
}

/// Owned cosmetics of one kind, by name; the equipped one is kept even if not an entitlement
/// (Riot's defaults are not), so the picker can always show what is worn.
pub fn cosmetic_options(
    index: &AssetIndex,
    kind: CosmeticKind,
    owned: &HashSet<String>,
    equipped: &[String],
) -> Vec<CosmeticOption> {
    let ids: HashSet<String> = owned
        .iter()
        .cloned()
        .chain(equipped.iter().map(|id| id.to_lowercase()))
        .collect();
    let mut options: Vec<CosmeticOption> = ids
        .iter()
        .filter_map(|id| cosmetic(index, kind, id))
        .collect();
    options.sort_by(|a, b| a.name.cmp(&b.name));
    options
}

/// Owned ids of one kind plus the free items of that kind, which every account can wear.
pub(super) fn with_free_items(
    mut owned: HashSet<String>,
    index: &AssetIndex,
    kind: CosmeticKind,
) -> HashSet<String> {
    let free = FREE_COSMETICS
        .iter()
        .filter(|id| cosmetic(index, kind, id).is_some());
    owned.extend(free.map(|id| (*id).to_owned()));
    owned
}

fn is_melee(index: &AssetIndex, weapon_id: &str) -> bool {
    index
        .weapon(weapon_id)
        .is_some_and(|weapon| weapon.category.as_deref() == Some(MELEE_CATEGORY))
}

fn gun_buddy(index: &AssetIndex, gun: &Gun) -> Option<GunBuddy> {
    let weapon = index.weapon(&gun.id)?;
    if is_melee(index, &gun.id) {
        return None;
    }
    Some(GunBuddy {
        weapon_id: weapon.uuid.to_lowercase(),
        weapon_name: weapon.display_name.clone(),
        buddy: gun
            .charm_level_id
            .as_deref()
            .and_then(|level| cosmetic(index, CosmeticKind::Buddy, level)),
    })
}

/// The identity part of a loadout.
pub fn identity_view(index: &AssetIndex, loadout: &PlayerLoadout) -> IdentityView {
    let identity = &loadout.identity;
    let expressions = loadout
        .active_expressions
        .iter()
        .zip(0_u32..)
        .filter_map(|(expression, slot)| {
            let kind = CosmeticKind::of_item_type(&expression.type_id)?;
            let item = cosmetic(index, kind, &expression.asset_id);
            Some(ExpressionSlot { slot, kind, item })
        })
        .collect();
    let mut buddies: Vec<GunBuddy> = loadout
        .guns
        .iter()
        .filter_map(|gun| gun_buddy(index, gun))
        .collect();
    buddies.sort_by(|a, b| a.weapon_name.cmp(&b.weapon_name));
    IdentityView {
        card: cosmetic(index, CosmeticKind::Card, &identity.player_card_id),
        title: cosmetic(index, CosmeticKind::Title, &identity.player_title_id),
        expressions,
        buddies,
    }
}

fn rejected(reason: &str) -> ActionError {
    ActionError::could_not("equip that", reason)
}

/// The copy to hang: one no other gun wears, else the one on another gun (the client moves
/// a buddy the same way when every copy is in use).
fn pick_copy<'a>(
    loadout: &PlayerLoadout,
    copies: &'a [BuddyCopy],
    level_id: &str,
    weapon_id: &str,
) -> Option<&'a BuddyCopy> {
    let of_level: Vec<&BuddyCopy> = copies
        .iter()
        .filter(|copy| copy.level_id.eq_ignore_ascii_case(level_id))
        .collect();
    let worn_elsewhere = |copy: &BuddyCopy| {
        loadout.guns.iter().any(|gun| {
            !gun.id.eq_ignore_ascii_case(weapon_id)
                && gun
                    .charm_instance_id
                    .as_deref()
                    .is_some_and(|id| id.eq_ignore_ascii_case(&copy.instance_id))
        })
    };
    of_level
        .iter()
        .find(|copy| !worn_elsewhere(copy))
        .or(of_level.first())
        .copied()
}

/// Hang `copy` on the gun (or take its buddy off). Everything is checked before anything
/// moves, so a refused change leaves the loadout exactly as it was.
pub(super) fn set_buddy(
    loadout: &mut PlayerLoadout,
    index: &AssetIndex,
    copy: Option<&BuddyCopy>,
    weapon_id: &str,
) -> Result<(), ActionError> {
    let missing = || rejected("the weapon is missing from your loadout");
    let Some(copy) = copy else {
        clear_charm(loadout.gun_mut(weapon_id).ok_or_else(missing)?);
        return Ok(());
    };
    if loadout.gun_mut(weapon_id).is_none() {
        return Err(missing());
    }
    if is_melee(index, weapon_id) {
        return Err(rejected("knives do not carry buddies"));
    }
    let buddy = index
        .buddy_of_level(&copy.level_id)
        .ok_or_else(|| rejected("that buddy is unknown"))?;
    // The copy leaves whichever gun wore it.
    for gun in &mut loadout.guns {
        if gun
            .charm_instance_id
            .as_deref()
            .is_some_and(|id| id.eq_ignore_ascii_case(&copy.instance_id))
        {
            clear_charm(gun);
        }
    }
    let gun = loadout.gun_mut(weapon_id).ok_or_else(missing)?;
    gun.charm_id = Some(buddy.uuid.to_lowercase());
    gun.charm_level_id = Some(copy.level_id.to_lowercase());
    gun.charm_instance_id = Some(copy.instance_id.clone());
    Ok(())
}

/// Put `asset` in one wheel slot. When another slot already wears it the two swap, as the
/// client does, so the wheel never holds one item twice (Riot may refuse such a loadout).
pub(super) fn set_expression(
    loadout: &mut PlayerLoadout,
    slot: usize,
    asset: &str,
) -> Result<(), ActionError> {
    let asset = asset.to_lowercase();
    let previous = loadout
        .active_expressions
        .get(slot)
        .map(|expression| expression.asset_id.clone())
        .ok_or_else(|| rejected("that wheel slot does not exist"))?;
    let is_twin = |at: usize, id: &str| at != slot && id.eq_ignore_ascii_case(&asset);
    if asset != EMPTY_SPRAY {
        let twin = loadout
            .active_expressions
            .iter_mut()
            .enumerate()
            .find(|(at, expression)| is_twin(*at, &expression.asset_id));
        if let Some((_, twin)) = twin {
            twin.asset_id = previous;
        }
    }
    if let Some(expression) = loadout.active_expressions.get_mut(slot) {
        expression.asset_id = asset;
    }
    Ok(())
}

pub(super) fn clear_charm(gun: &mut Gun) {
    gun.charm_id = None;
    gun.charm_level_id = None;
    gun.charm_instance_id = None;
}

/// What a change needs to be checked against.
pub struct Ownership<'a> {
    /// Owned ids (lowercase) of the change's kind.
    pub owned: &'a HashSet<String>,
    /// Owned buddy copies (only read for buddy changes).
    pub buddies: &'a [BuddyCopy],
}

/// Apply one change to a fresh loadout, refusing items the player does not own.
pub fn apply_change(
    loadout: &mut PlayerLoadout,
    index: &AssetIndex,
    change: &IdentityChange,
    ownership: &Ownership<'_>,
) -> Result<(), ActionError> {
    let is_owned = |id: &str| ownership.owned.contains(&id.to_lowercase());
    match change {
        IdentityChange::Card { id } if is_owned(id) => {
            loadout.identity.player_card_id = id.to_lowercase()
        }
        IdentityChange::Title { id } if is_owned(id) => {
            loadout.identity.player_title_id = id.to_lowercase()
        }
        IdentityChange::Expression { slot, id } if is_owned(id) => {
            let slot =
                usize::try_from(*slot).map_err(|_| rejected("that wheel slot does not exist"))?;
            set_expression(loadout, slot, id)?;
        }
        IdentityChange::Buddy {
            weapon_id,
            id: None,
        } => set_buddy(loadout, index, None, weapon_id)?,
        IdentityChange::Buddy {
            weapon_id,
            id: Some(level_id),
        } => {
            let copy = pick_copy(loadout, ownership.buddies, level_id, weapon_id)
                .ok_or_else(|| rejected("you do not own that buddy"))?
                .clone();
            set_buddy(loadout, index, Some(&copy), weapon_id)?;
        }
        _ => return Err(rejected("you do not own it")),
    }
    Ok(())
}

/// The kind of item a change equips, to know which entitlements to check.
pub fn change_kind(loadout: &PlayerLoadout, change: &IdentityChange) -> Option<CosmeticKind> {
    match change {
        IdentityChange::Card { .. } => Some(CosmeticKind::Card),
        IdentityChange::Title { .. } => Some(CosmeticKind::Title),
        IdentityChange::Buddy { .. } => Some(CosmeticKind::Buddy),
        IdentityChange::Expression { slot, .. } => usize::try_from(*slot)
            .ok()
            .and_then(|slot| loadout.active_expressions.get(slot))
            .and_then(|expression| CosmeticKind::of_item_type(&expression.type_id)),
    }
}

#[cfg(test)]
mod tests;
