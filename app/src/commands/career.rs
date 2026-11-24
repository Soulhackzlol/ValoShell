//! Store, career, progress, leaderboard, collection, agents, friends, live-lobby and post-match commands. Nothing here
//! can buy.

use services::AssetStore;
use services::agents::{AgentProgress, AgentsService};
use services::career::{CareerService, CareerView};
use services::collection::{
    CollectionService, CollectionView, CosmeticKind, CosmeticOption, IdentityChange, IdentityView,
    SkinCard, SkinOption, search_skins, skin_cards,
};
use services::history::{HistoryService, HistoryView};
use services::leaderboard::{LeaderboardService, LeaderboardView};
use services::lobby::{LobbyService, LobbyView};
use services::post_match::{PostMatchService, PostMatchView};
use services::progress::{ProgressService, ProgressView};
use services::social::{FriendView, SocialService};
use services::stats::StatsView;
use services::storefront::{StoreService, StoreView};
use tauri::State;

/// Today's store; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_store(
    store: State<'_, StoreService>,
    is_forced: bool,
) -> Result<StoreView, String> {
    store
        .view(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// Rank, RR and recent ranked matches; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_career(
    career: State<'_, CareerService>,
    is_forced: bool,
) -> Result<CareerView, String> {
    career
        .view(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// The region's competitive leaderboard; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_leaderboard(
    leaderboard: State<'_, LeaderboardService>,
    is_forced: bool,
) -> Result<LeaderboardView, String> {
    leaderboard
        .view(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// Account level, battle pass and missions; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_progress(
    progress: State<'_, ProgressService>,
    is_forced: bool,
) -> Result<ProgressView, String> {
    progress
        .view(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// The last matches in every mode; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_match_history(
    history: State<'_, HistoryService>,
    is_forced: bool,
) -> Result<HistoryView, String> {
    history
        .view(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// Own stats (overall, by agent, by map) over the recent matches.
#[tauri::command]
pub async fn get_stats(
    history: State<'_, HistoryService>,
    is_forced: bool,
) -> Result<StatsView, String> {
    history
        .stats(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// One past match as a post-match screen.
#[tauri::command]
pub async fn get_match_summary(
    history: State<'_, HistoryService>,
    match_id: String,
) -> Result<PostMatchView, String> {
    history
        .match_summary(&match_id)
        .await
        .map_err(|error| error.to_string())
}

/// The live lobby (or the last match's), if any.
#[tauri::command]
pub fn get_lobby(lobby: State<'_, LobbyService>) -> Option<LobbyView> {
    lobby.current()
}

/// The last match's summary, if one was collected since the app started.
#[tauri::command]
pub fn get_post_match(post_match: State<'_, PostMatchService>) -> Option<PostMatchView> {
    post_match.current()
}

/// The player closed the post-match screen.
#[tauri::command]
pub fn dismiss_post_match(post_match: State<'_, PostMatchService>) {
    post_match.dismiss();
}

/// Friends with live status.
#[tauri::command]
pub fn get_friends(social: State<'_, SocialService>) -> Vec<FriendView> {
    social.current()
}

/// Every weapon with its equipped skin.
#[tauri::command]
pub async fn get_collection(
    collection: State<'_, CollectionService>,
) -> Result<CollectionView, String> {
    collection.view().await.map_err(|error| error.to_string())
}

/// Card, title, the spray/flex wheel and every gun's buddy.
#[tauri::command]
pub async fn get_identity(
    collection: State<'_, CollectionService>,
) -> Result<IdentityView, String> {
    collection
        .identity()
        .await
        .map_err(|error| error.to_string())
}

/// Owned cosmetics of one kind (plus whatever is worn now).
#[tauri::command]
pub async fn get_cosmetic_options(
    collection: State<'_, CollectionService>,
    kind: CosmeticKind,
) -> Result<Vec<CosmeticOption>, String> {
    collection
        .cosmetic_options(kind)
        .await
        .map_err(|error| error.to_string())
}

/// Equip one identity cosmetic; returns the updated identity.
#[tauri::command]
pub async fn equip_identity(
    collection: State<'_, CollectionService>,
    change: IdentityChange,
) -> Result<IdentityView, String> {
    collection
        .equip_identity(&change)
        .await
        .map_err(|error| error.to_string())
}

/// Store skins matching `query` (every word, any order), for the wishlist.
#[tauri::command]
pub fn search_store_skins(assets: State<'_, AssetStore>, query: String) -> Vec<SkinCard> {
    search_skins(&assets.index(), &query)
}

/// Cards for the wished skins, in the order given.
#[tauri::command]
pub fn get_skin_cards(assets: State<'_, AssetStore>, skin_ids: Vec<String>) -> Vec<SkinCard> {
    skin_cards(&assets.index(), &skin_ids)
}

/// Owned skins for one weapon.
#[tauri::command]
pub async fn get_skin_options(
    collection: State<'_, CollectionService>,
    weapon_id: String,
) -> Result<Vec<SkinOption>, String> {
    collection
        .options(&weapon_id)
        .await
        .map_err(|error| error.to_string())
}

/// Owned agents and Agent Mastery levels; `is_forced` skips the short reuse window.
#[tauri::command]
pub async fn get_agent_progress(
    agents: State<'_, AgentsService>,
    is_forced: bool,
) -> Result<AgentProgress, String> {
    agents
        .progress(is_forced)
        .await
        .map_err(|error| error.to_string())
}

/// Equip an owned skin (and chroma) on a weapon; returns the updated collection.
#[tauri::command]
pub async fn equip_skin(
    collection: State<'_, CollectionService>,
    weapon_id: String,
    skin_id: String,
    chroma_id: String,
) -> Result<CollectionView, String> {
    collection
        .equip(&weapon_id, &skin_id, &chroma_id)
        .await
        .map_err(|error| error.to_string())
}
