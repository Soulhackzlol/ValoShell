// The demo backend's settings: the defaults a fresh preview starts with, and how saved ones are
// read back. Kept apart from demo.ts so the merge can be tested on its own.
import type { Settings } from "~/bindings/Settings";

/** Matches the Rust defaults (crates/store/src/settings.rs). */
export function defaultSettings(): Settings {
  return {
    region: "eu",
    match_flow: {
      should_hide_on_lock: true,
      should_hide_on_match_start: true,
      should_return_in_menus: true,
      should_minimize_game_in_menus: false,
    },
    interface: {
      theme: "valorant-dark",
      ui_volume: 0.6,
      motion: "system",
      effects: "auto",
      backdrop: "default",
      ui_scale: 1,
      is_high_contrast: false,
      color_vision: "default",
    },
    streamer: { is_enabled: false, should_hide_own_name: true },
    collection: { favorite_skins: [], wishlist_skins: [] },
    updates: { should_check_for_updates: true },
    onboarding: { completed_version: 0 },
  };
}

/**
 * Saved settings over the defaults, section by section, like the backend's `serde(default)`:
 * settings saved by an older demo gain both newer sections and newer fields inside a section.
 */
export function withDefaults(saved: Partial<Settings>): Settings {
  const merged: Record<string, unknown> = { ...defaultSettings() };
  for (const [key, value] of Object.entries(saved)) {
    const base = merged[key];
    const isSection = typeof base === "object" && base !== null && !Array.isArray(base);
    merged[key] = isSection ? { ...base, ...(value as object) } : value;
  }
  // Every key of Settings is present (the defaults supply what the saved copy lacks).
  return merged as unknown as Settings;
}
