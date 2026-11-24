//! The valorant-api.com endpoints we cache, one JSON file each.
//! Skin levels and chromas come embedded in `weapons/skins`, so they need no download of their own.

/// Base URL of the API.
pub(super) const API_BASE: &str = "https://valorant-api.com/v1";
/// Text language for every endpoint but the localized copies below.
pub(super) const LANGUAGE: &str = "en-US";
/// The VALORANT style speaks the player's client language; titles are its one localized text.
const SPANISH: &str = "es-ES";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Endpoint {
    Version,
    Agents,
    Maps,
    Weapons,
    Skins,
    Buddies,
    Sprays,
    PlayerCards,
    PlayerTitles,
    /// Player titles again in Spanish, for the VALORANT style's Spanish lobby.
    PlayerTitlesEs,
    LevelBorders,
    Flex,
    CompetitiveTiers,
    Currencies,
    Contracts,
    Missions,
    Seasons,
    GameModes,
    Queues,
    Bundles,
}

impl Endpoint {
    /// Version first: it decides whether the rest is downloaded at all.
    pub const ALL: [Endpoint; 20] = [
        Endpoint::Version,
        Endpoint::Agents,
        Endpoint::Maps,
        Endpoint::Weapons,
        Endpoint::Skins,
        Endpoint::Buddies,
        Endpoint::Sprays,
        Endpoint::PlayerCards,
        Endpoint::PlayerTitles,
        Endpoint::PlayerTitlesEs,
        Endpoint::LevelBorders,
        Endpoint::Flex,
        Endpoint::CompetitiveTiers,
        Endpoint::Currencies,
        Endpoint::Contracts,
        Endpoint::Missions,
        Endpoint::Seasons,
        Endpoint::GameModes,
        Endpoint::Queues,
        Endpoint::Bundles,
    ];

    /// Path (and fixed query) after `/v1/`.
    pub fn path(self) -> &'static str {
        match self {
            Self::Version => "version",
            Self::Agents => "agents?isPlayableCharacter=true",
            Self::Maps => "maps",
            Self::Weapons => "weapons",
            Self::Skins => "weapons/skins",
            Self::Buddies => "buddies",
            Self::Sprays => "sprays",
            Self::PlayerCards => "playercards",
            Self::PlayerTitles | Self::PlayerTitlesEs => "playertitles",
            Self::LevelBorders => "levelborders",
            Self::Flex => "flex",
            Self::CompetitiveTiers => "competitivetiers",
            Self::Currencies => "currencies",
            Self::Contracts => "contracts",
            Self::Missions => "missions",
            Self::Seasons => "seasons",
            Self::GameModes => "gamemodes",
            Self::Queues => "gamemodes/queues",
            Self::Bundles => "bundles",
        }
    }

    /// Cache file name inside the cache dir.
    pub fn file_name(self) -> &'static str {
        match self {
            Self::Version => "version.json",
            Self::Agents => "agents.json",
            Self::Maps => "maps.json",
            Self::Weapons => "weapons.json",
            Self::Skins => "skins.json",
            Self::Buddies => "buddies.json",
            Self::Sprays => "sprays.json",
            Self::PlayerCards => "playercards.json",
            Self::PlayerTitles => "playertitles.json",
            Self::PlayerTitlesEs => "playertitles.es-ES.json",
            Self::LevelBorders => "levelborders.json",
            Self::Flex => "flex.json",
            Self::CompetitiveTiers => "competitivetiers.json",
            Self::Currencies => "currencies.json",
            Self::Contracts => "contracts.json",
            Self::Missions => "missions.json",
            Self::Seasons => "seasons.json",
            Self::GameModes => "gamemodes.json",
            Self::Queues => "queues.json",
            Self::Bundles => "bundles.json",
        }
    }

    /// Text language the endpoint is fetched in.
    pub fn language(self) -> &'static str {
        match self {
            Self::PlayerTitlesEs => SPANISH,
            _ => LANGUAGE,
        }
    }

    /// Full request URL with the language parameter.
    pub fn url(self) -> String {
        let path = self.path();
        let separator = if path.contains('?') { '&' } else { '?' };
        format!("{API_BASE}/{path}{separator}language={}", self.language())
    }
}
