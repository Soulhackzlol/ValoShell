//! One request path for the local client and the three remote hosts.
//!
//! Every request has a timeout, so a stuck connection can never hang a feature. A remote 401, or a
//! 400 naming `BAD_CLAIMS`, means an expired token: refresh once and resend once. Any other 400
//! is a real refusal and is never resent (a resent POST would act twice). Local requests never
//! refresh: a local 401 means the Riot Client restarted, which the connection supervisor handles.

use std::time::{Duration, Instant};

use arc_swap::ArcSwap;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use domain::region::Region;
use reqwest::{Method, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::Value;
use tokio::sync::Mutex;

use crate::auth::{CLIENT_PLATFORM, ENTITLEMENTS_PATH, EntitlementTokens, RemoteHeaders};
use crate::error::{RiotError, RiotResult};
use crate::lockfile::Lockfile;
use crate::tls;

/// Default per-request timeout.
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
/// Agent-select actions must fail fast so a retry still lands inside the timer.
pub const PREGAME_TIMEOUT: Duration = Duration::from_secs(5);
/// Concurrent 400s within this gap share one token refresh.
const AUTH_MIN_REFRESH_GAP: Duration = Duration::from_secs(30);
/// Error code in the body of a remote 400 caused by an expired or invalid access token.
const EXPIRED_TOKEN_CODE: &str = "BAD_CLAIMS";

/// Which server a request goes to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Host {
    Local,
    Pd,
    Glz,
    Shared,
}

/// A request description; build with `Request::get`/`post`/`put`/`delete`.
#[derive(Debug, Clone)]
pub struct Request {
    pub host: Host,
    pub method: Method,
    pub path: String,
    pub body: Option<Value>,
    pub timeout: Duration,
}

impl Request {
    fn new(host: Host, method: Method, path: impl Into<String>) -> Self {
        Self {
            host,
            method,
            path: path.into(),
            body: None,
            timeout: REQUEST_TIMEOUT,
        }
    }

    /// A GET request.
    pub fn get(host: Host, path: impl Into<String>) -> Self {
        Self::new(host, Method::GET, path)
    }

    /// A POST request with no body yet.
    pub fn post(host: Host, path: impl Into<String>) -> Self {
        Self::new(host, Method::POST, path)
    }

    /// A PUT request with no body yet.
    pub fn put(host: Host, path: impl Into<String>) -> Self {
        Self::new(host, Method::PUT, path)
    }

    /// A DELETE request.
    pub fn delete(host: Host, path: impl Into<String>) -> Self {
        Self::new(host, Method::DELETE, path)
    }

    /// Attach a JSON body.
    pub fn json(mut self, body: Value) -> Self {
        self.body = Some(body);
        self
    }

    /// Override the timeout.
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }
}

/// Raw outcome of a request. `status == 0` means the request never got an HTTP answer.
#[derive(Debug, Clone, PartialEq)]
pub struct Reply {
    pub status: u16,
    pub body: String,
    /// Only parsed on HTTP 429.
    pub retry_after: Option<Duration>,
}

impl Reply {
    fn transport_failure() -> Self {
        Self {
            status: 0,
            body: String::new(),
            retry_after: None,
        }
    }

    /// 2xx.
    pub fn is_success(&self) -> bool {
        (200..300).contains(&self.status)
    }

    /// Decode the body, or a typed error naming the endpoint.
    pub fn json<T: DeserializeOwned>(&self, endpoint: &str) -> RiotResult<T> {
        serde_json::from_str(&self.body).map_err(|error| RiotError::Decode {
            endpoint: endpoint.to_owned(),
            reason: error.to_string(),
        })
    }

    /// The body as JSON, or an empty object when absent or invalid (Riot sends empty 204s).
    pub fn json_or_empty(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or_else(|_| Value::Object(Default::default()))
    }
}

/// HTTP access for one Riot Client session. Rebuilt whenever the lockfile changes.
pub struct RiotHttp {
    local_client: reqwest::Client,
    remote_client: reqwest::Client,
    local_base: String,
    local_authorization: String,
    region: Region,
    headers: ArcSwap<RemoteHeaders>,
    last_refresh: Mutex<Option<Instant>>,
}

impl RiotHttp {
    /// Clients for this session. `headers` comes from the initial token exchange.
    pub fn new(lockfile: &Lockfile, region: Region, headers: RemoteHeaders) -> RiotResult<Self> {
        Ok(Self {
            local_client: build_local_client()?,
            remote_client: build_remote_client()?,
            local_base: format!("https://127.0.0.1:{}", lockfile.port),
            local_authorization: basic_authorization(&lockfile.password),
            region,
            headers: ArcSwap::from_pointee(headers),
            last_refresh: Mutex::new(None),
        })
    }

