use super::*;

fn temp_file(name: &str) -> PathBuf {
    let dir =
        std::env::temp_dir().join(format!("valoshell-settings-{}-{name}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("temp dir");
    dir.join("settings.json")
}

#[test]
fn missing_file_loads_defaults() {
    let store = SettingsStore::load(temp_file("missing"));
    assert_eq!(store.get(), Settings::default());
}

#[test]
fn partial_file_fills_missing_fields_with_defaults() {
    let path = temp_file("partial");
    std::fs::write(&path, r#"{"match_flow":{"should_hide_on_lock":false}}"#).expect("write");

    let settings = SettingsStore::load(path).get();

    assert!(!settings.match_flow.should_hide_on_lock);
    assert!(settings.match_flow.should_hide_on_match_start);
}

#[test]
fn unknown_fields_are_ignored() {
    let path = temp_file("unknown");
    std::fs::write(
        &path,
        r#"{"retired":{"x":1},"streamer":{"is_enabled":true}}"#,
    )
    .expect("write");

    let settings = SettingsStore::load(path).get();

    assert!(settings.streamer.is_enabled);
}

#[test]
fn corrupt_file_is_backed_up_and_defaults_are_used() {
    let path = temp_file("corrupt");
    std::fs::write(&path, "{not json").expect("write");

    let settings = SettingsStore::load(path.clone()).get();

    assert_eq!(settings, Settings::default());
    assert!(path.with_extension("json.corrupt").exists());
}

#[test]
fn update_persists_and_notifies_subscribers() {
    let path = temp_file("update");
    let store = SettingsStore::load(path.clone());
    let changes = store.subscribe();

    store
        .update(|settings| settings.streamer.is_enabled = true)
        .expect("writable");

    assert!(changes.has_changed().expect("sender alive"));
    assert!(SettingsStore::load(path).get().streamer.is_enabled);
}

#[test]
fn volume_is_clamped_and_never_left_unreadable() {
    let mut settings = Settings::default();
    settings.interface.ui_volume = 4.0;
    assert_eq!(settings.normalized().interface.ui_volume, 1.0);

    let mut settings = Settings::default();
    settings.interface.ui_volume = f64::NAN;
    assert_eq!(settings.normalized().interface.ui_volume, DEFAULT_UI_VOLUME);
}

#[test]
fn interface_size_stays_in_range() {
    let mut settings = Settings::default();
    settings.interface.ui_scale = 9.0;
    assert_eq!(settings.normalized().interface.ui_scale, MAX_UI_SCALE);

    let mut settings = Settings::default();
    settings.interface.ui_scale = 0.1;
    assert_eq!(settings.normalized().interface.ui_scale, MIN_UI_SCALE);

    for unreadable in [f64::INFINITY, f64::NAN] {
        let mut settings = Settings::default();
        settings.interface.ui_scale = unreadable;
        assert_eq!(settings.normalized().interface.ui_scale, DEFAULT_UI_SCALE);
    }
}

#[test]
fn an_unknown_choice_keeps_every_other_setting() {
    let file = r#"{"interface":{"ui_volume":0.3,"color_vision":"sepia","motion":"warp","effects":"ultra"}}"#;

    let settings: Settings = serde_json::from_str(file).unwrap();

    assert_eq!(settings.interface.ui_volume, 0.3);
    assert_eq!(settings.interface.color_vision, ColorVision::Default);
    assert_eq!(settings.interface.motion, MotionPreference::System);
    assert_eq!(settings.interface.effects, EffectsQuality::Auto);
}

#[test]
fn older_files_get_the_accessibility_defaults() {
    let settings: Settings = serde_json::from_str(r#"{"interface":{"ui_volume":0.3}}"#).unwrap();

    assert_eq!(settings.interface.ui_scale, DEFAULT_UI_SCALE);
    assert!(!settings.interface.is_high_contrast);
    assert_eq!(settings.interface.color_vision, ColorVision::Default);
}

#[test]
fn favourite_skins_are_lowercased_and_deduplicated() {
    let path = temp_file("favourites");
    std::fs::write(
        &path,
        r#"{"collection":{"favorite_skins":["ABC-1"," abc-1 ","","def-2"]}}"#,
    )
    .expect("write");

    let settings = SettingsStore::load(path).get();

    assert_eq!(settings.collection.favorite_skins, ["abc-1", "def-2"]);
}

#[test]
fn older_files_start_the_welcome_tour_from_the_beginning() {
    let settings: Settings =
        serde_json::from_str(r#"{"updates":{"should_check_for_updates":false}}"#)
            .expect("an older file still loads");

    assert_eq!(settings.onboarding.completed_version, 0);
    assert!(!settings.updates.should_check_for_updates);
}
