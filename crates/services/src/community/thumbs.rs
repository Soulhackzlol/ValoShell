//! Community look thumbnails: a screenshot of each look's Home page, made by the repository's
//! workflow when the look is merged (`community/thumbs/<id>.webp`). Handed to the UI as a
//! `data:` URL, so a card never loads an image from the web itself, and only once the bytes
//! really are a WebP picture.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock, PoisonError};
use std::time::Instant;

use base64::Engine;

use super::{
    CommunityError, FRESH_FOR, MAX_CACHED_LOOKS, RAW_BASE, fetch_capped_bytes, is_valid_id,
};

/// A 640x360 WebP is 20-60 KB; anything far past that is not one of the workflow's pictures.
const MAX_THUMB_BYTES: usize = 256 * 1024;
/// A WebP file: `RIFF`, four bytes of length, then `WEBP`.
const RIFF_TAG: &[u8] = b"RIFF";
const WEBP_TAG: &[u8] = b"WEBP";
const WEBP_TAG_AT: usize = 8;

/// The bytes start like a WebP file (the image decoder checks the rest).
pub fn is_webp(bytes: &[u8]) -> bool {
    bytes.starts_with(RIFF_TAG)
        && bytes.get(WEBP_TAG_AT..WEBP_TAG_AT + WEBP_TAG.len()) == Some(WEBP_TAG)
}

/// The picture as a `data:` URL, or `BadThumb` when it is not a WebP.
pub fn thumb_data_url(bytes: &[u8]) -> Result<String, CommunityError> {
    if !is_webp(bytes) {
        return Err(CommunityError::BadThumb);
    }
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:image/webp;base64,{encoded}"))
}

fn thumb_cache() -> &'static Mutex<HashMap<String, (Instant, String)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (Instant, String)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// One shared look's thumbnail as a `data:` URL, kept as long as the list.
pub async fn community_thumb(id: &str) -> Result<String, CommunityError> {
    if !is_valid_id(id) {
        return Err(CommunityError::NotFound);
    }
    let cached = thumb_cache()
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .get(id)
        .filter(|(at, _)| at.elapsed() < FRESH_FOR)
        .map(|(_, url)| url.clone());
    if let Some(url) = cached {
        return Ok(url);
    }
    let bytes =
        fetch_capped_bytes(&format!("{RAW_BASE}/thumbs/{id}.webp"), MAX_THUMB_BYTES).await?;
    let url = thumb_data_url(&bytes)?;
    let mut cache = thumb_cache().lock().unwrap_or_else(PoisonError::into_inner);
    if cache.len() >= MAX_CACHED_LOOKS {
        cache.clear();
    }
    cache.insert(id.to_owned(), (Instant::now(), url.clone()));
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn webp_bytes_become_a_data_url() {
        let bytes = b"RIFF\x10\x00\x00\x00WEBPVP8 ";
        let url = thumb_data_url(bytes).expect("a WebP header passes");
        assert!(url.starts_with("data:image/webp;base64,UklGR"));
    }

    #[test]
    fn other_bytes_are_refused() {
        for bad in [
            &b""[..],
            b"RIFF",
            b"<svg onload=x>",
            b"RIFF\x10\x00\x00\x00WAVEfmt ",
        ] {
            assert!(matches!(thumb_data_url(bad), Err(CommunityError::BadThumb)));
        }
    }
}
