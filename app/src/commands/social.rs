//! Friend request commands. Each runs only when the player clicks, on their own account.

use services::Ctx;
use services::social::requests::{
    FriendRequestView, accept_request, add_friend, read_friend_requests, remove_request,
};
use tauri::State;

type CommandResult<T = ()> = Result<T, String>;

/// Pending incoming and outgoing friend requests, read fresh.
#[tauri::command]
pub async fn get_friend_requests(ctx: State<'_, Ctx>) -> CommandResult<Vec<FriendRequestView>> {
    read_friend_requests(&ctx)
        .await
        .map_err(|error| error.to_string())
}

/// Accept an incoming request.
#[tauri::command]
pub async fn friend_request_accept(ctx: State<'_, Ctx>, puuid: String) -> CommandResult {
    accept_request(&ctx, &puuid)
        .await
        .map_err(|error| error.to_string())
}

/// Decline an incoming request or cancel an outgoing one.
#[tauri::command]
pub async fn friend_request_remove(ctx: State<'_, Ctx>, puuid: String) -> CommandResult {
    remove_request(&ctx, &puuid)
        .await
        .map_err(|error| error.to_string())
}

/// Send a friend request by Riot ID (`Name#TAG`).
#[tauri::command]
pub async fn friend_request_send(ctx: State<'_, Ctx>, riot_id: String) -> CommandResult {
    add_friend(&ctx, &riot_id)
        .await
        .map_err(|error| error.to_string())
}
