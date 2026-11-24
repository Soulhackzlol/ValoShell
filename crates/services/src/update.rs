//! In-app updates for the portable exe (no installer, no code signing). The newest GitHub
//! release is checked shortly after start and every few hours (unless the player turned that
//! off). Installing downloads the release's exe next to the running one, checks its size and
//! SHA-256 against the release's SHA256SUMS.txt, and swaps it in; the app shell then starts the
//! new copy and exits. Nothing is installed without the player asking, and never mid-match.

mod error;
mod fetch;
mod integrity;
mod release;
mod swap;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::Duration;

use serde::Serialize;
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

use error::UpdateError;
use fetch::{client, download, fetch_latest, fetch_sums};
pub use release::ReleaseView;
use release::{Release, expected_hash, parse_version};
use swap::{can_write_next_to, remove_if_present, roll_back, staged_path, swap_in};
pub use swap::{discard_stale_download, finish_previous_update};

use crate::action::ActionError;
use crate::ctx::Ctx;
use crate::event::AppEvent;

const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
/// After start-up settles, so the check never competes with the first Riot reads.
const FIRST_CHECK_DELAY: Duration = Duration::from_secs(30);
/// Unauthenticated GitHub API calls are limited per hour; this stays far below.
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

/// Where the update stands.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "stage", rename_all = "snake_case")]
#[ts(export)]
pub enum UpdateStage {
    /// Not checked yet.
    Idle,
    Checking,
    UpToDate,
    Available,
    Downloading {
        percent: u8,
    },
    /// Swapped in; the app is about to start the new copy.
    Restarting,
    Failed {
        message: String,
    },
}

impl UpdateStage {
    /// An install is running or about to restart the app.
    pub fn is_installing(&self) -> bool {
        matches!(self, Self::Downloading { .. } | Self::Restarting)
    }
}

/// The update as the menu shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct UpdateView {
    pub current_version: String,
    /// The newest release when it is newer than this copy.
    pub latest: Option<ReleaseView>,
    pub stage: UpdateStage,
    /// False in dev builds, when the release lacks its files, or when ValoShell cannot write
    /// next to its exe; the menu then links to the release page instead.
    pub can_install: bool,
}

struct State {
    view: UpdateView,
    release: Option<Release>,
}

struct Inner {
    ctx: Ctx,
    /// The running exe; `None` when it could not be found.
    exe: Option<PathBuf>,
    state: Mutex<State>,
    /// One check or install at a time.
    work: tokio::sync::Mutex<()>,
}

/// Cheap to clone.
#[derive(Clone)]
pub struct UpdateService {
    inner: Arc<Inner>,
}

impl UpdateService {
    /// Nothing checked yet; `exe` is the running exe that installing replaces.
    pub fn new(ctx: &Ctx, exe: Option<PathBuf>) -> Self {
        let view = UpdateView {
            current_version: CURRENT_VERSION.to_owned(),
            latest: None,
            stage: UpdateStage::Idle,
            can_install: false,
        };
        let state = State {
            view,
            release: None,
        };
        Self {
            inner: Arc::new(Inner {
                ctx: ctx.clone(),
                exe,
                state: Mutex::new(state),
                work: tokio::sync::Mutex::new(()),
            }),
        }
    }

    fn state(&self) -> MutexGuard<'_, State> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// The update as last published.
    pub fn current(&self) -> UpdateView {
        self.state().view.clone()
    }

    /// Background task: check after start-up, then every few hours, while checks are on.
    pub async fn run(self, stop: CancellationToken) {
        let mut wait = FIRST_CHECK_DELAY;
        loop {
            tokio::select! {
                () = stop.cancelled() => return,
                () = tokio::time::sleep(wait) => {}
            }
            wait = CHECK_INTERVAL;
            let is_on = self
                .inner
                .ctx
                .settings
                .get()
                .updates
                .should_check_for_updates;
            if is_on && !self.state().view.stage.is_installing() {
                // The outcome is published either way; the menu shows a failure if asked.
                let _ = self.check().await;
            }
        }
    }

    /// Ask GitHub for the newest release now.
    pub async fn check(&self) -> Result<UpdateView, ActionError> {
        let _work = self.inner.work.lock().await;
        self.set_stage(UpdateStage::Checking);
        let found = match client() {
            Ok(http) => fetch_latest(&http).await,
            Err(error) => Err(error),
        };
        match found {
            Ok(found) => {
                let release = found.filter(|release| is_newer(release, CURRENT_VERSION));
                self.set_release(release);
                Ok(self.current())
            }
            Err(error) => Err(self.fail("check for updates", &error)),
        }
    }

