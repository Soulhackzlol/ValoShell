//! Swapping the running exe for a downloaded one. Windows lets a running exe be renamed but not
//! deleted, so the old copy steps aside as `<name>.old`, the new one takes its path (shortcuts
//! and pins keep working), and the new copy deletes `.old` once the old process has exited.
//! A `<name>.updating` marker says a restart is under way, so only that start ever waits.

use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// How long the start after an update waits for the copy it replaced to close (it exits
/// right after starting the new one, but a slow PC may take a while to shut its tasks).
const OLD_COPY_WAIT: Duration = Duration::from_secs(30);
const OLD_COPY_POLL: Duration = Duration::from_millis(200);

/// Where the old copy goes while the new one runs.
pub fn old_path(exe: &Path) -> PathBuf {
    exe.with_extension("old")
}

/// Where the download is written until it is verified.
pub fn staged_path(exe: &Path) -> PathBuf {
    exe.with_extension("download")
}

/// Present only between the swap and the new copy's first start.
pub fn marker_path(exe: &Path) -> PathBuf {
    exe.with_extension("updating")
}

/// Put `staged` in place of `exe` and leave the restart marker. If a step fails the old copy
/// is moved back, so the next launch still finds a working exe.
pub fn swap_in(exe: &Path, staged: &Path) -> io::Result<()> {
    let old = old_path(exe);
    remove_if_present(&old)?;
    std::fs::rename(exe, &old)?;
    if let Err(error) = std::fs::rename(staged, exe) {
        restore(&old, exe);
        return Err(error);
    }
    if let Err(error) = std::fs::write(marker_path(exe), b"") {
        // Without the marker the next start would not wait for this copy to close.
        tracing::warn!(%error, "update_marker_not_written");
    }
    Ok(())
}

/// Undo `swap_in` when the new copy could not be started: it goes back to `.download` and the
/// running copy returns to its path.
pub fn roll_back(exe: &Path) -> io::Result<()> {
    remove_if_present(&marker_path(exe))?;
    let staged = staged_path(exe);
    remove_if_present(&staged)?;
    std::fs::rename(exe, &staged)?;
    std::fs::rename(old_path(exe), exe)
}

fn restore(old: &Path, exe: &Path) {
    if let Err(error) = std::fs::rename(old, exe) {
        tracing::error!(%error, path = %exe.display(), "update_restore_failed");
    }
}

/// Run at start, before the single-instance guard: right after an update, wait for the copy it
/// replaced to close (its `.old` can only be deleted then), so the guard does not hand this
/// launch to it. Any other start only tries once to delete a leftover `.old`.
pub fn finish_previous_update(exe: &Path) {
    let marker = marker_path(exe);
    let is_restart = marker.exists();
    if let Err(error) = remove_if_present(&marker) {
        tracing::warn!(%error, "update_marker_left");
    }
    let old = old_path(exe);
    let deadline = Instant::now()
        + if is_restart {
            OLD_COPY_WAIT
        } else {
            Duration::ZERO
        };
    while old.exists() {
        match std::fs::remove_file(&old) {
            Ok(()) => tracing::info!("update_old_copy_removed"),
            // Access denied is what a still-running exe answers; anything else will not pass.
            Err(error)
                if error.kind() == io::ErrorKind::PermissionDenied && Instant::now() < deadline =>
            {
                std::thread::sleep(OLD_COPY_POLL);
            }
            Err(error) => {
                tracing::warn!(%error, "update_old_copy_left");
                return;
            }
        }
    }
}

/// Drop a download a previous run left half-way. Run after the single-instance guard: a second
/// launch must never delete the file the running copy is still downloading.
pub fn discard_stale_download(exe: &Path) {
    if let Err(error) = remove_if_present(&staged_path(exe)) {
        tracing::warn!(%error, "update_stale_download_left");
    }
}

/// Whether ValoShell may write next to its exe (not in a protected folder such as Program
/// Files), which installing needs.
pub fn can_write_next_to(exe: &Path) -> bool {
    let probe = exe.with_extension("write-test");
    let is_writable = std::fs::write(&probe, b"").is_ok();
    if is_writable && let Err(error) = std::fs::remove_file(&probe) {
        tracing::warn!(%error, "update_probe_left");
    }
    is_writable
}

/// Delete `path`; a file that is not there is fine.
pub fn remove_if_present(path: &Path) -> io::Result<()> {
    match std::fs::remove_file(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}
