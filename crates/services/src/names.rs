//! Riot ID lookups shared by every service that shows players (party, agent select).
//! Names are cached for the app's lifetime; the name service is only asked about new puuids.
//! A cached name is not a licence to show it: `shown_name` applies the client's rule for
//! players who hide theirs.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, PoisonError};

use domain::ids::Puuid;
use riot::api::pd::names::{PlayerName, put_names};
use riot::session::RiotSession;

/// `Name#Tag` split for one puuid.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RiotName {
    pub game_name: String,
    pub tag_line: String,
}

/// Cheap to clone.
#[derive(Clone, Default)]
pub struct NameBook {
    names: Arc<Mutex<HashMap<Puuid, RiotName>>>,
    /// The current party, kept by the party service: the players who see hidden names.
    party: Arc<Mutex<HashSet<Puuid>>>,
}

impl NameBook {
    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<Puuid, RiotName>> {
        self.names.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Copy of every known name (views are built from a snapshot).
    pub fn snapshot(&self) -> HashMap<Puuid, RiotName> {
        self.lock().clone()
    }

    /// The players in the player's party now (empty outside one).
    pub fn party(&self) -> HashSet<Puuid> {
        self.party
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    pub fn set_party(&self, members: impl IntoIterator<Item = Puuid>) {
        *self.party.lock().unwrap_or_else(PoisonError::into_inner) = members.into_iter().collect();
    }

    /// Learn the names of `puuids` not seen yet. The own name comes from the session; a failed
    /// lookup is retried next time (names are cosmetic, never block a view).
    pub async fn learn(&self, session: &RiotSession, puuids: impl IntoIterator<Item = Puuid>) {
        let unknown: Vec<Puuid> = {
            let mut names = self.lock();
            if let Some(riot_id) = &session.riot_id {
                names.insert(session.puuid.clone(), split_riot_id(riot_id));
            }
            let mut unknown: Vec<Puuid> = puuids
                .into_iter()
                .filter(|puuid| !names.contains_key(puuid))
                .collect();
            unknown.sort();
            unknown.dedup();
            unknown
        };
        if unknown.is_empty() {
            return;
        }
        match session
            .http
            .send_json::<Vec<PlayerName>>(&put_names(&unknown))
            .await
        {
            Ok(answers) => self.insert_answers(answers),
            Err(error) => tracing::debug!(%error, "name_lookup_failed"),
        }
    }

    fn insert_answers(&self, answers: Vec<PlayerName>) {
        let mut names = self.lock();
        for answer in answers {
            if let Some(subject) = answer.subject {
                let name = RiotName {
                    game_name: answer.game_name,
                    tag_line: answer.tag_line,
                };
                names.insert(subject, name);
            }
        }
    }
}

/// The name a lineup may show. A player who hides their name shows only to their own party,
/// as in the client, so a name cached from an earlier match never unmasks them later.
pub fn shown_name(
    names: &HashMap<Puuid, RiotName>,
    puuid: &Puuid,
    is_incognito: bool,
    party: &HashSet<Puuid>,
) -> RiotName {
    if is_incognito && !party.contains(puuid) {
        return RiotName::default();
    }
    names.get(puuid).cloned().unwrap_or_default()
}

/// `Name#Tag` into its parts; a missing tag leaves `tag_line` empty.
pub fn split_riot_id(riot_id: &str) -> RiotName {
    let (game_name, tag_line) = riot_id.rsplit_once('#').unwrap_or((riot_id, ""));
    RiotName {
        game_name: game_name.to_owned(),
        tag_line: tag_line.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn known(puuid: &str) -> HashMap<Puuid, RiotName> {
        HashMap::from([(Puuid::new(puuid), split_riot_id("Ace#1"))])
    }

    #[test]
    fn a_hidden_name_stays_hidden_even_when_cached() {
        let name = shown_name(&known("a"), &Puuid::new("a"), true, &HashSet::new());

        assert_eq!(name, RiotName::default());
    }

    #[test]
    fn a_hidden_name_still_shows_to_the_party() {
        let party = HashSet::from([Puuid::new("a")]);

        let name = shown_name(&known("a"), &Puuid::new("a"), true, &party);

        assert_eq!(name.game_name, "Ace");
    }

    #[test]
    fn riot_id_splits_on_the_last_hash() {
        let name = split_riot_id("Mr #1#EUW");

        assert_eq!(name.game_name, "Mr #1");
        assert_eq!(name.tag_line, "EUW");
        assert_eq!(split_riot_id("Solo").tag_line, "");
    }

    #[test]
    fn answers_are_keyed_by_subject_and_unnamed_rows_are_dropped() {
        let book = NameBook::default();
        let answers = vec![
            PlayerName {
                subject: Some(Puuid::new("A")),
                game_name: "Ace".into(),
                tag_line: "1".into(),
                ..PlayerName::default()
            },
            PlayerName::default(),
        ];

        book.insert_answers(answers);

        let names = book.snapshot();
        assert_eq!(names.len(), 1);
        assert_eq!(names[&Puuid::new("a")].game_name, "Ace");
    }
}
