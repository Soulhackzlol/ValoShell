//! Reading a GitHub release: its version, notes and the two files an update needs (the exe
//! and SHA256SUMS.txt, as .github/workflows/release.yml publishes them). Pure, so tested alone.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Only files of this repository's own release are ever downloaded: the URL must be exactly
/// `https://github.com/<OWNER>/<REPO>/releases/download/<the release's tag>/<file>`.
const RELEASE_HOST: &str = "github.com";
const OWNER: &str = "Soulhackzlol";
const REPO: &str = "ValoShell";
const SUMS_FILE: &str = "SHA256SUMS.txt";
/// Release notes past this are cut; the release page has the rest.
const MAX_NOTES_CHARS: usize = 4000;
/// A SHA-256 written as hex.
const HASH_HEX_LEN: usize = 64;

/// The release as GitHub's API answers it (only the fields used).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct GithubRelease {
    pub tag_name: String,
    pub body: Option<String>,
    pub html_url: String,
    pub published_at: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
    pub assets: Vec<GithubAsset>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

/// The newest release, as the menu shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ReleaseView {
    /// "0.2.0", without the tag's `v`.
    pub version: String,
    /// The hand-written notes (Markdown), cut to a readable length.
    pub notes: String,
    pub page_url: String,
    /// ISO 8601; empty when GitHub did not say.
    pub published_at: String,
}

/// One file of a release.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Asset {
    pub name: String,
    pub url: String,
    pub size: u64,
}

/// A release that can be offered: its view plus the files to install it, when it has them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Release {
    pub view: ReleaseView,
    pub version: Version,
    pub exe: Option<Asset>,
    pub sums: Option<Asset>,
}

impl Release {
    /// Both files are there (`release_of` only keeps files of this repository's release).
    pub fn is_installable(&self) -> bool {
        self.exe.is_some() && self.sums.is_some()
    }
}

/// `major.minor.patch`; ordered, so newer compares greater.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Version(pub [u64; 3]);

/// "v0.2.0" or "0.2.0". Pre-release tags ("v0.2.0-beta.1") are not offered, as the release
/// workflow marks them pre-release and GitHub's "latest" never returns them anyway.
pub fn parse_version(tag: &str) -> Option<Version> {
    let text = tag.trim().strip_prefix('v').unwrap_or(tag.trim());
    let mut parts = text.split('.').map(|part| part.parse::<u64>().ok());
    let version = [parts.next()??, parts.next()??, parts.next()??];
    parts.next().is_none().then_some(Version(version))
}

/// The release, if it is a published, final one with a readable version.
pub fn release_of(github: GithubRelease) -> Option<Release> {
    if github.draft || github.prerelease {
        return None;
    }
    let version = parse_version(&github.tag_name)?;
    let tag = github.tag_name.trim();
    let exe_name = format!("ValoShell-{tag}.exe");
    let asset = |name: &str| {
        github
            .assets
            .iter()
            .find(|asset| {
                asset.name == name && is_release_file(&asset.browser_download_url, tag, name)
            })
            .map(|asset| Asset {
                name: asset.name.clone(),
                url: asset.browser_download_url.clone(),
                size: asset.size,
            })
    };
    let (exe, sums) = (asset(&exe_name), asset(SUMS_FILE));
    let [major, minor, patch] = version.0;
    let view = ReleaseView {
        version: format!("{major}.{minor}.{patch}"),
        notes: cut_notes(github.body.as_deref().unwrap_or_default()),
        page_url: github.html_url,
        published_at: github.published_at.unwrap_or_default(),
    };
    Some(Release {
        view,
        version,
        exe,
        sums,
    })
}

/// The URL names exactly this repository's `tag` release file `name`. Parsed, so `..` or
/// encoded tricks in the path cannot lead anywhere else.
pub fn is_release_file(url: &str, tag: &str, name: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(url) else {
        return false;
    };
    let segments: Option<Vec<&str>> = url.path_segments().map(Iterator::collect);
    let expected = [OWNER, REPO, "releases", "download", tag, name];
    url.scheme() == "https"
        && url.host_str() == Some(RELEASE_HOST)
        && url.query().is_none()
        && segments.is_some_and(|segments| segments == expected)
}

fn cut_notes(notes: &str) -> String {
    let notes = notes.trim();
    match notes.char_indices().nth(MAX_NOTES_CHARS) {
        Some((end, _)) => format!("{}…", &notes[..end]),
        None => notes.to_owned(),
    }
}

/// The hash SHA256SUMS.txt gives `file_name` (lowercase hex). Lines read `<hash>  <name>`, or
/// `<hash> *<name>` in binary mode.
pub fn expected_hash(sums: &str, file_name: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let (hash, name) = line.trim().split_once(char::is_whitespace)?;
        let name = name.trim_start().trim_start_matches('*');
        let is_hash =
            hash.len() == HASH_HEX_LEN && hash.bytes().all(|byte| byte.is_ascii_hexdigit());
        (is_hash && name == file_name).then(|| hash.to_ascii_lowercase())
    })
}
