//! `AssetIndex`: uuid-indexed tables built from the cached endpoint documents, or from the
//! bundled fallback tables when nothing is cached yet. Immutable once built.

use std::collections::HashMap;
use std::sync::Arc;

use domain::static_data::{FALLBACK_AGENTS, FALLBACK_MAPS};
use serde::Serialize;
use serde::de::DeserializeOwned;
use ts_rs::TS;

use super::endpoints::Endpoint;
use super::records::{
    Agent, Buddy, BuddyLevel, Bundle, Contract, Currency, Envelope, Flex, GameMap, GameMode,
    LevelBorder, Mission, PlayerCard, PlayerTitle, Queue, Season, Skin, SkinChroma, SkinLevel,
    Spray, Tier, TierTable, Version, Weapon,
};

/// Raw endpoint bodies, as stored on disk.
pub type Documents = HashMap<Endpoint, String>;

pub(super) type Table<T> = HashMap<String, Arc<T>>;

/// Where the current index came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AssetSource {
    /// Names only, from `domain::static_data`.
    Bundled,
    /// The disk cache from an earlier run.
    Cache,
    /// Freshly downloaded this run.
    Network,
}

/// Row counts per category (debug view and the `Assets` event).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AssetIndexSummary {
    pub agents: usize,
    pub maps: usize,
    pub weapons: usize,
    pub skins: usize,
    pub skin_levels: usize,
    pub chromas: usize,
    pub buddies: usize,
    pub sprays: usize,
    pub player_cards: usize,
    pub player_titles: usize,
    pub level_borders: usize,
    pub flex: usize,
    pub tiers: usize,
    pub currencies: usize,
    pub contracts: usize,
    pub missions: usize,
    pub seasons: usize,
    pub queues: usize,
    pub bundles: usize,
}

/// Which categories changed hands, published as `AppEvent::Assets`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AssetsStatus {
    pub source: AssetSource,
    pub manifest_id: Option<String>,
    pub summary: AssetIndexSummary,
}

/// Category of an entitlement or store item.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemKind {
    Agent,
    SkinLevel,
    SkinChroma,
    Buddy,
    Spray,
    PlayerCard,
    PlayerTitle,
    Flex,
    Contract,
}

/// What the menu needs to show any owned or offered item: a name and an icon url.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemInfo {
    pub kind: ItemKind,
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
}

#[derive(Debug, Default)]
pub struct AssetIndex {
    pub(super) source: Option<AssetSource>,
    pub(super) version: Option<Version>,
    pub(super) agents: Table<Agent>,
    pub(super) maps: Table<GameMap>,
    pub(super) maps_by_internal_id: Table<GameMap>,
    pub(super) weapons: Table<Weapon>,
    pub(super) skins: Table<Skin>,
    pub(super) skin_levels: Table<SkinLevel>,
    pub(super) chromas: Table<SkinChroma>,
    pub(super) buddies: Table<Buddy>,
    pub(super) buddy_levels: Table<BuddyLevel>,
    pub(super) sprays: Table<Spray>,
    pub(super) player_cards: Table<PlayerCard>,
    pub(super) player_titles: Table<PlayerTitle>,
    pub(super) player_titles_es: Table<PlayerTitle>,
    pub(super) level_borders: Table<LevelBorder>,
    pub(super) flex: Table<Flex>,
    pub(super) currencies: Table<Currency>,
    pub(super) contracts: Table<Contract>,
    pub(super) missions: Table<Mission>,
    pub(super) seasons: Table<Season>,
    pub(super) game_modes: Table<GameMode>,
    pub(super) queues: Table<Queue>,
    pub(super) bundles: Table<Bundle>,
    pub(super) tiers: HashMap<u32, Arc<Tier>>,
    pub(super) skin_of_level: HashMap<String, String>,
    pub(super) skin_of_chroma: HashMap<String, String>,
    pub(super) weapon_of_skin: HashMap<String, String>,
    pub(super) buddy_of_level: HashMap<String, String>,
}

/// Uuids are compared lowercase everywhere.
pub(super) fn key(id: &str) -> String {
    id.trim().to_lowercase()
}