    /// The player's region and shard.
    pub fn region(&self) -> &Region {
        &self.region
    }

    /// Install the headers from the session's first token exchange.
    pub(crate) fn replace_headers(&self, headers: RemoteHeaders) {
        self.headers.store(headers.into());
    }

    /// Send a request; a remote token rejection triggers one token refresh and one resend.
    pub async fn send(&self, request: &Request) -> Reply {
        let reply = self.send_once(request).await;
        if request.host == Host::Local || !is_token_rejected(&reply) || !self.refresh_auth().await {
            return reply;
        }
        self.send_once(request).await
    }

    /// `send`, then decode a 2xx body into `T`; any other status becomes `RiotError::Status`.
    pub async fn send_json<T: DeserializeOwned>(&self, request: &Request) -> RiotResult<T> {
        let reply = self.send(request).await;
        ensure_success(&reply, request)?;
        reply.json(&request.path)
    }

    async fn send_once(&self, request: &Request) -> Reply {
        let builder = match request.host {
            Host::Local => self.local_request(request),
            _ => self.remote_request(request),
        };
        let builder = match &request.body {
            Some(body) => builder.json(body),
            None => builder,
        };
        match builder.timeout(request.timeout).send().await {
            Ok(response) => read_reply(response).await,
            Err(error) => {
                tracing::debug!(path = %redacted_path(&request.path), %error, "riot_request_failed");
                Reply::transport_failure()
            }
        }
    }

    fn local_request(&self, request: &Request) -> reqwest::RequestBuilder {
        let url = format!("{}{}", self.local_base, request.path);
        self.local_client
            .request(request.method.clone(), url)
            .header("Authorization", &self.local_authorization)
    }

    fn remote_request(&self, request: &Request) -> reqwest::RequestBuilder {
        let base = match request.host {
            Host::Glz => self.region.glz_url(),
            Host::Shared => self.region.shared_url(),
            Host::Pd | Host::Local => self.region.pd_url(),
        };
        // Headers are loaded per attempt so a resend after refresh uses the new tokens.
        let headers = self.headers.load();
        self.remote_client
            .request(request.method.clone(), format!("{base}{}", request.path))
            .header("Authorization", &headers.authorization)
            .header("X-Riot-Entitlements-JWT", &headers.entitlements_jwt)
            .header("X-Riot-ClientPlatform", CLIENT_PLATFORM)
            .header("X-Riot-ClientVersion", &headers.client_version)
    }

    /// Refresh tokens from the local client. `true` when headers are (now) fresh.
    async fn refresh_auth(&self) -> bool {
        let mut last_refresh = self.last_refresh.lock().await;
        if last_refresh.is_some_and(|at| at.elapsed() < AUTH_MIN_REFRESH_GAP) {
            // A sibling request refreshed moments ago; its headers are already in place.
            return true;
        }
        let reply = self
            .send_once(&Request::get(Host::Local, ENTITLEMENTS_PATH))
            .await;
        let tokens = reply.json::<EntitlementTokens>(ENTITLEMENTS_PATH).ok();
        let Some(tokens) = tokens.filter(EntitlementTokens::is_complete) else {
            tracing::warn!(status = reply.status, "riot_token_refresh_failed");
            return false;
        };
        let refreshed = self.headers.load().with_tokens(&tokens);
        self.headers.store(refreshed.into());
        *last_refresh = Some(Instant::now());
        tracing::info!("riot_token_refreshed");
        true
    }
}

/// `Ok` for 2xx, otherwise a `Status` error naming the endpoint.
/// The remote host refused the access token, not the request itself.
fn is_token_rejected(reply: &Reply) -> bool {
    match reply.status {
        401 => true,
        400 => reply.body.contains(EXPIRED_TOKEN_CODE),
        _ => false,
    }
}

/// Path segments followed by a secret: a party code joins whoever holds it, so it must never
/// reach a log, an error message or a toast on a stream.
const SECRET_AFTER: &[&str] = &["joinbycode"];

