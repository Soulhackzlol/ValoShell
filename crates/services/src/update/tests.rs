use std::sync::atomic::{AtomicU32, Ordering};

use sha2::{Digest, Sha256};

use super::integrity::{DownloadCheck, percent_of};
use super::release::{GithubAsset, GithubRelease, Version, is_release_file, release_of};
use super::swap::{marker_path, old_path};
use super::*;

const RELEASES: &str = "https://github.com/Soulhackzlol/ValoShell/releases/download";
const HASH: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

fn asset(name: &str, url: String) -> GithubAsset {
    GithubAsset {
        name: name.to_owned(),
        browser_download_url: url,
        size: 10,
    }
}

fn github(tag: &str) -> GithubRelease {
    let exe = format!("ValoShell-{tag}.exe");
    GithubRelease {
        tag_name: tag.to_owned(),
        body: Some("  Faster store.  ".to_owned()),
        html_url: format!("https://github.com/Soulhackzlol/ValoShell/releases/tag/{tag}"),
        published_at: Some("2026-10-24T10:00:00Z".to_owned()),
        assets: vec![
            asset(&exe, format!("{RELEASES}/{tag}/{exe}")),
            asset("SHA256SUMS.txt", format!("{RELEASES}/{tag}/SHA256SUMS.txt")),
        ],
        ..GithubRelease::default()
    }
}

