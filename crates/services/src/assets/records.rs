//! valorant-api.com records, trimmed to the fields the menu uses. Every field
//! tolerates `null` and missing keys: the API sends both for hidden or unreleased content.

use serde::{Deserialize, Deserializer};

/// `null` becomes the default, the same way a missing key does.
fn null_as_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Default + Deserialize<'de>,
{
    Ok(Option::<T>::deserialize(deserializer)?.unwrap_or_default())
}

/// `{"status":200,"data":...}`.
#[derive(Debug, Deserialize)]
pub(super) struct Envelope<T> {
    pub status: u16,
    pub data: T,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Version {
    pub manifest_id: String,
    pub version: String,
    pub riot_client_version: String,
    pub build_date: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Role {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub description: Option<String>,
    pub display_icon: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Ability {
    pub slot: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub description: Option<String>,
    pub display_icon: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Agent {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub description: Option<String>,
    pub display_icon: Option<String>,
    pub display_icon_small: Option<String>,
    pub bust_portrait: Option<String>,
    pub full_portrait: Option<String>,
    pub killfeed_portrait: Option<String>,
    pub background: Option<String>,
    /// RRGGBBAA stops the client tints the agent's page with.
    #[serde(deserialize_with = "null_as_default")]
    pub background_gradient_colors: Vec<String>,
    pub role: Option<Role>,
    #[serde(deserialize_with = "null_as_default")]
    pub abilities: Vec<Ability>,
    pub is_playable_character: bool,
    pub is_base_content: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GameMap {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub map_url: Option<String>,
    pub splash: Option<String>,
    pub list_view_icon: Option<String>,
    pub display_icon: Option<String>,
    /// `Duality` for Bind: what a match's `MapID` path carries. Filled when the index is built.
    #[serde(skip)]
    pub internal_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UuidRef {
    #[serde(default)]
    pub uuid: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Weapon {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub category: Option<String>,
    pub default_skin_uuid: Option<String>,
    pub display_icon: Option<String>,
    pub kill_stream_icon: Option<String>,
    #[serde(deserialize_with = "null_as_default")]
    pub skins: Vec<UuidRef>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkinChroma {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    pub full_render: Option<String>,
    pub swatch: Option<String>,
    pub streamed_video: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SkinLevel {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    pub streamed_video: Option<String>,
    pub level_item: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Skin {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub theme_uuid: Option<String>,
    pub content_tier_uuid: Option<String>,
    pub display_icon: Option<String>,
    #[serde(deserialize_with = "null_as_default")]
    pub chromas: Vec<SkinChroma>,
    #[serde(deserialize_with = "null_as_default")]
    pub levels: Vec<SkinLevel>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BuddyLevel {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    pub charm_level: u32,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Buddy {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    #[serde(deserialize_with = "null_as_default")]
    pub levels: Vec<BuddyLevel>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Spray {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub category: Option<String>,
    pub display_icon: Option<String>,
    pub full_icon: Option<String>,
    pub full_transparent_icon: Option<String>,
    pub animation_png: Option<String>,
    pub animation_gif: Option<String>,
    pub is_null_spray: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PlayerCard {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    pub small_art: Option<String>,
    pub wide_art: Option<String>,
    pub large_art: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PlayerTitle {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub title_text: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LevelBorder {
    pub uuid: String,
    pub starting_level: u32,
    pub level_number_appearance: Option<String>,
    pub small_player_card_appearance: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Flex {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Tier {
    pub tier: u32,
    #[serde(deserialize_with = "null_as_default")]
    pub tier_name: String,
    #[serde(deserialize_with = "null_as_default")]
    pub division: String,
    #[serde(deserialize_with = "null_as_default")]
    pub division_name: String,
    pub color: Option<String>,
    pub background_color: Option<String>,
    pub small_icon: Option<String>,
    pub large_icon: Option<String>,
}

/// One episode's rank table; the latest one is served by `AssetStore::tier`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TierTable {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub asset_object_name: String,
    #[serde(deserialize_with = "null_as_default")]
    pub tiers: Vec<Tier>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Currency {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    pub large_icon: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Contract {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    #[serde(deserialize_with = "null_as_default")]
    pub content: ContractContent,
}

/// What a contract is for and the rewards along it.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContractContent {
    /// `Season` for a battle pass, `Agent` or `Event` otherwise.
    pub relation_type: Option<String>,
    /// The act uuid of a battle pass.
    pub relation_uuid: Option<String>,
    #[serde(deserialize_with = "null_as_default")]
    pub chapters: Vec<ContractChapter>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContractChapter {
    pub is_epilogue: bool,
    #[serde(deserialize_with = "null_as_default")]
    pub levels: Vec<ContractLevel>,
    #[serde(deserialize_with = "null_as_default")]
    pub free_rewards: Vec<ContractReward>,
}

/// One tier: the XP it takes and what it unlocks.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContractLevel {
    pub xp: i64,
    pub reward: ContractReward,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ContractReward {
    /// `EquippableSkinLevel`, `EquippableCharmLevel`, `PlayerCard`, `Spray`, `Title`, `Currency`...
    #[serde(rename = "type", deserialize_with = "null_as_default")]
    pub reward_type: String,
    #[serde(deserialize_with = "null_as_default")]
    pub uuid: String,
    pub amount: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Mission {
    pub uuid: String,
    pub title: Option<String>,
    /// `EAresMissionType::Weekly`, `EAresMissionType::Daily`, ...
    #[serde(rename = "type")]
    pub mission_type: Option<String>,
    pub xp_grant: i64,
    pub progress_to_complete: i64,
    #[serde(deserialize_with = "null_as_default")]
    pub objectives: Vec<MissionObjective>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MissionObjective {
    #[serde(deserialize_with = "null_as_default")]
    pub objective_uuid: String,
    pub value: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Season {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    #[serde(rename = "type")]
    pub season_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub parent_uuid: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct GameMode {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_icon: Option<String>,
    /// `ShooterGame/Content/GameModes/Bomb/BombGameMode_PrimaryAsset`.
    pub asset_path: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Queue {
    pub uuid: String,
    pub queue_id: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub description: Option<String>,
    pub display_icon: Option<String>,
    pub list_view_icon_tall: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Bundle {
    pub uuid: String,
    #[serde(deserialize_with = "null_as_default")]
    pub display_name: String,
    pub display_name_sub_text: Option<String>,
    pub display_icon: Option<String>,
    pub vertical_promo_image: Option<String>,
}
