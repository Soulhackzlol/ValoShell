//! Typed app settings in `settings.json`: every field has a default (a missing or older file
//! never breaks startup), writes are atomic (`.tmp` + rename), and services subscribe to
//! changes through a `watch` channel instead of polling.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize};
use tokio::sync::watch;
use ts_rs::TS;

use crate::paths::with_path;

/// Menu sounds start at this volume (and fall back to it from an unreadable value).
const DEFAULT_UI_VOLUME: f64 = 0.6;
/// The interface size range (ui/src/state/uiScale.ts mirrors it). Pieces keep their place on
/// screen while their content grows, so past 125% content would no longer fit them.
const MIN_UI_SCALE: f64 = 0.8;
const MAX_UI_SCALE: f64 = 1.25;
const DEFAULT_UI_SCALE: f64 = 1.0;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct Settings {
    /// Last region the client connected with; a fallback when the game log has none.
    pub region: Option<String>,
    pub match_flow: MatchFlowSettings,
    pub interface: InterfaceSettings,
    pub streamer: StreamerSettings,
    pub collection: CollectionSettings,
    pub updates: UpdateSettings,
    pub onboarding: OnboardingSettings,
}

/// When the menu gets out of the way of the game.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct MatchFlowSettings {
    pub should_hide_on_lock: bool,
    pub should_hide_on_match_start: bool,
    pub should_return_in_menus: bool,
    pub should_minimize_game_in_menus: bool,
}

impl Default for MatchFlowSettings {
    fn default() -> Self {
        Self {
            should_hide_on_lock: true,
            should_hide_on_match_start: true,
            should_return_in_menus: true,
            should_minimize_game_in_menus: false,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum MotionPreference {
    /// Follow the OS reduced-motion setting.
    #[default]
    System,
    Full,
    Reduced,
}

/// How much of the menu's costly look (frosted blur, animated backdrops, endless loops) is drawn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum EffectsQuality {
    /// Full effects, switching to Lite when this PC can't keep the menu smooth.
    #[default]
    Auto,
    Full,
    /// No blur, still backdrops, no endless animations: smooth on any PC.
    Lite,
}

/// Colours for the kinds of colour blindness: win/loss and ally/enemy stay apart in each.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ColorVision {
    #[default]
    Default,
    /// Deuteranopia and protanopia: no green against red.
    RedGreen,
    /// Tritanopia: no blue against green or yellow.
    BlueYellow,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct InterfaceSettings {
    pub theme: String,
    /// 0.0 (muted) to 1.0.
    pub ui_volume: f64,
    #[serde(deserialize_with = "or_default")]
    pub motion: MotionPreference,
    #[serde(deserialize_with = "or_default")]
    pub effects: EffectsQuality,
    pub backdrop: String,
    /// The interface's zoom, 0.8 to 1.25 (1.0 = as designed): text, controls and art grow
    /// while every piece keeps its place on screen.
    pub ui_scale: f64,
    /// Stronger text and borders, in every style.
    pub is_high_contrast: bool,
    #[serde(deserialize_with = "or_default")]
    pub color_vision: ColorVision,
}

/// A value this version does not know (a hand edit, or a file from a newer version) falls back
/// to the default instead of failing the whole file, which would reset every setting.
fn or_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: DeserializeOwned + Default,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(T::deserialize(value).unwrap_or_else(|error| {
        tracing::warn!(%error, "settings_value_unknown");
        T::default()
    }))
}

impl Default for InterfaceSettings {
    fn default() -> Self {
        Self {
            theme: "valorant-dark".to_owned(),
            ui_volume: DEFAULT_UI_VOLUME,
            motion: MotionPreference::System,
            effects: EffectsQuality::Auto,
            backdrop: "default".to_owned(),
            ui_scale: DEFAULT_UI_SCALE,
            is_high_contrast: false,
            color_vision: ColorVision::Default,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct StreamerSettings {
    pub is_enabled: bool,
    pub should_hide_own_name: bool,
}

impl Default for StreamerSettings {
    fn default() -> Self {
        Self {
            is_enabled: false,
            should_hide_own_name: true,
        }
    }
}

/// Kept by ValoShell only: Riot has no favourite-skin list to sync with, and its store
/// wishlist cannot be read reliably yet.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct CollectionSettings {
    /// Skin uuids, lowercase, in the order they were starred.
    pub favorite_skins: Vec<String>,
    /// Skin uuids, lowercase, in the order they were wished; the store points them out.
    pub wishlist_skins: Vec<String>,
}

/// Checking GitHub for a newer ValoShell. Installing always waits for the player.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct UpdateSettings {
    pub should_check_for_updates: bool,
}

impl Default for UpdateSettings {
    fn default() -> Self {
        Self {
            should_check_for_updates: true,
        }
    }
}

/// The welcome tour. A version, not a flag, so a later tour with new steps can show once more.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(default)]
#[ts(export)]
pub struct OnboardingSettings {
    /// The newest tour finished or skipped; 0 before the first one.
    pub completed_version: u32,
}

impl Settings {
    /// Clamp values a hand-edited or older file could carry out of range.
    pub fn normalized(mut self) -> Self {
        let volume = self.interface.ui_volume;
        self.interface.ui_volume = if volume.is_finite() {
            volume.clamp(0.0, 1.0)
        } else {
            DEFAULT_UI_VOLUME
        };
        let scale = self.interface.ui_scale;
        self.interface.ui_scale = if scale.is_finite() {
            scale.clamp(MIN_UI_SCALE, MAX_UI_SCALE)
        } else {
            DEFAULT_UI_SCALE
        };
        self.collection.favorite_skins = unique_ids(&self.collection.favorite_skins);
        self.collection.wishlist_skins = unique_ids(&self.collection.wishlist_skins);
        self
    }
}

/// Trimmed, lowercase, without blanks or repeats, first occurrence kept.
fn unique_ids(ids: &[String]) -> Vec<String> {
    let mut unique: Vec<String> = Vec::with_capacity(ids.len());
    for id in ids.iter().map(|id| id.trim().to_lowercase()) {
        if !id.is_empty() && !unique.contains(&id) {
            unique.push(id);
        }
    }
    unique
}

/// Shared settings handle: read anywhere, update atomically, subscribe to changes.
#[derive(Clone)]
pub struct SettingsStore {
    path: Arc<PathBuf>,
    sender: Arc<watch::Sender<Settings>>,
    /// One update at a time, so concurrent changes neither drop each other nor race on `.tmp`.
    writer: Arc<Mutex<()>>,
}

impl SettingsStore {
    /// Load from `path`. Missing file = defaults; unreadable file = defaults plus a backup of
    /// the bad file so nothing the user wrote is lost.
    pub fn load(path: PathBuf) -> Self {
        let settings = read_settings(&path).normalized();
        let (sender, _) = watch::channel(settings);
        Self {
            path: Arc::new(path),
            sender: Arc::new(sender),
            writer: Arc::new(Mutex::new(())),
        }
    }

