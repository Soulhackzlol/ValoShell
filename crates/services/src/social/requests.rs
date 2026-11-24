//! Friend requests: the pending incoming and outgoing ones, and the player's own answers to
//! them. Every action here is one click by the player on their own account; nothing runs alone.

use domain::ids::Puuid;
use riot::api::local::friends::{
    FriendRequest, FriendRequestsResponse, accept_friend_request, decline_friend_request,
    get_friend_requests, send_friend_request,
};
use riot::session::RiotSession;
use serde::Serialize;
use ts_rs::TS;

use crate::action::{ActionError, send_ok};
use crate::ctx::Ctx;

const REQUESTS_ENDPOINT: &str = "friend_requests";
const REQUESTS_READ: &str = "read your friend requests";
const INCOMING: &str = "pending_in";
const OUTGOING: &str = "pending_out";

/// One pending friend request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct FriendRequestView {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    /// They asked us (accept or decline); otherwise we asked them (cancel).
    pub is_incoming: bool,
}

/// Pending requests only (the blocked list shares the shape), incoming first, then by name.
pub fn friend_request_views(requests: &[FriendRequest]) -> Vec<FriendRequestView> {
    let mut views: Vec<FriendRequestView> = requests
        .iter()
        .filter(|request| [INCOMING, OUTGOING].contains(&request.subscription.as_str()))
        .filter_map(|request| {
            Some(FriendRequestView {
                puuid: request.puuid.as_ref()?.to_string(),
                game_name: request.game_name.clone(),
                tag_line: request.game_tag.clone(),
                is_incoming: request.is_incoming(),
            })
        })
        .collect();
    views.sort_by(|a, b| {
        b.is_incoming
            .cmp(&a.is_incoming)
            .then_with(|| a.game_name.to_lowercase().cmp(&b.game_name.to_lowercase()))
    });
    views
}

/// `Name#TAG` split at the last `#`, both halves trimmed and non-empty.
pub fn parse_riot_id(riot_id: &str) -> Result<(&str, &str), ActionError> {
    riot_id
        .rsplit_once('#')
        .map(|(name, tag)| (name.trim(), tag.trim()))
        .filter(|(name, tag)| !name.is_empty() && !tag.is_empty())
        .ok_or_else(|| ActionError::could_not("add the friend", "type the Riot ID as Name#Tag"))
}

/// The pending requests, read fresh (a local Riot Client call: cheap, not rate limited).
pub async fn read_friend_requests(ctx: &Ctx) -> Result<Vec<FriendRequestView>, ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    Ok(friend_request_views(&pending(&session).await?))
}

/// Accept an incoming request; refused unless that player really asked.
pub async fn accept_request(ctx: &Ctx, puuid: &str) -> Result<(), ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    let request = find_pending(&session, puuid).await?;
    if !request.is_incoming() {
        return Err(ActionError::could_not("accept", "that request is your own"));
    }
    let what = "accept the friend request";
    run(&session, &accept_friend_request(&Puuid::new(puuid)), what).await
}

/// Decline an incoming request or cancel an outgoing one.
pub async fn remove_request(ctx: &Ctx, puuid: &str) -> Result<(), ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    find_pending(&session, puuid).await?;
    let what = "remove the friend request";
    run(&session, &decline_friend_request(&Puuid::new(puuid)), what).await
}

/// Send a request by Riot ID (Riot accepts it instead when that player already asked us).
pub async fn add_friend(ctx: &Ctx, riot_id: &str) -> Result<(), ActionError> {
    let (name, tag) = parse_riot_id(riot_id)?;
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    run(
        &session,
        &send_friend_request(name, tag),
        "send the friend request",
    )
    .await
}

async fn pending(session: &RiotSession) -> Result<Vec<FriendRequest>, ActionError> {
    let reply = session.http.send(&get_friend_requests()).await;
    if !reply.is_success() {
        tracing::warn!(
            endpoint = REQUESTS_ENDPOINT,
            status = reply.status,
            "riot_read_failed"
        );
        let reason = format!("Riot answered HTTP {}", reply.status);
        return Err(ActionError::could_not(REQUESTS_READ, reason));
    }
    let response: FriendRequestsResponse = reply.json(REQUESTS_ENDPOINT).map_err(|error| {
        tracing::warn!(endpoint = REQUESTS_ENDPOINT, %error, "riot_decode_failed");
        ActionError::could_not(REQUESTS_READ, "Riot sent an unexpected answer")
    })?;
    Ok(response.requests)
}

/// The pending request with that player, so a stale button never acts on someone else.
async fn find_pending(session: &RiotSession, puuid: &str) -> Result<FriendRequest, ActionError> {
    let wanted = Puuid::new(puuid);
    pending(session)
        .await?
        .into_iter()
        .filter(|request| [INCOMING, OUTGOING].contains(&request.subscription.as_str()))
        .find(|request| request.puuid.as_ref() == Some(&wanted))
        .ok_or_else(|| ActionError::could_not("answer", "that request is no longer pending"))
}

async fn run(
    session: &RiotSession,
    request: &riot::Request,
    what: &str,
) -> Result<(), ActionError> {
    send_ok(&session.http, request, what)
        .await
        .map(|_| ())
        .inspect_err(|error| tracing::warn!(endpoint = REQUESTS_ENDPOINT, %error, "action_failed"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(name: &str, puuid: Option<&str>, subscription: &str) -> FriendRequest {
        FriendRequest {
            game_name: name.to_owned(),
            game_tag: "EUW".to_owned(),
            puuid: puuid.map(Puuid::new),
            subscription: subscription.to_owned(),
            ..FriendRequest::default()
        }
    }

    #[test]
    fn friend_request_views_put_incoming_first_and_sort_by_name() {
        let requests = [
            request("zed", Some("z"), OUTGOING),
            request("Bob", Some("b"), INCOMING),
            request("amy", Some("a"), OUTGOING),
        ];

        let views = friend_request_views(&requests);

        let names: Vec<&str> = views.iter().map(|view| view.game_name.as_str()).collect();
        assert_eq!(names, ["Bob", "amy", "zed"]);
        assert!(views[0].is_incoming);
    }

    #[test]
    fn friend_request_views_drop_blocked_and_puuidless_entries() {
        let requests = [
            request("Blocked", Some("x"), ""),
            request("NoId", None, INCOMING),
        ];

        assert!(friend_request_views(&requests).is_empty());
    }

    #[test]
    fn parse_riot_id_splits_at_the_last_hash() {
        assert_eq!(parse_riot_id(" Na#me # EUW ").ok(), Some(("Na#me", "EUW")));
    }

    #[test]
    fn parse_riot_id_rejects_missing_halves() {
        assert!(parse_riot_id("NoTag").is_err());
        assert!(parse_riot_id("Name# ").is_err());
        assert!(parse_riot_id("#TAG").is_err());
    }
}
