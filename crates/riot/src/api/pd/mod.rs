//! Endpoints on the pd host (player data): names, MMR, history, loadout, store, contracts.
//! Purchase, order and gift endpoints are deliberately absent.

pub mod account;
pub mod bloomline;
pub mod bundle;
pub mod career;
pub mod contracts;
pub mod daily_ticket;
pub mod entitlements;
pub mod favorites;
pub mod history;
pub mod leaderboard;
pub mod loadout;
pub mod mmr;
pub mod names;
pub mod offer;
pub mod penalties;
pub mod premier;
pub mod store;
pub mod wallet;

/// Riot sends explicit `null` for empty collections; `#[serde(default)]` alone rejects those.
pub(crate) use crate::api::codec::null_as_default;

#[cfg(test)]
mod tests {
    use serde::Deserialize;
    use std::collections::HashMap;

    #[derive(Debug, Default, Deserialize)]
    #[serde(default)]
    struct Probe {
        #[serde(deserialize_with = "super::null_as_default")]
        values: HashMap<String, u32>,
    }

    #[test]
    fn null_as_default_turns_null_into_empty_collection() {
        let probe: Probe = serde_json::from_str(r#"{"values": null}"#).expect("decodes");
        assert!(probe.values.is_empty());
    }

    #[test]
    fn null_as_default_keeps_present_values() {
        let probe: Probe = serde_json::from_str(r#"{"values": {"a": 1}}"#).expect("decodes");
        assert_eq!(probe.values.get("a"), Some(&1));
    }
}