    /// Current settings (cheap clone of a small struct).
    pub fn get(&self) -> Settings {
        self.sender.borrow().clone()
    }

    /// Receive every future change.
    pub fn subscribe(&self) -> watch::Receiver<Settings> {
        self.sender.subscribe()
    }

    /// Apply `change`, persist, then publish. Nothing is published if the write fails.
    pub fn update(&self, change: impl FnOnce(&mut Settings)) -> std::io::Result<Settings> {
        let _writing = self.writer.lock().unwrap_or_else(PoisonError::into_inner);
        let mut next = self.get();
        change(&mut next);
        let next = next.normalized();
        write_atomically(&self.path, &next)?;
        self.sender.send_replace(next.clone());
        Ok(next)
    }
}

fn read_settings(path: &Path) -> Settings {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        // First run: no file yet is the normal case, not a failure.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Settings::default(),
        Err(error) => {
            // A locked file (antivirus, OneDrive) is kept aside, or the next save would replace
            // the player's real settings with these defaults.
            tracing::warn!(%error, "settings_unreadable_using_defaults");
            back_up(path, "json.unreadable");
            return Settings::default();
        }
    };
    serde_json::from_str(&text).unwrap_or_else(|error| {
        tracing::warn!(%error, "settings_corrupt_using_defaults");
        back_up(path, "json.corrupt");
        Settings::default()
    })
}

fn back_up(path: &Path, extension: &str) {
    let backup = path.with_extension(extension);
    match std::fs::copy(path, &backup) {
        Ok(_) => tracing::info!(backup = %backup.display(), "settings_backed_up"),
        Err(error) => tracing::warn!(%error, backup = %backup.display(), "settings_backup_failed"),
    }
}

fn write_atomically(path: &Path, settings: &Settings) -> std::io::Result<()> {
    let text = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text).map_err(|error| with_path(error, &temporary))?;
    std::fs::rename(&temporary, path).map_err(|error| with_path(error, path))
}

#[cfg(test)]
mod tests;
