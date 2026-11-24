//! Real windows for the match flow: the menu (a Tauri window) and the game window, found by
//! its process image name so other Unreal games can never be mistaken for VALORANT.

use std::sync::atomic::{AtomicBool, Ordering};

use services::match_flow::WindowPort;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

use crate::MAIN_WINDOW;

pub struct AppWindows {
    app: AppHandle,
}

impl AppWindows {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn menu(&self) -> Option<tauri::WebviewWindow> {
        self.app.get_webview_window(MAIN_WINDOW)
    }
}

/// Styles drawn as a desktop client (League) use a client-sized window; the rest cover the
/// screen. Set by the UI when the style changes (`set_window_mode`).
static IS_WINDOWED: AtomicBool = AtomicBool::new(false);

/// The League client's window sizes (logical px), the larger one on screens wide enough.
const SMALL_CLIENT: (f64, f64) = (1280.0, 720.0);
const LARGE_CLIENT: (f64, f64) = (1600.0, 900.0);
const LARGE_FROM_WIDTH: f64 = 1800.0;

/// Switch between fullscreen and the client-sized window, then place the menu again.
pub fn set_windowed(window: &tauri::WebviewWindow, is_windowed: bool) {
    IS_WINDOWED.store(is_windowed, Ordering::Relaxed);
    place_menu(window);
}

/// Put the menu on the monitor VALORANT runs on, else the main monitor: fullscreen, or (for a
/// client-styled menu) centred at the client's size. It is never dragged or resized by hand.
pub fn place_menu(window: &tauri::WebviewWindow) {
    let monitor = game::center()
        .and_then(|(x, y)| monitor_at(window, x, y))
        .or_else(|| window.primary_monitor().ok().flatten());
    let Some(monitor) = monitor else {
        tracing::warn!("menu_monitor_not_found");
        return;
    };
    if is_fullscreen_on(window, &monitor) {
        return;
    }
    // Leaving fullscreen first: a fullscreen window can't be moved or sized.
    let placed = if IS_WINDOWED.load(Ordering::Relaxed) {
        let (position, size) = client_rect(&monitor);
        window
            .set_fullscreen(false)
            .and_then(|()| window.set_size(size))
            .and_then(|()| window.set_position(position))
    } else {
        window
            .set_fullscreen(false)
            .and_then(|()| window.set_position(*monitor.position()))
            .and_then(|()| window.set_fullscreen(true))
    };
    if let Err(error) = placed {
        tracing::warn!(%error, "place_menu_failed");
    }
}

/// Whether the fullscreen menu already covers `monitor`: placing it again would leave and
/// re-enter fullscreen, a visible flicker every time a match ends.
fn is_fullscreen_on(window: &tauri::WebviewWindow, monitor: &tauri::Monitor) -> bool {
    if IS_WINDOWED.load(Ordering::Relaxed) || !window.is_fullscreen().unwrap_or(false) {
        return false;
    }
    let current = window.current_monitor().ok().flatten();
    current.is_some_and(|current| current.position() == monitor.position())
}

/// The client-sized window centred on `monitor`, in physical pixels.
fn client_rect(monitor: &tauri::Monitor) -> (PhysicalPosition<i32>, PhysicalSize<u32>) {
    let scale = monitor.scale_factor();
    let screen = monitor.size();
    let (logical_width, logical_height) = if f64::from(screen.width) / scale >= LARGE_FROM_WIDTH {
        LARGE_CLIENT
    } else {
        SMALL_CLIENT
    };
    // Rounded screen pixels; a window never exceeds its monitor.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let size = PhysicalSize::new(
        ((logical_width * scale).round() as u32).min(screen.width),
        ((logical_height * scale).round() as u32).min(screen.height),
    );
    let origin = monitor.position();
    let offset = |free: u32| i32::try_from(free / 2).unwrap_or(0);
    let position = PhysicalPosition::new(
        origin.x + offset(screen.width - size.width),
        origin.y + offset(screen.height - size.height),
    );
    (position, size)
}

/// The monitor holding a point in physical screen pixels.
fn monitor_at(window: &tauri::WebviewWindow, x: i32, y: i32) -> Option<tauri::Monitor> {
    let monitors = window.available_monitors().ok()?;
    monitors.into_iter().find(|monitor| {
        let (origin, size) = (monitor.position(), monitor.size());
        let width = i32::try_from(size.width).unwrap_or(i32::MAX);
        let height = i32::try_from(size.height).unwrap_or(i32::MAX);
        (origin.x..origin.x.saturating_add(width)).contains(&x)
            && (origin.y..origin.y.saturating_add(height)).contains(&y)
    })
}

