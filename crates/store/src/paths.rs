//! Where ValoShell keeps its files: `%APPDATA%\ValoShell`.

use std::path::{Path, PathBuf};

/// Folder name under `%APPDATA%`. Renaming the app means changing this.
pub const APP_DIR_NAME: &str = "ValoShell";

/// Every location the app writes to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataPaths {
    pub root: PathBuf,
}

impl DataPaths {
    /// `%APPDATA%\ValoShell`, falling back to the home directory when APPDATA is unset.
    pub fn from_env() -> Self {
        Self {
            root: app_data_dir().join(APP_DIR_NAME),
        }
    }

    /// Paths under an explicit root (tests).
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    /// The app settings document.
    pub fn settings_file(&self) -> PathBuf {
        self.root.join("settings.json")
    }

    /// Per-scene HUD module placement.
    pub fn layouts_dir(&self) -> PathBuf {
        self.root.join("layouts")
    }

    /// User themes.
    pub fn themes_dir(&self) -> PathBuf {
        self.root.join("themes")
    }

    /// Saved loadout presets.
    pub fn loadouts_dir(&self) -> PathBuf {
        self.root.join("loadouts")
    }

    /// Downloaded assets. Safe to delete; rebuilt on demand.
    pub fn cache_dir(&self) -> PathBuf {
        self.root.join("cache")
    }

    /// Menu sounds the player drops in: `<style>/<cue>.wav`, or `all/<cue>.wav`.
    pub fn sounds_dir(&self) -> PathBuf {
        self.root.join("sounds")
    }

    /// Rolling log files.
    pub fn logs_dir(&self) -> PathBuf {
        self.root.join("logs")
    }

    /// Create every directory. Errors name the directory that failed.
    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            self.layouts_dir(),
            self.themes_dir(),
            self.loadouts_dir(),
            self.cache_dir(),
            self.logs_dir(),
            self.sounds_dir(),
        ] {
            std::fs::create_dir_all(&dir).map_err(|error| with_path(error, &dir))?;
        }
        Ok(())
    }
}

fn app_data_dir() -> PathBuf {
    std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Attach the path to an I/O error so the UI can say which folder is not writable.
pub(crate) fn with_path(error: std::io::Error, path: &Path) -> std::io::Error {
    std::io::Error::new(error.kind(), format!("{}: {error}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_dirs_creates_every_folder() {
        let root = std::env::temp_dir().join(format!("valoshell-paths-{}", std::process::id()));
        let paths = DataPaths::at(&root);

        paths.ensure_dirs().expect("writable temp dir");

        assert!(
            paths.layouts_dir().is_dir() && paths.cache_dir().is_dir() && paths.logs_dir().is_dir()
        );
        let _ = std::fs::remove_dir_all(root);
    }
}
