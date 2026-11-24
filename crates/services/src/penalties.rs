//! Account restrictions (queue bans, queue delays, ranked and chat restrictions, warnings) so
//! the menu can say why queueing fails instead of only showing Riot's error.
//!
//! Riot's penalty entries are UNVERIFIED on 13.08: each carries one or more `*Effect` objects
//! whose fields vary. Entries are classified by the effects they carry; an entry with none the
//! menu knows still shows as a generic restriction.

use riot::api::pd::penalties::{Penalties, get_penalties};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::action::{ActionError, fetch_json};
use crate::ctx::Ctx;

/// Riot's "no date" placeholder.
const NO_DATE_PREFIX: &str = "0001-01-01";

/// What a restriction stops the player from doing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum PenaltyKind {
    /// No queueing at all (or in the listed queues).
    QueueBan,
    /// Queueing works, after a wait.
    QueueDelay,
    /// Ranked restricted or an RR penalty applied.
    Ranked,
    /// Text or voice chat muted.
    Chat,
    /// A behaviour warning, nothing blocked.
    Warning,
    /// A restriction the menu does not recognise.
    Other,
}

/// One active restriction.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct PenaltyView {
    pub kind: PenaltyKind,
    /// When it ends (ISO 8601), if Riot says.
    pub ends_at: Option<String>,
    /// Matches still to play before it lifts, if it counts matches.
    pub games_left: Option<u32>,
    /// The queues a queue ban covers; empty for all of them.
    pub queue_ids: Vec<String>,
}

/// Effect field names per kind, most limiting first.
const EFFECTS: [(PenaltyKind, &[&str]); 5] = [
    (
        PenaltyKind::QueueBan,
        &["GameBanEffect", "QueueRestrictionEffect"],
    ),
    (PenaltyKind::QueueDelay, &["QueueDelayEffect"]),
    (
        PenaltyKind::Ranked,
        &["RankedRatingPenaltyEffect", "RankedRestrictionEffect"],
    ),
    (
        PenaltyKind::Chat,
        &["TextChatMuteEffect", "VoiceChatMuteEffect"],
    ),
    (
        PenaltyKind::Warning,
        &["WarningEffect", "RMSNotificationEffect"],
    ),
];

/// The first kind whose effect the entry carries as an object (Riot also sends `null` ones).
fn kind_of(entry: &Value) -> PenaltyKind {
    EFFECTS
        .iter()
        .find(|(_, fields)| {
            fields
                .iter()
                .any(|field| entry.get(*field).is_some_and(Value::is_object))
        })
        .map_or(PenaltyKind::Other, |(kind, _)| *kind)
}

fn ends_at(entry: &Value) -> Option<String> {
    entry
        .get("Expiry")
        .and_then(Value::as_str)
        .filter(|date| !date.is_empty() && !date.starts_with(NO_DATE_PREFIX))
        .map(str::to_owned)
}

fn games_left(entry: &Value) -> Option<u32> {
    entry
        .get("GamesRemaining")
        .and_then(Value::as_u64)
        .filter(|games| *games > 0)
        .and_then(|games| u32::try_from(games).ok())
}

fn queue_ids(entry: &Value) -> Vec<String> {
    entry
        .pointer("/QueueRestrictionEffect/QueueIDs")
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

/// Every active restriction, most limiting first.
pub fn penalty_views(penalties: &Penalties) -> Vec<PenaltyView> {
    let mut views: Vec<PenaltyView> = penalties
        .penalties
        .iter()
        .filter(|entry| entry.is_object())
        .map(|entry| PenaltyView {
            kind: kind_of(entry),
            ends_at: ends_at(entry),
            games_left: games_left(entry),
            queue_ids: queue_ids(entry),
        })
        .collect();
    views.sort_by_key(|view| {
        EFFECTS
            .iter()
            .position(|(kind, _)| *kind == view.kind)
            .unwrap_or(EFFECTS.len())
    });
    views
}

/// The account's active restrictions, read fresh.
pub async fn read_penalties(ctx: &Ctx) -> Result<Vec<PenaltyView>, ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    let penalties: Penalties =
        fetch_json(&session, &get_penalties(), "read your restrictions").await?;
    Ok(penalty_views(&penalties))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn views(json: &str) -> Vec<PenaltyView> {
        let penalties: Penalties = serde_json::from_str(json).expect("decodes");
        penalty_views(&penalties)
    }

    #[test]
    fn a_clean_account_has_no_restrictions() {
        assert!(views(r#"{"Subject":"abc","Penalties":[],"Version":3}"#).is_empty());
        assert!(views(r#"{"Subject":"abc","Penalties":null}"#).is_empty());
    }

    #[test]
    fn a_queue_ban_reads_its_end_and_queues() {
        let found = views(
            r#"{"Penalties":[{"ID":"p1","Expiry":"2026-10-24T18:40:00Z","GamesRemaining":0,
                "QueueRestrictionEffect":{"QueueIDs":["competitive"]},"WarningEffect":null}]}"#,
        );

        assert_eq!(found[0].kind, PenaltyKind::QueueBan);
        assert_eq!(found[0].ends_at.as_deref(), Some("2026-10-24T18:40:00Z"));
        assert_eq!(found[0].games_left, None);
        assert_eq!(found[0].queue_ids, ["competitive"]);
    }

    #[test]
    fn null_effects_and_placeholder_dates_are_ignored() {
        let found = views(
            r#"{"Penalties":[{"Expiry":"0001-01-01T00:00:00Z","GamesRemaining":3,
                "GameBanEffect":null,"RankedRatingPenaltyEffect":{"RankedRatingPenalty":10}}]}"#,
        );

        assert_eq!(found[0].kind, PenaltyKind::Ranked);
        assert_eq!(found[0].ends_at, None);
        assert_eq!(found[0].games_left, Some(3));
    }

    #[test]
    fn unknown_effects_still_show_and_the_most_limiting_comes_first() {
        let found = views(
            r#"{"Penalties":[{"TextChatMuteEffect":{}},{"SomethingNewEffect":{}},{"QueueDelayEffect":{}}]}"#,
        );

        let kinds: Vec<PenaltyKind> = found.iter().map(|view| view.kind).collect();
        assert_eq!(
            kinds,
            [
                PenaltyKind::QueueDelay,
                PenaltyKind::Chat,
                PenaltyKind::Other
            ]
        );
    }
}
