//! Lookups on [`AssetIndex`]. Ids are matched case-insensitively (uuids are stored lowercase).

use std::sync::Arc;

use riot::api::pd::entitlements as item_types;

use super::index::{AssetIndex, ItemInfo, ItemKind, Table, key};
use super::records::{
    Agent, Buddy, BuddyLevel, Bundle, Contract, Currency, Flex, GameMap, GameMode, LevelBorder,
    Mission, PlayerCard, PlayerTitle, Queue, Season, Skin, SkinChroma, SkinLevel, Spray, Tier,
    Weapon,
};

fn sorted<T>(table: &Table<T>, name: impl Fn(&T) -> &str) -> Vec<Arc<T>> {
    let mut all: Vec<Arc<T>> = table.values().cloned().collect();
    all.sort_by(|a, b| name(a).cmp(name(b)));
    all
}

/// `Bomb` in `.../GameModes/Bomb/...`.
fn mode_folder(path: &str) -> Option<&str> {
    let (_, rest) = path.split_once("GameModes/")?;
    rest.split('/').next().filter(|folder| !folder.is_empty())
}

impl AssetIndex {
    /// Playable agents, alphabetical.
    pub fn agents(&self) -> Vec<Arc<Agent>> {
        sorted(&self.agents, |agent| &agent.display_name)
    }

    pub fn agent(&self, uuid: &str) -> Option<Arc<Agent>> {
        self.agents.get(&key(uuid)).cloned()
    }

    /// Maps alphabetical, including the ones the API lists without a playable id.
    pub fn maps(&self) -> Vec<Arc<GameMap>> {
        sorted(&self.maps_by_internal_id, |map| &map.display_name)
    }

    pub fn map(&self, uuid: &str) -> Option<Arc<GameMap>> {
        self.maps.get(&key(uuid)).cloned()
    }

    /// Exact and case-sensitive like `domain::static_data::map_by_internal_id`.
    pub fn map_by_internal_id(&self, internal_id: &str) -> Option<Arc<GameMap>> {
        self.maps_by_internal_id.get(internal_id).cloned()
    }

    /// Every weapon, alphabetical (the collection orders them by category itself).
    pub fn weapons(&self) -> Vec<Arc<Weapon>> {
        sorted(&self.weapons, |weapon| &weapon.display_name)
    }

    pub fn weapon(&self, uuid: &str) -> Option<Arc<Weapon>> {
        self.weapons.get(&key(uuid)).cloned()
    }

    /// The weapon a skin belongs to.
    pub fn weapon_of_skin(&self, skin_uuid: &str) -> Option<Arc<Weapon>> {
        self.weapon(self.weapon_of_skin.get(&key(skin_uuid))?)
    }

    /// Every skin, alphabetical.
    pub fn skins(&self) -> Vec<Arc<Skin>> {
        sorted(&self.skins, |skin| &skin.display_name)
    }

    pub fn skin(&self, uuid: &str) -> Option<Arc<Skin>> {
        self.skins.get(&key(uuid)).cloned()
    }

    pub fn skin_level(&self, uuid: &str) -> Option<Arc<SkinLevel>> {
        self.skin_levels.get(&key(uuid)).cloned()
    }

    /// The skin that owns a level (store offers and entitlements carry level ids).
    pub fn skin_of_level(&self, level_uuid: &str) -> Option<Arc<Skin>> {
        self.skin(self.skin_of_level.get(&key(level_uuid))?)
    }

    pub fn chroma(&self, uuid: &str) -> Option<Arc<SkinChroma>> {
        self.chromas.get(&key(uuid)).cloned()
    }

    pub fn buddy(&self, uuid: &str) -> Option<Arc<Buddy>> {
        self.buddies.get(&key(uuid)).cloned()
    }

    pub fn buddy_level(&self, uuid: &str) -> Option<Arc<BuddyLevel>> {
        self.buddy_levels.get(&key(uuid)).cloned()
    }

    /// The buddy a level belongs to (entitlements and guns carry level ids).
    pub fn buddy_of_level(&self, level_uuid: &str) -> Option<Arc<Buddy>> {
        self.buddy(self.buddy_of_level.get(&key(level_uuid))?)
    }

    pub fn spray(&self, uuid: &str) -> Option<Arc<Spray>> {
        self.sprays.get(&key(uuid)).cloned()
    }

    pub fn player_card(&self, uuid: &str) -> Option<Arc<PlayerCard>> {
        self.player_cards.get(&key(uuid)).cloned()
    }

    pub fn player_title(&self, uuid: &str) -> Option<Arc<PlayerTitle>> {
        self.player_titles.get(&key(uuid)).cloned()
    }

    /// The same title in Spanish, when that copy is cached.
    pub fn player_title_es(&self, uuid: &str) -> Option<Arc<PlayerTitle>> {
        self.player_titles_es.get(&key(uuid)).cloned()
    }

    pub fn level_border(&self, uuid: &str) -> Option<Arc<LevelBorder>> {
        self.level_borders.get(&key(uuid)).cloned()
    }

    /// The border an account level gets: the highest `starting_level` not above it.
    pub fn level_border_for(&self, account_level: u32) -> Option<Arc<LevelBorder>> {
        self.level_borders
            .values()
            .filter(|border| border.starting_level <= account_level)
            .max_by_key(|border| border.starting_level)
            .cloned()
    }

    pub fn flex(&self, uuid: &str) -> Option<Arc<Flex>> {
        self.flex.get(&key(uuid)).cloned()
    }

