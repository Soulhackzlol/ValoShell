//! The chat as the menu shows it: messages in time order, named only from the rosters.
//! Riot's own system lines are text it writes ("X joined"), which may hold a Riot ID: they are
//! dropped from the team chat, where allies may hide their name, and blurred by the UI.

use std::collections::HashMap;

use domain::ids::Puuid;
use riot::api::local::chat::ChatMessage;
use serde::Serialize;
use ts_rs::TS;

use super::direct::DirectChatView;
use crate::party::PartyView;
use crate::pregame::PregameView;

/// The newest messages kept per conversation.
const MESSAGES_KEPT: usize = 50;
/// Riot's kind for messages the chat service writes itself.
const SYSTEM_KIND: &str = "system";

/// One line of chat.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ChatMessageView {
    pub id: String,
    /// As the lineup or roster shows them; empty when they hide their name or are unknown.
    pub author: String,
    /// Their agent in agent select, the fallback when the name is hidden.
    pub author_agent: Option<String>,
    pub is_self: bool,
    /// Written by Riot's chat service (joins, leaves...).
    pub is_system: bool,
    pub body: String,
    /// Epoch ms; 0 when Riot did not say.
    #[ts(type = "number")]
    pub sent_at_ms: i64,
}

/// Every chat the dock shows.
#[derive(Debug, Clone, Default, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ChatView {
    pub party: Vec<ChatMessageView>,
    pub team: Vec<ChatMessageView>,
    /// Whispers with friends, the latest conversation first.
    pub direct: Vec<DirectChatView>,
    /// A conversation exists to send to.
    pub is_party_open: bool,
    pub is_team_open: bool,
}

/// Who may be named, and as what.
#[derive(Debug, Clone, Default)]
pub struct Roster {
    names: HashMap<Puuid, String>,
    agents: HashMap<Puuid, String>,
}

impl Roster {
    /// From the party lineup and the agent-select allies, as the menu already shows them.
    pub fn from_views(party: Option<&PartyView>, pregame: Option<&PregameView>) -> Self {
        let mut roster = Self::default();
        for member in party.iter().flat_map(|party| &party.members) {
            roster.add(&member.puuid, &member.game_name, None);
        }
        for ally in pregame.iter().flat_map(|pregame| &pregame.allies) {
            roster.add(&ally.puuid, &ally.game_name, ally.agent_name.as_deref());
        }
        roster
    }

    pub fn add(&mut self, puuid: &str, name: &str, agent: Option<&str>) {
        let puuid = Puuid::new(puuid);
        if !name.is_empty() {
            self.names.insert(puuid.clone(), name.to_owned());
        }
        if let Some(agent) = agent.filter(|agent| !agent.is_empty()) {
            self.agents.insert(puuid, agent.to_owned());
        }
    }
}

fn message_view(roster: &Roster, own: &Puuid, message: &ChatMessage) -> ChatMessageView {
    let is_system = message.kind.eq_ignore_ascii_case(SYSTEM_KIND);
    let author = message.puuid.as_ref().filter(|_| !is_system);
    ChatMessageView {
        id: message.id.clone(),
        author: author
            .and_then(|puuid| roster.names.get(puuid))
            .cloned()
            .unwrap_or_default(),
        author_agent: author.and_then(|puuid| roster.agents.get(puuid)).cloned(),
        is_self: author == Some(own),
        is_system,
        body: message.body.clone(),
        sent_at_ms: message.sent_at_millis().unwrap_or(0),
    }
}

/// The newest messages, oldest first.
pub(super) fn conversation(
    roster: &Roster,
    own: &Puuid,
    messages: &[ChatMessage],
    should_keep_system: bool,
) -> Vec<ChatMessageView> {
    let mut views: Vec<ChatMessageView> = messages
        .iter()
        .filter(|message| !message.body.trim().is_empty())
        .map(|message| message_view(roster, own, message))
        .filter(|view| should_keep_system || !view.is_system)
        .collect();
    views.sort_by_key(|view| view.sent_at_ms);
    let start = views.len().saturating_sub(MESSAGES_KEPT);
    views.split_off(start)
}

/// The party and team chats; whispers and whether each is open are set by the caller.
pub fn chat_view(
    roster: &Roster,
    own: &Puuid,
    party: &[ChatMessage],
    team: &[ChatMessage],
) -> ChatView {
    ChatView {
        party: conversation(roster, own, party, true),
        team: conversation(roster, own, team, false),
        ..ChatView::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: &str, puuid: &str, time: &str, body: &str) -> ChatMessage {
        ChatMessage {
            id: id.to_owned(),
            puuid: Some(Puuid::new(puuid)),
            time: time.to_owned(),
            body: body.to_owned(),
            game_name: "LeakedName".to_owned(),
            game_tag: "0000".to_owned(),
            kind: "groupchat".to_owned(),
            ..ChatMessage::default()
        }
    }

    fn roster() -> Roster {
        let mut roster = Roster::default();
        roster.add("me", "Me", Some("Jett"));
        roster.add("friend", "Friend", None);
        roster.add("hidden", "", Some("Sova"));
        roster
    }

    #[test]
    fn authors_are_named_only_from_the_roster() {
        let messages = [
            message("1", "friend", "100", "hi"),
            message("2", "hidden", "200", "gl"),
            message("3", "stranger", "300", "hey"),
        ];

        let view = chat_view(&roster(), &Puuid::new("me"), &messages, &[]);

        let authors: Vec<&str> = view.party.iter().map(|line| line.author.as_str()).collect();
        assert_eq!(
            authors,
            ["Friend", "", ""],
            "the chat's own names are never used"
        );
        assert_eq!(view.party[1].author_agent.as_deref(), Some("Sova"));
    }

    #[test]
    fn messages_come_oldest_first_and_mark_the_player() {
        let messages = [
            message("b", "me", "200", "second"),
            message("a", "friend", "100", "first"),
        ];

        let view = chat_view(&roster(), &Puuid::new("me"), &messages, &[]);

        assert_eq!(view.party[0].body, "first");
        assert!(view.party[1].is_self);
        assert_eq!(view.party[1].sent_at_ms, 200);
    }

    #[test]
    fn only_the_newest_messages_are_kept_and_blank_ones_dropped() {
        let mut messages: Vec<ChatMessage> = (0..60)
            .map(|n| message(&n.to_string(), "friend", &n.to_string(), "x"))
            .collect();
        messages.push(message("blank", "friend", "999", "   "));

        let view = chat_view(&roster(), &Puuid::new("me"), &[], &messages);

        assert_eq!(view.team.len(), MESSAGES_KEPT);
        assert_eq!(view.team[0].id, "10");
    }

    #[test]
    fn system_messages_have_no_author() {
        let mut system = message("s", "friend", "1", "Friend joined");
        system.kind = "system".to_owned();

        let view = chat_view(&roster(), &Puuid::new("me"), &[system], &[]);

        assert!(view.party[0].is_system);
        assert_eq!(view.party[0].author, "");
        assert!(!view.party[0].is_self);
    }

    #[test]
    fn the_team_chat_drops_system_lines() {
        let mut system = message("s", "hidden", "1", "HiddenName#TAG joined");
        system.kind = "system".to_owned();

        let view = chat_view(&roster(), &Puuid::new("me"), &[], &[system]);

        assert!(view.team.is_empty());
    }
}
