//! Chat conversations, messages and participants. Chat v6 is what the VALORANT
//! UI uses. Never forge `type: "system"` messages.

use domain::ids::Puuid;
use serde::Deserialize;
use serde_json::json;

use super::with_query;
use crate::http::{Host, Request};

/// `GET /chat/v6/conversations`: all conversations, or one by `cid`.
pub fn get_conversations(cid: Option<&str>) -> Request {
    let path = with_query("/chat/v6/conversations", &[("cid", cid)]);
    Request::get(Host::Local, path)
}

/// `GET /chat/v6/conversations/ares-parties`: the party chat.
pub fn get_party_conversation() -> Request {
    Request::get(Host::Local, "/chat/v6/conversations/ares-parties")
}

/// `GET /chat/v6/conversations/ares-pregame`: the agent-select team chat.
pub fn get_pregame_conversation() -> Request {
    Request::get(Host::Local, "/chat/v6/conversations/ares-pregame")
}

/// `GET /chat/v6/conversations/ares-coregame`: in-match team and all chat (two entries).
pub fn get_coregame_conversation() -> Request {
    Request::get(Host::Local, "/chat/v6/conversations/ares-coregame")
}

/// `GET /chat/v6/messages?cid=`: history of one conversation.
pub fn get_messages(cid: &str) -> Request {
    let path = with_query("/chat/v6/messages", &[("cid", Some(cid))]);
    Request::get(Host::Local, path)
}

/// `GET /chat/v5/participants?cid=`: who is in a conversation.
pub fn get_participants(cid: &str) -> Request {
    let path = with_query("/chat/v5/participants", &[("cid", Some(cid))]);
    Request::get(Host::Local, path)
}

/// Kind of a sent message.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageKind {
    /// Party, team or all chat.
    GroupChat,
    /// Whisper: the `cid` is the friend's `pid` (`<puuid>@<chat server>`). Verified on a live
    /// client (2026-10-24): the conversation it creates has that id and type `chat`.
    Whisper,
}

impl MessageKind {
    fn wire_name(self) -> &'static str {
        match self {
            Self::GroupChat => "groupchat",
            Self::Whisper => "chat",
        }
    }
}

/// `POST /chat/v6/messages`: sends `text` as regular user chat.
pub fn send_message(cid: &str, text: &str, kind: MessageKind) -> Request {
    Request::post(Host::Local, "/chat/v6/messages")
        .json(json!({ "cid": cid, "message": text, "type": kind.wire_name() }))
}

/// Chat UI visibility flags of a conversation.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct UiState {
    #[serde(rename = "changedSinceHidden")]
    pub changed_since_hidden: bool,
    pub hidden: bool,
}

/// One conversation; `kind` is `groupchat|chat|dm|system`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct Conversation {
    pub cid: String,
    pub direct_messages: bool,
    pub global_readership: bool,
    pub message_history: bool,
    pub mid: String,
    pub muted: bool,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "uiState")]
    pub ui_state: UiState,
    pub unread_count: u32,
}

/// Body of the conversation endpoints.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ConversationsResponse {
    pub conversations: Vec<Conversation>,
}

/// One chat message.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ChatMessage {
    pub body: String,
    pub cid: String,
    pub game_name: String,
    pub game_tag: String,
    pub id: String,
    pub mid: String,
    pub name: String,
    pub pid: String,
    pub puuid: Option<Puuid>,
    pub read: bool,
    pub region: String,
    /// Milliseconds since the epoch, as a string.
    pub time: String,
    #[serde(rename = "type")]
    pub kind: String,
}

impl ChatMessage {
    /// Send time in epoch milliseconds, when the string parses.
    pub fn sent_at_millis(&self) -> Option<i64> {
        self.time.parse().ok()
    }
}

/// Body of `GET`/`POST /chat/v6/messages`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct MessagesResponse {
    pub messages: Vec<ChatMessage>,
}

/// One member of a conversation.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct Participant {
    #[serde(rename = "activePlatform")]
    pub active_platform: Option<String>,
    pub cid: String,
    pub game_name: String,
    pub game_tag: String,
    pub muted: bool,
    pub name: String,
    pub pid: String,
    pub puuid: Option<Puuid>,
    pub region: String,
}

