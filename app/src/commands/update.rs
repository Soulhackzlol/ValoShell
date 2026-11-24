//! ValoShell update commands: the current state, checking now, and installing, which starts
//! the new copy and exits (the new copy waits for this one to close; see `main`).

use services::update::{UpdateService, UpdateView};
use tauri::State;

type CommandResult<T = ()> = Result<T, String>;

/// The update as last checked.
#[tauri::command]
pub fn get_update(updates: State<'_, UpdateService>) -> UpdateView {
    updates.current()
}

/// Ask GitHub for the newest release now (the settings' "Check now").
#[tauri::command]
pub async fn check_for_update(updates: State<'_, UpdateService>) -> CommandResult<UpdateView> {
    updates.check().await.map_err(|error| error.to_string())
}

/// Download, verify and swap in the update, then restart into it.
#[tauri::command]
pub async fn install_update(
    app: tauri::AppHandle,
    updates: State<'_, UpdateService>,
) -> CommandResult {
    let exe = updates.install().await.map_err(|error| error.to_string())?;
    if let Err(error) = std::process::Command::new(&exe).spawn() {
        // An antivirus holding the fresh, unsigned exe is the usual cause: keep this copy.
        updates.restart_failed(&error);
        return Err(format!("Could not start the new version: {error}."));
    }
    app.exit(0);
    Ok(())
}