fn table<T>(rows: Vec<T>, uuid: impl Fn(&T) -> &str) -> Table<T> {
    rows.into_iter()
        .filter(|row| !uuid(row).is_empty())
        .map(|row| (key(uuid(&row)), Arc::new(row)))
        .collect()
}

/// Rows of one endpoint; a missing or unreadable document is an empty list, never an error.
fn rows<T: DeserializeOwned>(docs: &Documents, endpoint: Endpoint) -> Vec<T> {
    let Some(body) = docs.get(&endpoint) else {
        return Vec::new();
    };
    match serde_json::from_str::<Envelope<Vec<T>>>(body) {
        Ok(envelope) if envelope.status == 200 => envelope.data,
        Ok(envelope) => {
            tracing::warn!(?endpoint, status = envelope.status, "assets_bad_status");
            Vec::new()
        }
        Err(error) => {
            tracing::warn!(?endpoint, %error, "assets_parse_failed");
            Vec::new()
        }
    }
}

/// `/Game/Maps/Duality/Duality` -> `Duality`.
fn internal_id_from_map_url(map_url: &str) -> Option<String> {
    map_url.rsplit('/').nth(1).map(str::to_owned)
}

impl AssetIndex {
    /// Names only, from the bundled tables. Lets the menu draw before any download.
    pub fn bundled() -> Self {
        let mut index = Self {
            source: Some(AssetSource::Bundled),
            ..Self::default()
        };
        let agents = FALLBACK_AGENTS.iter().map(|entry| Agent {
            uuid: entry.uuid.to_owned(),
            display_name: entry.display_name(),
            is_playable_character: true,
            ..Agent::default()
        });
        index.agents = table(agents.collect(), |agent| &agent.uuid);
        let maps = FALLBACK_MAPS.iter().map(|entry| GameMap {
            display_name: entry.display_name(),
            internal_id: entry.internal_id.to_owned(),
            ..GameMap::default()
        });
        index.maps_by_internal_id = maps
            .map(|map| (map.internal_id.clone(), Arc::new(map)))
            .collect();
        index
    }

    /// Build from cached or downloaded bodies.
    pub fn from_documents(docs: &Documents, source: AssetSource) -> Self {
        let mut index = Self {
            source: Some(source),
            version: version_from(docs),
            ..Self::default()
        };
        index.load_characters(docs);
        index.load_cosmetics(docs);
        index.load_meta(docs);
        index
    }

    fn load_characters(&mut self, docs: &Documents) {
        self.agents = table(rows(docs, Endpoint::Agents), |agent: &Agent| &agent.uuid);
        let mut maps: Vec<GameMap> = rows(docs, Endpoint::Maps);
        for map in &mut maps {
            map.internal_id = map
                .map_url
                .as_deref()
                .and_then(internal_id_from_map_url)
                .unwrap_or_default();
        }
        self.maps_by_internal_id = maps
            .iter()
            .filter(|map| !map.internal_id.is_empty())
            .map(|map| (map.internal_id.clone(), Arc::new(map.clone())))
            .collect();
        self.maps = table(maps, |map: &GameMap| &map.uuid);
    }

    fn load_cosmetics(&mut self, docs: &Documents) {
        let weapons: Vec<Weapon> = rows(docs, Endpoint::Weapons);
        for weapon in &weapons {
            for skin in &weapon.skins {
                self.weapon_of_skin
                    .insert(key(&skin.uuid), key(&weapon.uuid));
            }
        }
        self.weapons = table(weapons, |weapon| &weapon.uuid);
        self.load_skins(rows(docs, Endpoint::Skins));
        self.load_buddies(rows(docs, Endpoint::Buddies));
        self.sprays = table(rows(docs, Endpoint::Sprays), |row: &Spray| &row.uuid);
        self.player_cards = table(rows(docs, Endpoint::PlayerCards), |row: &PlayerCard| {
            &row.uuid
        });
        self.player_titles = table(rows(docs, Endpoint::PlayerTitles), |row: &PlayerTitle| {
            &row.uuid
        });
        self.player_titles_es = table(rows(docs, Endpoint::PlayerTitlesEs), |row: &PlayerTitle| {
            &row.uuid
        });
        self.level_borders = table(rows(docs, Endpoint::LevelBorders), |row: &LevelBorder| {
            &row.uuid
        });
        self.flex = table(rows(docs, Endpoint::Flex), |row: &Flex| &row.uuid);
    }

