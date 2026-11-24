//! Tray icon and global hotkeys: the ways back to a hidden menu.
//!
//! Ctrl+Alt+V shows/hides the menu (the match flow then leaves it alone for a while);
//! Ctrl+Alt+O toggles the in-game overlay preview.

use services::Ctx;
use services::match_flow::FlowSignal;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent, ShortcutState,
};

use crate::MAIN_WINDOW;

const MENU_ITEM_SHOW: &str = "show";
const MENU_ITEM_OVERLAY: &str = "overlay";
const MENU_ITEM_QUIT: &str = "quit";

fn menu_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyV)
}

fn overlay_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyO)
}

/// Register both hotkeys; a hotkey another app owns is logged, not fatal.
pub fn register_hotkeys(app: &AppHandle) {
    for shortcut in [menu_shortcut(), overlay_shortcut()] {
        if let Err(error) = app.global_shortcut().register(shortcut) {
            tracing::warn!(%error, "hotkey_register_failed");
        }
    }
}

/// Plugin handler for every hotkey press.
pub fn on_hotkey(app: &AppHandle, shortcut: &Shortcut, event: ShortcutEvent) {
    if event.state() != ShortcutState::Pressed {
        return;
    }
    if *shortcut == menu_shortcut() {
        toggle_menu(app);
    } else if *shortcut == overlay_shortcut() {
        crate::overlay::toggle_preview(app);
    }
}

/// Show or hide the menu by hand and tell the match flow.
pub fn toggle_menu(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let is_visible = window.is_visible().unwrap_or(false);
    let result = if is_visible {
        window.hide()
    } else {
        crate::game_window::place_menu(&window);
        window.show().and_then(|()| window.set_focus())
    };
    if let Err(error) = result {
        tracing::warn!(%error, "toggle_menu_failed");
    }
    if let Some(ctx) = app.try_state::<Ctx>() {
        ctx.signal_flow(FlowSignal::ManualToggle {
            is_visible: !is_visible,
        });
    }
}

/// Tray icon with Show / Overlay / Quit.
pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(
        app,
        MENU_ITEM_SHOW,
        "Show ValoShell",
        true,
        Some("Ctrl+Alt+V"),
    )?;
    let overlay = MenuItem::with_id(
        app,
        MENU_ITEM_OVERLAY,
        "Toggle overlay",
        true,
        Some("Ctrl+Alt+O"),
    )?;
    let quit = MenuItem::with_id(app, MENU_ITEM_QUIT, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &overlay, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("ValoShell")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_ITEM_SHOW => crate::focus_main_window(app),
            MENU_ITEM_OVERLAY => crate::overlay::toggle_preview(app),
            MENU_ITEM_QUIT => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