impl WindowPort for AppWindows {
    fn show_menu(&self) {
        if let Some(window) = self.menu() {
            place_menu(&window);
            if let Err(error) = window.show().and_then(|()| window.set_focus()) {
                tracing::warn!(%error, "show_menu_failed");
            }
        }
        crate::overlay::set_in_match(&self.app, false);
    }

    fn hide_menu(&self) {
        if let Some(window) = self.menu()
            && let Err(error) = window.hide()
        {
            tracing::warn!(%error, "hide_menu_failed");
        }
        crate::overlay::set_in_match(&self.app, true);
    }

    fn focus_game(&self) {
        game::focus();
    }

    fn minimize_game(&self) {
        game::minimize();
    }
}

#[cfg(not(windows))]
mod game {
    /// VALORANT only runs on Windows; elsewhere (development builds) there is nothing to focus.
    pub fn focus() {
        tracing::debug!("game_window_not_supported_on_this_os");
    }

    pub fn minimize() {}

    pub fn center() -> Option<(i32, i32)> {
        None
    }
}

#[cfg(windows)]
mod game {
    // Win32 calls are FFI and need `unsafe`; each block is a single documented API call.
    #![allow(unsafe_code)]

    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        QueryFullProcessImageNameW,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        SW_MINIMIZE, SW_RESTORE, SetForegroundWindow, ShowWindow,
    };
    use windows::core::{BOOL, PWSTR};

    const GAME_EXECUTABLE: &str = "valorant-win64-shipping.exe";

    pub fn focus() {
        let Some(game) = find_game_window() else {
            tracing::debug!("game_window_not_found");
            return;
        };
        // SAFETY: `game` is a live top-level window handle returned by EnumWindows.
        unsafe {
            if IsIconic(game).as_bool() {
                let _ = ShowWindow(game, SW_RESTORE);
            }
            // Allowed: we hide our own foreground window first, so Windows lets us hand focus on.
            let _ = SetForegroundWindow(game);
        }
    }

    pub fn minimize() {
        if let Some(game) = find_game_window() {
            // SAFETY: as above.
            let _ = unsafe { ShowWindow(game, SW_MINIMIZE) };
        }
    }

    /// The centre of the game window in physical screen pixels, while the game is open.
    pub fn center() -> Option<(i32, i32)> {
        let game = find_game_window()?;
        let mut rect = RECT::default();
        // SAFETY: writes the window's screen rectangle into a local.
        unsafe { GetWindowRect(game, &raw mut rect) }.ok()?;
        Some(((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2))
    }

    /// The first visible top-level window owned by the VALORANT game process.
    fn find_game_window() -> Option<HWND> {
        let mut found = HWND::default();
        // SAFETY: the callback only writes through the pointer we pass, which outlives the call.
        let _ = unsafe { EnumWindows(Some(visit_window), LPARAM(&raw mut found as isize)) };
        (!found.is_invalid()).then_some(found)
    }

    unsafe extern "system" fn visit_window(window: HWND, found: LPARAM) -> BOOL {
        // SAFETY: plain queries on a handle EnumWindows just gave us.
        let is_visible = unsafe { IsWindowVisible(window) }.as_bool();
        if is_visible && is_game_process(window) {
            // SAFETY: `found` is the `&mut HWND` passed by `find_game_window`.
            unsafe { *(found.0 as *mut HWND) = window };
            return BOOL(0);
        }
        BOOL(1)
    }

    fn is_game_process(window: HWND) -> bool {
        let mut process_id = 0u32;
        // SAFETY: writes the owning process id into a local.
        unsafe { GetWindowThreadProcessId(window, Some(&raw mut process_id)) };
        // SAFETY: limited query rights; the handle is closed below.
        let Ok(process) =
            (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) })
        else {
            return false;
        };
        let mut buffer = [0u16; 512];
        let mut length = buffer.len() as u32;
        // SAFETY: buffer and length describe the same local array.
        let is_read = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &raw mut length,
            )
        }
        .is_ok();
        // SAFETY: closing the handle we opened.
        let _ = unsafe { CloseHandle(process) };
        let path = String::from_utf16_lossy(&buffer[..length as usize]).to_lowercase();
        is_read && path.ends_with(GAME_EXECUTABLE)
    }
}