/// `path` as logs and errors may show it: uuid-shaped segments (puuids, match and roster ids)
/// and chat addresses become `{id}`, party codes become `{code}`, and the query is dropped, so
/// no player is identifiable and no party can be joined from it.
pub fn redacted_path(path: &str) -> String {
    let path = path.split('?').next().unwrap_or_default();
    let segments: Vec<&str> = path.split('/').collect();
    segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            let follows_secret = index > 0 && SECRET_AFTER.contains(&segments[index - 1]);
            if follows_secret && !segment.is_empty() {
                "{code}"
            } else if is_identifier(segment) {
                "{id}"
            } else {
                segment
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

/// A uuid (8-4-4-4-12 hex) or a chat address (`puuid@server`).
fn is_identifier(segment: &str) -> bool {
    const UUID_LENGTH: usize = 36;
    let is_uuid = segment.len() == UUID_LENGTH
        && segment
            .chars()
            .all(|letter| letter.is_ascii_hexdigit() || letter == '-')
        && segment.matches('-').count() == 4;
    is_uuid || segment.contains('@')
}

pub fn ensure_success(reply: &Reply, request: &Request) -> RiotResult<()> {
    if reply.is_success() {
        return Ok(());
    }
    if reply.status == 0 {
        return Err(RiotError::Transport {
            endpoint: redacted_path(&request.path),
            reason: "no answer (timeout or connection refused)".to_owned(),
        });
    }
    Err(RiotError::Status {
        status: reply.status,
        endpoint: redacted_path(&request.path),
    })
}

async fn read_reply(response: reqwest::Response) -> Reply {
    let status = response.status();
    let retry_after = (status == StatusCode::TOO_MANY_REQUESTS)
        .then(|| retry_after(response.headers()))
        .flatten();
    let body = response.text().await.unwrap_or_default();
    if status == StatusCode::TOO_MANY_REQUESTS {
        tracing::warn!(
            retry_after_s = retry_after.map(|wait| wait.as_secs_f64()),
            "riot_rate_limited"
        );
    }
    Reply {
        status: status.as_u16(),
        body,
        retry_after,
    }
}

fn retry_after(headers: &reqwest::header::HeaderMap) -> Option<Duration> {
    let seconds: f64 = headers
        .get("Retry-After")?
        .to_str()
        .ok()?
        .trim()
        .parse()
        .ok()?;
    (seconds.is_finite() && seconds >= 0.0).then(|| Duration::from_secs_f64(seconds))
}

/// `Basic base64("riot:" + password)`.
pub(crate) fn basic_authorization(password: &str) -> String {
    format!("Basic {}", STANDARD.encode(format!("riot:{password}")))
}

fn build_local_client() -> RiotResult<reqwest::Client> {
    let config = tls::local_client_config().map_err(|error| tls_error("local client", &error))?;
    reqwest::Client::builder()
        .tls_backend_preconfigured((*config).clone())
        .build()
        .map_err(|error| tls_error("local client", &error))
}

fn build_remote_client() -> RiotResult<reqwest::Client> {
    tls::install_crypto_provider();
    reqwest::Client::builder()
        .user_agent(concat!("ValoShell/", env!("CARGO_PKG_VERSION")))
        .gzip(true)
        .build()
        .map_err(|error| tls_error("remote client", &error))
}

fn tls_error(endpoint: &str, error: &dyn std::fmt::Display) -> RiotError {
    RiotError::Transport {
        endpoint: endpoint.to_owned(),
        reason: error.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logged_paths_hide_player_ids() {
        let path =
            "/mmr/v1/players/3b7c5a0e-1f2d-4c3b-9a8e-7d6c5b4a3f21/competitiveupdates?queue=x";

        assert_eq!(
            redacted_path(path),
            "/mmr/v1/players/{id}/competitiveupdates"
        );
        assert_eq!(
            redacted_path("/chat/v6/messages/abc@ares.pvp.net"),
            "/chat/v6/messages/{id}"
        );
    }

    #[test]
    fn logged_paths_hide_party_codes() {
        assert_eq!(
            redacted_path("/parties/v1/players/joinbycode/K7Q2XA"),
            "/parties/v1/players/joinbycode/{code}"
        );
    }

    #[test]
    fn basic_authorization_encodes_riot_user() {
        assert_eq!(basic_authorization("pw"), "Basic cmlvdDpwdw==");
    }

    #[test]
    fn empty_body_decodes_as_empty_object() {
        let reply = Reply {
            status: 204,
            body: String::new(),
            retry_after: None,
        };
        assert!(reply.is_success());
        assert_eq!(reply.json_or_empty(), serde_json::json!({}));
    }

    fn reply(status: u16, body: &str) -> Reply {
        Reply {
            status,
            body: body.to_owned(),
            retry_after: None,
        }
    }

    #[test]
    fn expired_token_is_a_token_rejection() {
        assert!(is_token_rejected(&reply(401, "")));
        assert!(is_token_rejected(&reply(
            400,
            r#"{"errorCode":"BAD_CLAIMS"}"#
        )));
    }

    #[test]
    fn plain_bad_request_is_not_resent() {
        assert!(!is_token_rejected(&reply(
            400,
            r#"{"errorCode":"PARTY_NOT_FOUND"}"#
        )));
        assert!(!is_token_rejected(&reply(404, "")));
    }

    #[test]
    fn transport_failure_is_reported_as_such() {
        let request = Request::get(Host::Pd, "/x");
        let error = ensure_success(&Reply::transport_failure(), &request).expect_err("fails");
        assert!(matches!(error, RiotError::Transport { .. }));
    }
}
