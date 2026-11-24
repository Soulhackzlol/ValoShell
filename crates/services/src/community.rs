//! Community looks: themes players share through the ValoShell repository. A look is added by
//! pull request as `community/looks/<id>.json`; once merged, a workflow rebuilds
//! `community/index.json`, which lists them. The app only reads, over HTTPS from GitHub's raw
//! file host without redirects, with size caps. The UI checks every look like any shared file
//! (colours, ids and pieces are repaired before use), so even a merged file cannot inject CSS.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock, PoisonError};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

pub mod thumbs;

const RAW_BASE: &str = "https://raw.githubusercontent.com/Soulhackzlol/ValoShell/main/community";
const TIMEOUT: Duration = Duration::from_secs(15);
/// The list is small text; anything bigger is not ours.
const MAX_INDEX_BYTES: usize = 256 * 1024;
/// Same cap as a stored look (store/src/documents.rs).
const MAX_LOOK_BYTES: usize = 4 * 1024 * 1024;
const MAX_ENTRIES: usize = 300;
const MAX_ID_CHARS: usize = 64;
const MAX_NAME_CHARS: usize = 48;
const MAX_AUTHOR_CHARS: usize = 40;
const MAX_DESCRIPTION_CHARS: usize = 200;
/// Opening the gallery again within this reuses the list instead of asking GitHub again.
const FRESH_FOR: Duration = Duration::from_secs(10 * 60);
/// Looks kept in memory between gallery openings; past this the cache starts over.
const MAX_CACHED_LOOKS: usize = 64;

/// One shared look as the gallery lists it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct CommunityLook {
    /// The file name without `.json`: lowercase letters, digits and dashes.
    pub id: String,
    pub name: String,
    /// Who shared it, as they chose to be credited; may be empty.
    pub author: String,
    pub description: String,
    /// The menu style it is built on (`valorant`, `csgo`...), for the card; may be empty.
    pub skin: String,
    /// The repository holds a screenshot of it (`thumbs::community_thumb`).
    pub has_thumb: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum CommunityError {
    #[error("The community gallery could not be reached. Check your connection and try again.")]
    Unreachable,
    #[error("The community gallery answered with something that is not a look list.")]
    BadIndex,
    #[error("That shared look is not available.")]
    NotFound,
    #[error("That shared look is too large to be a ValoShell look.")]
    TooLarge,
    #[error("That shared look is not a ValoShell look file.")]
    BadLook,
    #[error("That shared look's picture is not an image.")]
    BadThumb,
}

#[derive(Deserialize)]
struct RawIndex {
    #[serde(default)]
    looks: Vec<RawEntry>,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct RawEntry {
    id: String,
    name: String,
    author: String,
    description: String,
    skin: String,
    thumb: bool,
}

/// A safe file id: it becomes part of a URL, so nothing but `[a-z0-9-]`, not starting with `-`.
pub fn is_valid_id(id: &str) -> bool {
    let is_allowed = |char: char| char.is_ascii_lowercase() || char.is_ascii_digit() || char == '-';
    !id.is_empty() && id.len() <= MAX_ID_CHARS && !id.starts_with('-') && id.chars().all(is_allowed)
}

/// Trimmed, without control characters, and cut to `max` characters.
fn clean_text(text: &str, max: usize) -> String {
    text.trim()
        .chars()
        .filter(|char| !char.is_control())
        .take(max)
        .collect()
}

/// The listed looks, skipping entries without a usable id; the name falls back to the id.
pub fn parse_index(text: &str) -> Result<Vec<CommunityLook>, CommunityError> {
    let raw: RawIndex = serde_json::from_str(text).map_err(|_| CommunityError::BadIndex)?;
    let looks = raw
        .looks
        .into_iter()
        .filter(|entry| is_valid_id(&entry.id))
        .take(MAX_ENTRIES)
        .map(|entry| {
            let name = clean_text(&entry.name, MAX_NAME_CHARS);
            CommunityLook {
                name: if name.is_empty() {
                    entry.id.clone()
                } else {
                    name
                },
                author: clean_text(&entry.author, MAX_AUTHOR_CHARS),
                description: clean_text(&entry.description, MAX_DESCRIPTION_CHARS),
                skin: clean_text(&entry.skin, MAX_ID_CHARS),
                has_thumb: entry.thumb,
                id: entry.id,
            }
        })
        .collect();
    Ok(looks)
}

/// A look file's JSON: an object holding `theme` and `stages` objects, as the UI expects.
pub fn parse_look(text: &str) -> Result<Value, CommunityError> {
    let value: Value = serde_json::from_str(text).map_err(|_| CommunityError::BadLook)?;
    let is_look = ["theme", "stages"]
        .iter()
        .all(|key| value.get(key).is_some_and(Value::is_object));
    if is_look {
        Ok(value)
    } else {
        Err(CommunityError::BadLook)
    }
}

/// When the list was read, and the list.
type CachedIndex = Option<(Instant, Vec<CommunityLook>)>;

fn cache() -> &'static Mutex<CachedIndex> {
    static CACHE: OnceLock<Mutex<CachedIndex>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

/// The shared looks, from the cache when fresh.
pub async fn community_looks() -> Result<Vec<CommunityLook>, CommunityError> {
    let cached = cache()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .clone();
    if let Some((at, looks)) = cached.filter(|(at, _)| at.elapsed() < FRESH_FOR) {
        tracing::debug!(age_s = at.elapsed().as_secs(), "community_index_cached");
        return Ok(looks);
    }
    let looks =
        parse_index(&fetch_capped(&format!("{RAW_BASE}/index.json"), MAX_INDEX_BYTES).await?)?;
    *cache().lock().unwrap_or_else(PoisonError::into_inner) = Some((Instant::now(), looks.clone()));
    Ok(looks)
}

fn look_cache() -> &'static Mutex<HashMap<String, (Instant, Value)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Instant, Value)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// One shared look's document, checked for a look's shape (the UI repairs the rest). Kept as
/// long as the list, so reopening the gallery downloads nothing again.
pub async fn community_look(id: &str) -> Result<Value, CommunityError> {
    if !is_valid_id(id) {
        return Err(CommunityError::NotFound);
    }
    let cached = look_cache()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(id)
        .filter(|(at, _)| at.elapsed() < FRESH_FOR)
        .map(|(_, look)| look.clone());
    if let Some(look) = cached {
        return Ok(look);
    }
    let look =
        parse_look(&fetch_capped(&format!("{RAW_BASE}/looks/{id}.json"), MAX_LOOK_BYTES).await?)?;
    let mut cache = look_cache().lock().unwrap_or_else(PoisonError::into_inner);
    if cache.len() >= MAX_CACHED_LOOKS {
        cache.clear();
    }
    cache.insert(id.to_owned(), (Instant::now(), look.clone()));
    Ok(look)
}

/// One client for every request (connections are reused); `None` when TLS cannot start.
fn client() -> Option<&'static reqwest::Client> {
    static CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            riot::tls::install_crypto_provider();
            reqwest::Client::builder()
                .user_agent(concat!("ValoShell/", env!("CARGO_PKG_VERSION")))
                .https_only(true)
                .redirect(reqwest::redirect::Policy::none())
                .timeout(TIMEOUT)
                .build()
                .inspect_err(|error| tracing::error!(%error, "community_client_failed"))
                .ok()
        })
        .as_ref()
}

