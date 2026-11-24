//! Why a check or an install did not go through, in words the menu can show as they are. The
//! text completes "Could not <check for updates|install the update>: ". Network errors never
//! carry the URL: GitHub's download links are long, signed and not for the player's eyes.

use std::io;

#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    #[error("GitHub could not be reached; check your connection")]
    Offline,
    #[error("GitHub is limiting update checks; try again later")]
    RateLimited,
    #[error("GitHub answered {0}")]
    Status(u16),
    #[error("GitHub's answer could not be read")]
    Unreadable,
    #[error("the release is missing its files")]
    Incomplete,
    #[error("the download is larger than the release says")]
    TooLarge,
    #[error("the download was cut short")]
    Truncated,
    #[error("the download does not match its published SHA-256")]
    HashMismatch,
    #[error("the file could not be written ({0}); is ValoShell in a read-only folder?")]
    Write(io::Error),
    #[error("the new copy could not replace this one ({0})")]
    Swap(io::Error),
}

const FORBIDDEN: u16 = 403;
const TOO_MANY_REQUESTS: u16 = 429;

impl From<reqwest::Error> for UpdateError {
    fn from(error: reqwest::Error) -> Self {
        let kind = match error.status().map(|status| status.as_u16()) {
            Some(FORBIDDEN | TOO_MANY_REQUESTS) => Self::RateLimited,
            Some(status) => Self::Status(status),
            None if error.is_decode() => Self::Unreadable,
            None => Self::Offline,
        };
        tracing::debug!(error = %error.without_url(), "update_request_failed");
        kind
    }
}