    /// Download, verify and swap in the offered release; returns the exe to start.
    pub async fn install(&self) -> Result<PathBuf, ActionError> {
        let what = "install the update";
        if self.inner.ctx.game().borrow().phase.is_live() {
            return Err(ActionError::could_not(what, "finish your match first"));
        }
        // A second click while one install runs (or restarts) is refused, not queued.
        let Ok(_work) = self.inner.work.try_lock() else {
            return Err(ActionError::could_not(
                what,
                "an update step is already running",
            ));
        };
        let (release, exe) = self.installable()?;
        self.set_stage(UpdateStage::Downloading { percent: 0 });
        let staged = staged_path(&exe);
        if let Err(error) = self.download_and_swap(&release, &exe, &staged).await {
            if let Err(cleanup) = remove_if_present(&staged) {
                tracing::warn!(%cleanup, "update_download_left");
            }
            return Err(self.fail(what, &error));
        }
        self.set_stage(UpdateStage::Restarting);
        Ok(exe)
    }

    /// The new copy is in place but could not be started: put this copy back and say why.
    pub fn restart_failed(&self, error: &std::io::Error) {
        tracing::warn!(%error, "update_restart_failed");
        let rolled_back = self.inner.exe.as_deref().map(roll_back);
        let message = match rolled_back {
            Some(Ok(())) => format!("the new version did not start ({error}); this one was kept"),
            _ => "the new version did not start; close ValoShell and open it again".to_owned(),
        };
        self.set_stage(UpdateStage::Failed { message });
    }

    fn fail(&self, what: &str, error: &UpdateError) -> ActionError {
        tracing::info!(%error, what, "update_failed");
        let message = error.to_string();
        self.set_stage(UpdateStage::Failed {
            message: message.clone(),
        });
        ActionError::could_not(what, message)
    }

    fn installable(&self) -> Result<(Release, PathBuf), ActionError> {
        let state = self.state();
        let what = "install the update";
        if state.view.stage.is_installing() {
            return Err(ActionError::could_not(what, "it is already under way"));
        }
        let release = state
            .release
            .clone()
            .ok_or_else(|| ActionError::could_not(what, "there is none"))?;
        let exe = self.inner.exe.clone().filter(|_| state.view.can_install);
        let exe =
            exe.ok_or_else(|| ActionError::could_not(what, "download it from the release page"))?;
        Ok((release, exe))
    }

    async fn download_and_swap(
        &self,
        release: &Release,
        exe: &Path,
        staged: &Path,
    ) -> Result<(), UpdateError> {
        let (Some(file), Some(sums)) = (&release.exe, &release.sums) else {
            return Err(UpdateError::Incomplete);
        };
        let http = client()?;
        let sums_text = fetch_sums(&http, sums).await?;
        let hash = expected_hash(&sums_text, &file.name).ok_or(UpdateError::Incomplete)?;
        let on_progress = |percent| self.set_stage(UpdateStage::Downloading { percent });
        download(&http, file, staged, on_progress)
            .await?
            .finish(&hash)?;
        swap_in(exe, staged).map_err(UpdateError::Swap)
    }

    fn set_release(&self, release: Option<Release>) {
        let can_write = self.inner.exe.as_deref().is_some_and(can_write_next_to);
        let can_install = can_install(cfg!(debug_assertions), can_write, release.as_ref());
        let mut state = self.state();
        state.view.latest = release.as_ref().map(|release| release.view.clone());
        state.view.can_install = can_install;
        state.view.stage = if release.is_some() {
            UpdateStage::Available
        } else {
            UpdateStage::UpToDate
        };
        state.release = release;
        let view = state.view.clone();
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Update(view));
    }

    fn set_stage(&self, stage: UpdateStage) {
        let mut state = self.state();
        if state.view.stage == stage {
            return;
        }
        state.view.stage = stage;
        let view = state.view.clone();
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Update(view));
    }
}

/// Installing needs a release build (a dev build would be replaced by the release), a folder
/// ValoShell may write to, and a release that has both of its files.
fn can_install(is_dev_build: bool, can_write: bool, release: Option<&Release>) -> bool {
    !is_dev_build && can_write && release.is_some_and(Release::is_installable)
}

fn is_newer(release: &Release, current: &str) -> bool {
    parse_version(current).is_some_and(|current| release.version > current)
}

#[cfg(test)]
mod tests;
