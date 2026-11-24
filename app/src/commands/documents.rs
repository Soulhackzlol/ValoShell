//! Layout, theme and loadout-preset documents and the in-game overlay switches. Presets are
//! listed and deleted like any document; saving and equipping one goes through the collection.

use std::path::{Path, PathBuf};

use serde_json::Value;
use services::collection::{CollectionService, LoadoutPreset, PresetApplied};
use store::DataPaths;
use store::documents::{
    delete_document, document_path, list_documents, load_document, save_document,
};
use tauri::{AppHandle, Manager, State};

type CommandResult<T = ()> = Result<T, String>;

/// Folders documents are kept in (managed state, set at startup).
pub struct DocumentDirs {
    layouts: PathBuf,
    themes: PathBuf,
    loadouts: PathBuf,
}

impl DocumentDirs {
    pub fn new(paths: &DataPaths) -> Self {
        Self {
            layouts: paths.layouts_dir(),
            themes: paths.themes_dir(),
            loadouts: paths.loadouts_dir(),
        }
    }

    fn of(&self, kind: &str) -> CommandResult<&Path> {
        match kind {
            "layouts" => Ok(&self.layouts),
            "themes" => Ok(&self.themes),
            "loadouts" => Ok(&self.loadouts),
            other => Err(format!("Unknown document kind \"{other}\".")),
        }
    }
}

/// Save the loadout as it is now under `name`.
#[tauri::command]
pub async fn save_loadout_preset(
    dirs: State<'_, DocumentDirs>,
    collection: State<'_, CollectionService>,
    name: String,
) -> CommandResult {
    let preset = collection
        .snapshot_preset()
        .await
        .map_err(|error| error.to_string())?;
    let document = serde_json::to_value(&preset).map_err(|error| error.to_string())?;
    save_document(&dirs.loadouts, &name, &document).map_err(|error| error.to_string())
}

/// Equip the preset saved as `name`.
#[tauri::command]
pub async fn apply_loadout_preset(
    dirs: State<'_, DocumentDirs>,
    collection: State<'_, CollectionService>,
    name: String,
) -> CommandResult<PresetApplied> {
    let document = load_document(&dirs.loadouts, &name)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("No saved loadout is called \"{name}\"."))?;
    let preset: LoadoutPreset = serde_json::from_value(document)
        .map_err(|error| format!("The saved loadout \"{name}\" could not be read: {error}."))?;
    collection
        .apply_preset(&preset)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_ui_documents(
    dirs: State<'_, DocumentDirs>,
    kind: String,
) -> CommandResult<Vec<String>> {
    list_documents(dirs.of(&kind)?).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn load_ui_document(
    dirs: State<'_, DocumentDirs>,
    kind: String,
    name: String,
) -> CommandResult<Option<Value>> {
    load_document(dirs.of(&kind)?, &name).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_ui_document(
    dirs: State<'_, DocumentDirs>,
    kind: String,
    name: String,
    document: Value,
) -> CommandResult {
    save_document(dirs.of(&kind)?, &name, &document).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_ui_document(
    dirs: State<'_, DocumentDirs>,
    kind: String,
    name: String,
) -> CommandResult {
    delete_document(dirs.of(&kind)?, &name).map_err(|error| error.to_string())
}

/// Show the looks folder in the file explorer: saved looks live there, and a look file someone
/// shared shows up in the gallery once dropped in.
#[tauri::command]
pub fn open_looks_folder(app: AppHandle, dirs: State<'_, DocumentDirs>) -> CommandResult {
    use tauri_plugin_opener::OpenerExt;
    std::fs::create_dir_all(&dirs.themes).map_err(|error| error.to_string())?;
    app.opener()
        .open_path(dirs.themes.to_string_lossy(), None::<&str>)
        .map_err(|error| error.to_string())
}

/// Select a saved look's file in the file explorer, ready to send to someone.
#[tauri::command]
pub fn reveal_look(app: AppHandle, dirs: State<'_, DocumentDirs>, name: String) -> CommandResult {
    use tauri_plugin_opener::OpenerExt;
    let file = document_path(&dirs.themes, &name)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| format!("No saved look is called \"{name}\"."))?;
    app.opener()
        .reveal_item_in_dir(file)
        .map_err(|error| error.to_string())
}

/// The UI says whether the in-game layout has anything to show.
#[tauri::command]
pub fn set_overlay_enabled(app: AppHandle, is_enabled: bool) {
    crate::overlay::set_enabled(&app, is_enabled);
}

/// Show the in-game overlay now (editing / filming) regardless of the match.
#[tauri::command]
pub fn set_overlay_preview(app: AppHandle, is_visible: bool) {
    crate::overlay::set_preview(&app, is_visible);
}

/// The looks players shared in the community gallery (read from the ValoShell repository).
#[tauri::command]
pub async fn community_looks() -> CommandResult<Vec<services::community::CommunityLook>> {
    services::community::community_looks()
        .await
        .map_err(|error| error.to_string())
}

/// One community look's document, to preview or apply; the UI checks it like a shared file.
#[tauri::command]
pub async fn community_look(id: String) -> CommandResult<Value> {
    services::community::community_look(&id)
        .await
        .map_err(|error| error.to_string())
}

/// One community look's screenshot as a `data:` URL, for its gallery card.
#[tauri::command]
pub async fn community_thumb(id: String) -> CommandResult<String> {
    services::community::thumbs::community_thumb(&id)
        .await
        .map_err(|error| error.to_string())
}

/// Fullscreen, or the client-sized window for styles drawn as a desktop client (League).
#[tauri::command]
pub fn set_window_mode(app: AppHandle, is_windowed: bool) {
    if let Some(window) = app.get_webview_window(crate::MAIN_WINDOW) {
        crate::game_window::set_windowed(&window, is_windowed);
    }
}
