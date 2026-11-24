//! Read-only game info: Riot's server status, the agent store and the in-game favourite
//! skins. Nothing here buys or writes to Riot.

use services::favorites::read_favorite_skins;
use services::server_status::{ServiceNoticeView, read_service_status};
use services::storefront::agent_store::{AgentOfferView, read_agent_store};
use services::{AssetStore, Ctx};
use tauri::State;

type CommandResult<T> = Result<T, String>;

/// Active maintenance and incidents for the player's region.
#[tauri::command]
pub async fn get_service_status(ctx: State<'_, Ctx>) -> CommandResult<Vec<ServiceNoticeView>> {
    read_service_status(&ctx)
        .await
        .map_err(|error| error.to_string())
}

/// Agents on sale with their prices. View only.
#[tauri::command]
pub async fn get_agent_store(
    ctx: State<'_, Ctx>,
    assets: State<'_, AssetStore>,
) -> CommandResult<Vec<AgentOfferView>> {
    read_agent_store(&ctx, &assets)
        .await
        .map_err(|error| error.to_string())
}

/// Skin ids the player starred in VALORANT (lowercase).
#[tauri::command]
pub async fn get_favorite_skins(
    ctx: State<'_, Ctx>,
    assets: State<'_, AssetStore>,
) -> CommandResult<Vec<String>> {
    read_favorite_skins(&ctx, &assets)
        .await
        .map_err(|error| error.to_string())
}
