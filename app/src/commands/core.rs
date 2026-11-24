//! Settings, game snapshot, catalog and wallet: the reads every scene starts from.

use std::path::PathBuf;

use domain::phase::GameSnapshot;
use services::assets::{AssetIndexSummary, AssetStore};
use services::catalog::{Catalog, build_catalog};
use services::game_files::{self, GameVideo};
use services::game_sounds::{self, UiSound};
use services::wallet::{WalletService, WalletView};
use services::{ConnectionStatus, Ctx};
use store::Settings;
use tauri::{Manager, State};

/// Current settings.
#[tauri::command]
pub fn get_settings(ctx: State<'_, Ctx>) -> Settings {
    ctx.settings.get()
}

/// Replace settings with the UI's edited copy.
#[tauri::command]
pub fn save_settings(ctx: State<'_, Ctx>, settings: Settings) -> Result<Settings, String> {
    let saved = ctx
        .settings
        .update(|current| *current = settings)
        .map_err(|error| format!("Could not save settings: {error}"))?;
    ctx.bus.publish(services::AppEvent::Settings(saved.clone()));
    Ok(saved)
}

/// The game snapshot right now (the UI also receives every change as an event).
#[tauri::command]
pub fn get_game_snapshot(ctx: State<'_, Ctx>) -> GameSnapshot {
    ctx.game().borrow().clone()
}

/// Connection status right now (events carry every later change).
#[tauri::command]
pub fn get_connection(last: State<'_, crate::bridge::LastConnection>) -> ConnectionStatus {
    last.get()
}

/// Row counts of the loaded game assets (debug view).
#[tauri::command]
pub fn get_asset_index_summary(assets: State<'_, AssetStore>) -> AssetIndexSummary {
    assets.summary()
}

/// Agents and maps with art urls.
#[tauri::command]
pub fn get_catalog(assets: State<'_, AssetStore>) -> Catalog {
    build_catalog(&assets.index())
}

/// Videos shipped with the installed game (home-screen loops first). Their folder is opened
/// to the `asset:` protocol so the menu can play them; empty when VALORANT is not found.
#[tauri::command]
pub async fn get_game_videos(app: tauri::AppHandle) -> Vec<GameVideo> {
    // Disk lookups and a directory walk: keep them off the async workers.
    let found = tauri::async_runtime::spawn_blocking(move || {
        let program_data = std::env::var_os("ProgramData").map(PathBuf::from);
        let install = game_files::find_install(program_data.as_deref())?;
        let movies = game_files::movies_dir(&install);
        if let Err(error) = app.asset_protocol_scope().allow_directory(&movies, true) {
            tracing::warn!(%error, "game_videos_scope_failed");
            return None;
        }
        Some(game_files::list_videos(&movies))
    })
    .await;
    match found {
        Ok(videos) => videos.unwrap_or_default(),
        Err(error) => {
            tracing::warn!(%error, "game_videos_lookup_failed");
            Vec::new()
        }
    }
}

/// The player's own menu sounds folder (`%APPDATA%\ValoShell\sounds`).
pub struct SoundsDir(pub PathBuf);

const SOUNDS_README: &str = "ValoShell menu sounds\n\n\
Put a folder per menu style here (modern, beta, valnow, csgo, cs2, cs16, terminal, fortnite,\n\
minecraft, halo) or one named 'all', with files named after the cue:\n\n\
  hover.wav    pointer over a button\n\
  tab.wav      switching tabs or modes\n\
  confirm.wav  pressing a button\n\
  back.wav     closing or going back\n\
  found.wav    match found\n\n\
.ogg and .mp3 work too. Restart ValoShell or press Reload in Studio > Sound to pick them up.\n";

/// Menu sounds on disk per style: the sounds folder, then installed games (Minecraft, CS 1.6).
/// Each file is opened to the `asset:` protocol; cues with no file play the synthesised sound.
#[tauri::command]
pub async fn get_ui_sounds(
    app: tauri::AppHandle,
    dir: State<'_, SoundsDir>,
) -> Result<Vec<UiSound>, ()> {
    let sounds_dir = dir.0.clone();
    let found = tauri::async_runtime::spawn_blocking(move || {
        let readme = sounds_dir.join("README.txt");
        if !readme.exists() {
            let _ = std::fs::write(&readme, SOUNDS_README);
        }
        let app_data = std::env::var_os("APPDATA").map(PathBuf::from);
        let sounds = game_sounds::find_sounds(app_data.as_deref(), &sounds_dir);
        let scope = app.asset_protocol_scope();
        sounds
            .into_iter()
            .filter(|sound| match scope.allow_file(&sound.path) {
                Ok(()) => true,
                Err(error) => {
                    tracing::warn!(%error, "ui_sound_scope_failed");
                    false
                }
            })
            .collect::<Vec<_>>()
    })
    .await;
    Ok(found.unwrap_or_default())
}

/// Show the sounds folder in the file explorer.
#[tauri::command]
pub fn open_sounds_folder(app: tauri::AppHandle, dir: State<'_, SoundsDir>) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    std::fs::create_dir_all(&dir.0).map_err(|error| error.to_string())?;
    app.opener()
        .open_path(dir.0.to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}

/// Where a pasted short link (TikTok's `vm.tiktok.com/...`) leads; `None` for other links.
#[tauri::command]
pub async fn resolve_embed_link(url: String) -> Option<String> {
    services::embeds::resolve_short_link(&url).await
}

/// VALORANT's news in a site locale ("es-es"), for the play screen's tiles.
#[tauri::command]
pub async fn get_news(locale: String) -> Option<services::news::NewsView> {
    services::news::news(&locale).await
}

/// Last known wallet balances.
#[tauri::command]
pub fn get_wallet(wallet: State<'_, WalletService>) -> Option<WalletView> {
    wallet.current()
}

/// Close the app (Esc menu "Quit").
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