/// A fresh folder per test, so tests running in parallel never share files.
fn scratch_dir() -> PathBuf {
    static NEXT: AtomicU32 = AtomicU32::new(0);
    let id = NEXT.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!("valoshell-update-{}-{id}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

fn sha256_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

// ---- versions and releases ----

#[test]
fn versions_parse_with_or_without_the_v() {
    assert_eq!(parse_version("v0.2.0"), Some(Version([0, 2, 0])));
    assert_eq!(parse_version("1.10.3"), Some(Version([1, 10, 3])));
}

#[test]
fn pre_release_and_malformed_tags_are_not_versions() {
    assert_eq!(parse_version("v0.2.0-beta.1"), None);
    assert_eq!(parse_version("v0.2"), None);
    assert_eq!(parse_version("v0.2.0.1"), None);
}

#[test]
fn only_a_higher_version_is_newer() {
    let release = release_of(github("v0.10.0")).unwrap();

    assert!(is_newer(&release, "0.9.9"));
    assert!(!is_newer(&release, "0.10.0"));
}

#[test]
fn a_release_names_its_exe_and_sums() {
    let release = release_of(github("v0.2.0")).unwrap();

    assert!(release.is_installable());
    assert_eq!(release.view.version, "0.2.0");
    assert_eq!(release.view.notes, "Faster store.");
    assert_eq!(
        release.exe.map(|exe| exe.name),
        Some("ValoShell-v0.2.0.exe".to_owned())
    );
}

#[test]
fn drafts_and_pre_releases_are_ignored() {
    let mut draft = github("v0.2.0");
    draft.draft = true;
    let mut pre = github("v0.2.0");
    pre.prerelease = true;

    assert!(release_of(draft).is_none());
    assert!(release_of(pre).is_none());
}

#[test]
fn long_notes_are_cut() {
    let mut github = github("v0.2.0");
    github.body = Some("x".repeat(5000));

    let notes = release_of(github).unwrap().view.notes;

    assert_eq!(
        notes.chars().count(),
        4001,
        "4000 characters and an ellipsis"
    );
}

// ---- where files may come from ----

#[test]
fn only_this_repositorys_file_of_this_tag_is_trusted() {
    let name = "ValoShell-v0.2.0.exe";

    assert!(is_release_file(
        &format!("{RELEASES}/v0.2.0/{name}"),
        "v0.2.0",
        name
    ));
    assert!(!is_release_file(
        &format!("{RELEASES}/v0.1.0/{name}"),
        "v0.2.0",
        name
    ));
    assert!(!is_release_file(
        &format!("https://example.com/v0.2.0/{name}"),
        "v0.2.0",
        name
    ));
    assert!(!is_release_file(
        &format!("http://github.com/Soulhackzlol/ValoShell/releases/download/v0.2.0/{name}"),
        "v0.2.0",
        name
    ));
}

#[test]
fn path_tricks_cannot_leave_the_repository() {
    let name = "ValoShell-v0.2.0.exe";
    let escaped = format!("{RELEASES}/../../../../evil/x/releases/download/v0.2.0/{name}");
    let encoded =
        format!("{RELEASES}/%2e%2e/%2e%2e/%2e%2e/%2e%2e/evil/x/releases/download/v0.2.0/{name}");

    assert!(!is_release_file(&escaped, "v0.2.0", name));
    assert!(!is_release_file(&encoded, "v0.2.0", name));
}

#[test]
fn files_hosted_elsewhere_are_never_offered() {
    let mut github = github("v0.2.0");
    github.assets[0] = asset(
        "ValoShell-v0.2.0.exe",
        "https://example.com/ValoShell-v0.2.0.exe".to_owned(),
    );

    let release = release_of(github).unwrap();

    assert!(release.exe.is_none());
    assert!(!release.is_installable());
}

#[test]
fn the_sums_file_gives_the_hash_of_the_named_file() {
    let sums = format!(
        "{}  other.exe\n{}  ValoShell-v0.2.0.exe\n",
        "f".repeat(64),
        HASH.to_uppercase()
    );

    assert_eq!(
        expected_hash(&sums, "ValoShell-v0.2.0.exe").as_deref(),
        Some(HASH)
    );
    assert_eq!(
        expected_hash(&format!("{HASH} *a.exe"), "a.exe").as_deref(),
        Some(HASH)
    );
    assert_eq!(expected_hash("nothex  a.exe", "a.exe"), None);
}

// ---- checking a download ----

#[test]
fn a_complete_download_with_the_published_hash_passes() {
    let mut check = DownloadCheck::new(6);

    assert_eq!(check.accept(b"val").unwrap(), 50);
    assert_eq!(check.accept(b"osh").unwrap(), 100);
    assert!(check.finish(&sha256_hex(b"valosh")).is_ok());
}

#[test]
fn a_download_with_another_hash_is_refused() {
    let mut check = DownloadCheck::new(6);
    check.accept(b"valosh").unwrap();

    assert!(matches!(check.finish(HASH), Err(UpdateError::HashMismatch)));
}

#[test]
fn a_download_larger_than_announced_stops_at_once() {
    let mut check = DownloadCheck::new(4);

    assert!(matches!(
        check.accept(b"valosh"),
        Err(UpdateError::TooLarge)
    ));
}

#[test]
fn a_short_download_is_refused_even_with_a_matching_prefix() {
    let mut check = DownloadCheck::new(6);
    check.accept(b"val").unwrap();

    assert!(matches!(
        check.finish(&sha256_hex(b"val")),
        Err(UpdateError::Truncated)
    ));
}

#[test]
fn progress_is_a_clamped_percentage() {
    assert_eq!(percent_of(5, 10), 50);
    assert_eq!(percent_of(0, 0), 100);
    assert_eq!(percent_of(20, 10), 100);
}

// ---- when installing is offered ----

#[test]
fn installing_needs_a_release_build_a_writable_folder_and_both_files() {
    let release = release_of(github("v0.2.0")).unwrap();

    assert!(can_install(false, true, Some(&release)));
    assert!(
        !can_install(true, true, Some(&release)),
        "dev builds link to the page"
    );
    assert!(
        !can_install(false, false, Some(&release)),
        "read-only folder"
    );
    assert!(!can_install(false, true, None));
}

#[test]
fn only_downloading_and_restarting_count_as_installing() {
    assert!(UpdateStage::Downloading { percent: 3 }.is_installing());
    assert!(UpdateStage::Restarting.is_installing());
    assert!(!UpdateStage::Available.is_installing());
}

// ---- swapping the exe ----

fn installed(dir: &Path) -> (PathBuf, PathBuf) {
    let (exe, staged) = (dir.join("ValoShell.exe"), dir.join("ValoShell.download"));
    std::fs::write(&exe, "old").unwrap();
    std::fs::write(&staged, "new").unwrap();
    (exe, staged)
}

#[test]
fn the_new_copy_takes_the_old_ones_path_and_marks_the_restart() {
    let (exe, staged) = installed(&scratch_dir());

    swap_in(&exe, &staged).unwrap();

    assert_eq!(std::fs::read_to_string(&exe).unwrap(), "new");
    assert_eq!(std::fs::read_to_string(old_path(&exe)).unwrap(), "old");
    assert!(marker_path(&exe).exists());
    assert!(!staged.exists());
}

#[test]
fn a_failed_swap_puts_the_old_copy_back() {
    let dir = scratch_dir();
    let exe = dir.join("ValoShell.exe");
    std::fs::write(&exe, "old").unwrap();

    let swapped = swap_in(&exe, &dir.join("missing.download"));

    assert!(swapped.is_err());
    assert_eq!(std::fs::read_to_string(&exe).unwrap(), "old");
    assert!(!marker_path(&exe).exists());
}

#[test]
fn a_restart_that_fails_rolls_the_swap_back() {
    let (exe, staged) = installed(&scratch_dir());
    swap_in(&exe, &staged).unwrap();

    roll_back(&exe).unwrap();

    assert_eq!(std::fs::read_to_string(&exe).unwrap(), "old");
    assert_eq!(std::fs::read_to_string(&staged).unwrap(), "new");
    assert!(!marker_path(&exe).exists() && !old_path(&exe).exists());
}

#[test]
fn a_start_after_an_update_clears_the_old_copy_and_the_marker() {
    let dir = scratch_dir();
    let exe = dir.join("ValoShell.exe");
    std::fs::write(old_path(&exe), "old").unwrap();
    std::fs::write(marker_path(&exe), "").unwrap();

    finish_previous_update(&exe);

    assert!(!old_path(&exe).exists());
    assert!(!marker_path(&exe).exists());
}

#[test]
fn a_leftover_download_is_only_dropped_after_the_guard() {
    let dir = scratch_dir();
    let exe = dir.join("ValoShell.exe");
    std::fs::write(staged_path(&exe), "half").unwrap();

    finish_previous_update(&exe);
    assert!(
        staged_path(&exe).exists(),
        "a second launch must not touch a running download"
    );

    discard_stale_download(&exe);
    assert!(!staged_path(&exe).exists());
}

#[test]
fn a_writable_folder_is_detected_and_left_clean() {
    let exe = scratch_dir().join("ValoShell.exe");

    assert!(can_write_next_to(&exe));
    assert!(!exe.with_extension("write-test").exists());
}
