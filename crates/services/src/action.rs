//! Shared plumbing for user actions (party, pregame, stream delay): one error type with
//! plain-language messages, one "send and require 2xx" helper and one paced JSON read.

use riot::CachePolicy;
use riot::http::{Reply, Request, RiotHttp};
use riot::session::RiotSession;
use serde::de::DeserializeOwned;
use thiserror::Error;

/// Why a user action did not happen, worded for a toast.
#[derive(Debug, Error)]
pub enum ActionError {
    #[error("Not connected to VALORANT. Start the game and try again.")]
    NotConnected,
    #[error("{0}")]
    Rejected(String),
}

impl ActionError {
    /// `Could not <what>: <reason>.`
    pub fn could_not(what: &str, reason: impl std::fmt::Display) -> Self {
        Self::Rejected(format!("Could not {what}: {reason}."))
    }
}

/// Send a mutation immediately (user-initiated, never paced) and require a 2xx answer.
pub async fn send_ok(http: &RiotHttp, request: &Request, what: &str) -> Result<Reply, ActionError> {
    let reply = http.send(request).await;
    if reply.is_success() {
        return Ok(reply);
    }
    Err(ActionError::could_not(what, status_reason(&reply)))
}

/// Paced, uncached read decoded into `T`; `what` completes "Could not <what>".
pub(crate) async fn fetch_json<T: DeserializeOwned>(
    session: &RiotSession,
    request: &Request,
    what: &str,
) -> Result<T, ActionError> {
    let fetched = session
        .gate
        .fetch(&session.http, request, CachePolicy::Fresh)
        .await;
    if !fetched.is_complete {
        let reason = match fetched.status {
            0 => "Riot did not answer in time".to_owned(),
            status => format!("Riot answered HTTP {status}"),
        };
        return Err(ActionError::could_not(what, reason));
    }
    serde_json::from_value(fetched.data).map_err(|error| ActionError::could_not(what, error))
}

/// Short reason for a failed reply; Riot's own `message` field when it sent one.
fn status_reason(reply: &Reply) -> String {
    if reply.status == 0 {
        return "Riot did not answer in time".to_owned();
    }
    let message = reply
        .json_or_empty()
        .get("message")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned);
    match message {
        Some(message) if !message.is_empty() => format!("{message} (HTTP {})", reply.status),
        _ => format!("Riot answered HTTP {}", reply.status),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reply(status: u16, body: &str) -> Reply {
        Reply {
            status,
            body: body.to_owned(),
            retry_after: None,
        }
    }

    #[test]
    fn riot_message_is_preferred_over_the_bare_status() {
        let reason = status_reason(&reply(400, r#"{"message":"Party is full"}"#));

        assert_eq!(reason, "Party is full (HTTP 400)");
    }

    #[test]
    fn transport_failure_and_empty_bodies_have_readable_reasons() {
        assert_eq!(status_reason(&reply(0, "")), "Riot did not answer in time");
        assert_eq!(status_reason(&reply(409, "")), "Riot answered HTTP 409");
    }

    #[test]
    fn could_not_formats_a_sentence() {
        let error = ActionError::could_not("start the queue", "Riot answered HTTP 403");

        assert_eq!(
            error.to_string(),
            "Could not start the queue: Riot answered HTTP 403."
        );
    }
}