/// Add `chunk` to `body`, failing as soon as the total passes `max`.
fn append_capped(body: &mut Vec<u8>, chunk: &[u8], max: usize) -> Result<(), CommunityError> {
    if body.len() + chunk.len() > max {
        return Err(CommunityError::TooLarge);
    }
    body.extend_from_slice(chunk);
    Ok(())
}

/// GET `url` as text, failing once it passes `max` bytes instead of reading it all.
async fn fetch_capped(url: &str, max: usize) -> Result<String, CommunityError> {
    String::from_utf8(fetch_capped_bytes(url, max).await?).map_err(|_| CommunityError::BadLook)
}

/// GET `url`'s bytes, failing once they pass `max` instead of reading them all.
async fn fetch_capped_bytes(url: &str, max: usize) -> Result<Vec<u8>, CommunityError> {
    let client = client().ok_or(CommunityError::Unreachable)?;
    let mut response = client.get(url).send().await.map_err(|error| {
        tracing::warn!(%error, "community_fetch_failed");
        CommunityError::Unreachable
    })?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(CommunityError::NotFound);
    }
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "community_fetch_status");
        return Err(CommunityError::Unreachable);
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| CommunityError::Unreachable)?
    {
        append_capped(&mut body, &chunk, max)?;
    }
    Ok(body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_ids_are_url_safe_slugs() {
        assert!(is_valid_id("neon-night-2"));
        for bad in [
            "",
            "-lead",
            "Upper",
            "a/b",
            "../x",
            "a.json",
            "a b",
            &"x".repeat(65),
        ] {
            assert!(!is_valid_id(bad), "{bad} should be refused");
        }
    }

    #[test]
    fn index_skips_unsafe_ids_and_names_unnamed_looks_by_id() {
        let text =
            r#"{"looks":[{"id":"../evil","name":"x"},{"id":"calm-blue","author":"  Mia "}]}"#;
        let looks = parse_index(text).expect("index parses");
        assert_eq!(looks.len(), 1);
        assert_eq!(
            (looks[0].name.as_str(), looks[0].author.as_str()),
            ("calm-blue", "Mia")
        );
    }

    #[test]
    fn index_says_which_looks_have_a_thumbnail() {
        let looks =
            parse_index(r#"{"looks":[{"id":"a","thumb":true},{"id":"b"}]}"#).expect("index parses");
        assert_eq!((looks[0].has_thumb, looks[1].has_thumb), (true, false));
    }

    #[test]
    fn index_text_is_cut_and_stripped_of_control_characters() {
        let long = "a".repeat(500);
        let text =
            format!(r#"{{"looks":[{{"id":"a","name":"Bad\u0007Name","description":"{long}"}}]}}"#);
        let looks = parse_index(&text).expect("index parses");
        assert_eq!(looks[0].name, "BadName");
        assert_eq!(looks[0].description.chars().count(), MAX_DESCRIPTION_CHARS);
    }

    #[test]
    fn index_that_is_not_json_is_refused() {
        assert!(matches!(
            parse_index("<html>"),
            Err(CommunityError::BadIndex)
        ));
    }

    #[test]
    fn look_needs_theme_and_stages_objects() {
        assert!(parse_look(r#"{"theme":{},"stages":{}}"#).is_ok());
        assert!(matches!(
            parse_look(r#"{"theme":{}}"#),
            Err(CommunityError::BadLook)
        ));
        assert!(matches!(
            parse_look(r#"[1,2]"#),
            Err(CommunityError::BadLook)
        ));
    }

    #[test]
    fn body_stops_at_the_cap_instead_of_growing() {
        let mut body = Vec::new();
        assert!(append_capped(&mut body, b"abcd", 6).is_ok());
        assert!(matches!(
            append_capped(&mut body, b"efg", 6),
            Err(CommunityError::TooLarge)
        ));
        assert_eq!(body, b"abcd");
    }
}