    fn load_skins(&mut self, skins: Vec<Skin>) {
        for skin in &skins {
            for level in &skin.levels {
                self.skin_of_level.insert(key(&level.uuid), key(&skin.uuid));
                self.skin_levels
                    .insert(key(&level.uuid), Arc::new(level.clone()));
            }
            for chroma in &skin.chromas {
                self.skin_of_chroma
                    .insert(key(&chroma.uuid), key(&skin.uuid));
                self.chromas
                    .insert(key(&chroma.uuid), Arc::new(chroma.clone()));
            }
        }
        self.skins = table(skins, |skin| &skin.uuid);
    }

    fn load_buddies(&mut self, buddies: Vec<Buddy>) {
        for buddy in &buddies {
            for level in &buddy.levels {
                self.buddy_of_level
                    .insert(key(&level.uuid), key(&buddy.uuid));
                self.buddy_levels
                    .insert(key(&level.uuid), Arc::new(level.clone()));
            }
        }
        self.buddies = table(buddies, |buddy| &buddy.uuid);
    }

    fn load_meta(&mut self, docs: &Documents) {
        let tables: Vec<TierTable> = rows(docs, Endpoint::CompetitiveTiers);
        if let Some(latest) = tables.into_iter().next_back() {
            self.tiers = latest
                .tiers
                .into_iter()
                .map(|tier| (tier.tier, Arc::new(tier)))
                .collect();
        }
        self.currencies = table(rows(docs, Endpoint::Currencies), |row: &Currency| &row.uuid);
        self.contracts = table(rows(docs, Endpoint::Contracts), |row: &Contract| &row.uuid);
        self.missions = table(rows(docs, Endpoint::Missions), |row: &Mission| &row.uuid);
        self.seasons = table(rows(docs, Endpoint::Seasons), |row: &Season| &row.uuid);
        self.game_modes = table(rows(docs, Endpoint::GameModes), |row: &GameMode| &row.uuid);
        self.queues = rows::<Queue>(docs, Endpoint::Queues)
            .into_iter()
            .filter(|queue| !queue.queue_id.is_empty())
            .map(|queue| (key(&queue.queue_id), Arc::new(queue)))
            .collect();
        self.bundles = table(rows(docs, Endpoint::Bundles), |row: &Bundle| &row.uuid);
    }

    pub fn source(&self) -> AssetSource {
        self.source.unwrap_or(AssetSource::Bundled)
    }

    pub fn version(&self) -> Option<&Version> {
        self.version.as_ref()
    }

    pub fn status(&self) -> AssetsStatus {
        AssetsStatus {
            source: self.source(),
            manifest_id: self
                .version
                .as_ref()
                .map(|version| version.manifest_id.clone()),
            summary: self.summary(),
        }
    }

    pub fn summary(&self) -> AssetIndexSummary {
        AssetIndexSummary {
            agents: self.agents.len(),
            maps: self.maps_by_internal_id.len(),
            weapons: self.weapons.len(),
            skins: self.skins.len(),
            skin_levels: self.skin_levels.len(),
            chromas: self.chromas.len(),
            buddies: self.buddies.len(),
            sprays: self.sprays.len(),
            player_cards: self.player_cards.len(),
            player_titles: self.player_titles.len(),
            level_borders: self.level_borders.len(),
            flex: self.flex.len(),
            tiers: self.tiers.len(),
            currencies: self.currencies.len(),
            contracts: self.contracts.len(),
            missions: self.missions.len(),
            seasons: self.seasons.len(),
            queues: self.queues.len(),
            bundles: self.bundles.len(),
        }
    }
}

fn version_from(docs: &Documents) -> Option<Version> {
    let body = docs.get(&Endpoint::Version)?;
    serde_json::from_str::<Envelope<Version>>(body)
        .ok()
        .map(|envelope| envelope.data)
}
