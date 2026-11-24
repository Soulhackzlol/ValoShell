//! Talking to GitHub: the latest release, its SHA256SUMS.txt and the exe. HTTPS only, and
//! redirects are followed only to GitHub's own download hosts, so a release asset can never
//! bounce the download somewhere else.

use std::path::Path;
use std::time::Duration;

use tokio::io::AsyncWriteExt;

use super::error::UpdateError;
use super::integrity::DownloadCheck;
use super::release::{Asset, GithubRelease, Release, release_of};

const LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/Soulhackzlol/ValoShell/releases/latest";
/// Release downloads redirect from github.com to one of these.
const TRUSTED_HOSTS: [&str; 4] = [
    "api.github.com",
    "github.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
];
const MAX_REDIRECTS: usize = 5;
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// Per read, not per download, so a slow connection still finishes.
const READ_TIMEOUT: Duration = Duration::from_secs(30);
/// SHA256SUMS.txt holds a line per file; anything this big is not ours.
const MAX_SUMS_BYTES: u64 = 64 * 1024;

fn is_trusted(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| TRUSTED_HOSTS.contains(&host))
}

pub fn client() -> Result<reqwest::Client, UpdateError> {
    riot::tls::install_crypto_provider();
    let redirects = reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= MAX_REDIRECTS || !is_trusted(attempt.url()) {
            attempt.stop()
        } else {
            attempt.follow()
        }
    });
    Ok(reqwest::Client::builder()
        .user_agent(concat!("ValoShell/", env!("CARGO_PKG_VERSION")))
        .https_only(true)
        .redirect(redirects)
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(READ_TIMEOUT)
        .build()?)
}

/// The latest final release; `None` when the repository has none yet.
pub async fn fetch_latest(http: &reqwest::Client) -> Result<Option<Release>, UpdateError> {
    let response = http
        .get(LATEST_RELEASE_URL)
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    let github: GithubRelease = response.error_for_status()?.json().await?;
    Ok(release_of(github))
}

/// SHA256SUMS.txt, refusing anything larger than such a file can be.
pub async fn fetch_sums(http: &reqwest::Client, sums: &Asset) -> Result<String, UpdateError> {
    if sums.size > MAX_SUMS_BYTES {
        return Err(UpdateError::TooLarge);
    }
    let mut response = http.get(&sums.url).send().await?.error_for_status()?;
    let mut text = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        text.extend_from_slice(&chunk);
        if text.len() as u64 > MAX_SUMS_BYTES {
            return Err(UpdateError::TooLarge);
        }
    }
    String::from_utf8(text).map_err(|_| UpdateError::Unreadable)
}

/// Stream `file` to `dest`, checking size and SHA-256 on the way; `on_progress` gets percent.
pub async fn download(
    http: &reqwest::Client,
    file: &Asset,
    dest: &Path,
    on_progress: impl FnMut(u8),
) -> Result<DownloadCheck, UpdateError> {
    let mut response = http.get(&file.url).send().await?.error_for_status()?;
    let mut out = tokio::fs::File::create(dest)
        .await
        .map_err(UpdateError::Write)?;
    let mut check = DownloadCheck::new(file.size);
    let mut on_progress = on_progress;
    while let Some(chunk) = response.chunk().await? {
        let percent = check.accept(&chunk)?;
        out.write_all(&chunk).await.map_err(UpdateError::Write)?;
        on_progress(percent);
    }
    out.sync_all().await.map_err(UpdateError::Write)?;
    Ok(check)
}