    /// Rank by tier number (0 = unranked) from the latest episode table.
    pub fn tier(&self, tier: u32) -> Option<Arc<Tier>> {
        self.tiers.get(&tier).cloned()
    }

    pub fn currency(&self, uuid: &str) -> Option<Arc<Currency>> {
        self.currencies.get(&key(uuid)).cloned()
    }

    pub fn contract(&self, uuid: &str) -> Option<Arc<Contract>> {
        self.contracts.get(&key(uuid)).cloned()
    }

    /// The battle pass of one act: the contract whose content relates to that season.
    pub fn battle_pass_of_act(&self, act_uuid: &str) -> Option<Arc<Contract>> {
        let act = key(act_uuid);
        self.contracts
            .values()
            .find(|contract| {
                let content = &contract.content;
                content
                    .relation_type
                    .as_deref()
                    .is_some_and(|kind| kind.eq_ignore_ascii_case("season"))
                    && content.relation_uuid.as_deref().map(key) == Some(act.clone())
            })
            .cloned()
    }

    pub fn mission(&self, uuid: &str) -> Option<Arc<Mission>> {
        self.missions.get(&key(uuid)).cloned()
    }

    pub fn season(&self, uuid: &str) -> Option<Arc<Season>> {
        self.seasons.get(&key(uuid)).cloned()
    }

    pub fn game_mode(&self, uuid: &str) -> Option<Arc<GameMode>> {
        self.game_modes.get(&key(uuid)).cloned()
    }

    /// Queue by `QueueID` (`competitive`, `swiftplay`, ...).
    /// The map a custom game names by its asset path (`/Game/Maps/Ascent/Ascent`).
    pub fn map_by_url(&self, map_url: &str) -> Option<Arc<GameMap>> {
        self.maps_by_internal_id
            .values()
            .find(|map| map.map_url.as_deref() == Some(map_url))
            .cloned()
    }

    /// The mode a custom game names by its class path
    /// (`/Game/GameModes/Bomb/BombGameMode.BombGameMode_C`): the folder under `GameModes/` is
    /// the part both that path and the asset table's `assetPath` share.
    pub fn game_mode_by_path(&self, mode_path: &str) -> Option<Arc<GameMode>> {
        let folder = mode_folder(mode_path)?;
        self.game_modes
            .values()
            .find(|mode| mode.asset_path.as_deref().and_then(mode_folder) == Some(folder))
            .cloned()
    }

    pub fn queue(&self, queue_id: &str) -> Option<Arc<Queue>> {
        self.queues.get(&key(queue_id)).cloned()
    }

    pub fn bundle(&self, uuid: &str) -> Option<Arc<Bundle>> {
        self.bundles.get(&key(uuid)).cloned()
    }

    /// Name and icon for an entitlement or store item.
    pub fn item_by_type_and_id(&self, item_type_id: &str, id: &str) -> Option<ItemInfo> {
        let kind = item_kind(item_type_id)?;
        let (name, icon) = match kind {
            ItemKind::Agent => self
                .agent(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::SkinLevel => self
                .skin_level(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::SkinChroma => self
                .chroma(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::Buddy => self.buddy_item(id),
            ItemKind::Spray => self
                .spray(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::PlayerCard => self
                .player_card(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::PlayerTitle => self.player_title(id).map(|row| {
                (
                    row.title_text
                        .clone()
                        .unwrap_or_else(|| row.display_name.clone()),
                    None,
                )
            }),
            ItemKind::Flex => self
                .flex(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
            ItemKind::Contract => self
                .contract(id)
                .map(|row| (row.display_name.clone(), row.display_icon.clone())),
        }?;
        Some(ItemInfo {
            kind,
            id: key(id),
            name,
            icon,
        })
    }

    /// Entitlements carry buddy level ids; store offers may carry the buddy id.
    fn buddy_item(&self, id: &str) -> Option<(String, Option<String>)> {
        if let Some(level) = self.buddy_level(id) {
            let parent = self
                .buddy_of_level
                .get(&key(id))
                .and_then(|uuid| self.buddy(uuid));
            let name = match (&parent, level.display_name.is_empty()) {
                (Some(buddy), true) => buddy.display_name.clone(),
                _ => level.display_name.clone(),
            };
            return Some((name, level.display_icon.clone()));
        }
        self.buddy(id)
            .map(|row| (row.display_name.clone(), row.display_icon.clone()))
    }
}

fn item_kind(item_type_id: &str) -> Option<ItemKind> {
    let kinds = [
        (item_types::ITEM_TYPE_AGENTS, ItemKind::Agent),
        (item_types::ITEM_TYPE_SKIN_LEVELS, ItemKind::SkinLevel),
        (item_types::ITEM_TYPE_SKIN_CHROMAS, ItemKind::SkinChroma),
        (item_types::ITEM_TYPE_BUDDIES, ItemKind::Buddy),
        (item_types::ITEM_TYPE_SPRAYS, ItemKind::Spray),
        (item_types::ITEM_TYPE_PLAYER_CARDS, ItemKind::PlayerCard),
        (item_types::ITEM_TYPE_PLAYER_TITLES, ItemKind::PlayerTitle),
        (item_types::ITEM_TYPE_FLEX, ItemKind::Flex),
        (item_types::ITEM_TYPE_CONTRACTS, ItemKind::Contract),
    ];
    kinds
        .into_iter()
        .find(|(type_id, _)| type_id.eq_ignore_ascii_case(item_type_id.trim()))
        .map(|(_, kind)| kind)
}