/// Body of `GET /chat/v5/participants`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ParticipantsResponse {
    pub participants: Vec<Participant>,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn conversation_builders_use_v6_paths() {
        let cases = [
            (get_conversations(None), "/chat/v6/conversations"),
            (
                get_party_conversation(),
                "/chat/v6/conversations/ares-parties",
            ),
            (
                get_pregame_conversation(),
                "/chat/v6/conversations/ares-pregame",
            ),
            (
                get_coregame_conversation(),
                "/chat/v6/conversations/ares-coregame",
            ),
        ];

        for (request, path) in cases {
            assert_eq!(request.host, Host::Local);
            assert_eq!(request.method, reqwest::Method::GET);
            assert_eq!(request.path, path);
            assert_eq!(request.body, None);
        }
    }

    #[test]
    fn cid_filters_are_percent_encoded() {
        let conversation = get_conversations(Some("a@ares-parties.eu1.pvp.net"));
        let messages = get_messages("a@b");
        let participants = get_participants("a@b");

        assert_eq!(
            conversation.path,
            "/chat/v6/conversations?cid=a%40ares-parties.eu1.pvp.net"
        );
        assert_eq!(messages.path, "/chat/v6/messages?cid=a%40b");
        assert_eq!(participants.path, "/chat/v5/participants?cid=a%40b");
    }

    #[test]
    fn party_message_is_a_groupchat_post() {
        let request = send_message("cid-1", "gl hf", MessageKind::GroupChat);

        assert_eq!(request.method, reqwest::Method::POST);
        assert_eq!(request.path, "/chat/v6/messages");
        let body = json!({ "cid": "cid-1", "message": "gl hf", "type": "groupchat" });
        assert_eq!(request.body, Some(body));
    }

    #[test]
    fn whisper_uses_chat_type() {
        let request = send_message("pid-1", "hi", MessageKind::Whisper);

        assert_eq!(request.body.expect("body")["type"], "chat");
    }

    #[test]
    fn conversations_decode() {
        let json = r#"{"conversations":[{"cid":"c@ares-parties.eu1.pvp.net","direct_messages":false,
            "global_readership":false,"message_history":true,"mid":"m","muted":false,
            "mutedRestriction":false,"type":"groupchat",
            "uiState":{"changedSinceHidden":true,"hidden":false},"unread_count":3}]}"#;

        let response: ConversationsResponse = serde_json::from_str(json).expect("decodes");

        let conversation = &response.conversations[0];
        assert_eq!(conversation.kind, "groupchat");
        assert_eq!(conversation.unread_count, 3);
        assert!(conversation.ui_state.changed_since_hidden);
        assert!(conversation.message_history);
    }

    #[test]
    fn messages_decode_with_string_time() {
        let json = r#"{"messages":[{"body":"hello","cid":"c","game_name":"A","game_tag":"B",
            "id":"1","mid":"m","name":"A","pid":"p","puuid":"X-1","read":false,"region":"eu1",
            "time":"1700000000123","type":"groupchat","droppedDueToThrottle":false}]}"#;

        let response: MessagesResponse = serde_json::from_str(json).expect("decodes");

        let message = &response.messages[0];
        assert_eq!(message.body, "hello");
        assert_eq!(message.sent_at_millis(), Some(1_700_000_000_123));
        assert_eq!(message.kind, "groupchat");
    }

    #[test]
    fn unparsable_message_time_is_none() {
        assert_eq!(ChatMessage::default().sent_at_millis(), None);
    }

    #[test]
    fn participants_decode() {
        let json = r#"{"participants":[{"activePlatform":"windows","cid":"c","game_name":"A",
            "game_tag":"B","muted":true,"name":"A","pid":"p","puuid":"u","region":"eu1"}]}"#;

        let response: ParticipantsResponse = serde_json::from_str(json).expect("decodes");

        assert!(response.participants[0].muted);
        assert_eq!(
            response.participants[0].active_platform.as_deref(),
            Some("windows")
        );
    }
}
