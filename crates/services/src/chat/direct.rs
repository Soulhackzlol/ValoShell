//! Whispers: one-to-one chat with friends. A thread is shown only when the other side is on the
//! friend list, and is named as the friend list names them, so a whisper never tells more than
//! the friends list already does. Riot routes a whisper to the friend's `pid`, which is also the
//! id of the conversation it creates.

use std::collections::HashMap;

use domain::ids::Puuid;
use riot::api::local::chat::{ChatMessage, Conversation};
use riot::api::local::friends::Friend;
use serde::Serialize;
use ts_rs::TS;

use super::view::{ChatMessageView, Roster, conversation};
use crate::action::ActionError;

/// Most whisper threads read per refresh; each is one call to the local Riot Client.
pub(super) const MAX_DIRECT_THREADS: usize = 12;

/// Riot's conversation kinds for one-to-one chat (`chat` on current builds, `dm` on older ones).
const DIRECT_KINDS: [&str; 2] = ["chat", "dm"];

/// One whisper thread with a friend.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct DirectChatView {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    /// Oldest first, like the party chat.
    pub messages: Vec<ChatMessageView>,
}

/// A friend as whispers need them: their name and the id Riot routes whispers to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct Contact {
    pub puuid: Puuid,
    pub game_name: String,
    pub tag_line: String,
    pub pid: String,
}

/// A whisper conversation to read, and the friend it is with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct DirectThread {
    pub cid: String,
    /// Id of its newest message; unchanged means its history need not be read again.
    pub mid: String,
    pub contact: Contact,
}

/// A whisper history as last read, kept so an unchanged thread costs no call.
#[derive(Debug, Clone, Default)]
pub(super) struct CachedThread {
    pub mid: String,
    pub messages: Vec<ChatMessage>,
}

impl CachedThread {
    fn newest_at(&self) -> i64 {
        self.messages
            .iter()
            .filter_map(ChatMessage::sent_at_millis)
            .max()
            .unwrap_or(0)
    }
}

/// Whisper histories by conversation id.
pub(super) type ThreadCache = HashMap<String, CachedThread>;

/// The cached history of `thread`, when Riot says nothing new arrived since it was read.
pub(super) fn unchanged<'a>(
    cache: &'a ThreadCache,
    thread: &DirectThread,
) -> Option<&'a [ChatMessage]> {
    let cached = cache.get(&thread.cid)?;
    let is_same = !thread.mid.is_empty() && cached.mid == thread.mid;
    is_same.then_some(cached.messages.as_slice())
}

/// Where a whisper to `puuid` goes: their thread when one exists, else their chat id. Anyone
/// not on the friend list is refused, whatever was cached before.
pub(super) fn whisper_target(
    contacts: &[Contact],
    known: &HashMap<Puuid, String>,
    puuid: &Puuid,
) -> Result<String, ActionError> {
    let contact = contacts
        .iter()
        .find(|contact| &contact.puuid == puuid)
        .ok_or_else(|| ActionError::could_not("send that", "you can only message friends"))?;
    Ok(known
        .get(puuid)
        .cloned()
        .unwrap_or_else(|| contact.pid.clone()))
}

/// Friends that can be whispered: the ones with a puuid and a chat id.
pub(super) fn contacts(friends: &[Friend]) -> Vec<Contact> {
    friends
        .iter()
        .filter(|friend| !friend.pid.is_empty())
        .filter_map(|friend| {
            Some(Contact {
                puuid: friend.puuid.clone()?,
                game_name: friend.game_name.clone(),
                tag_line: friend.game_tag.clone(),
                pid: friend.pid.clone(),
            })
        })
        .collect()
}

fn is_direct(conversation: &Conversation) -> bool {
    DIRECT_KINDS
        .iter()
        .any(|kind| conversation.kind.eq_ignore_ascii_case(kind))
}

/// The friend a conversation is with: its id is their `pid` (`<puuid>@<chat server>`).
fn contact_of<'a>(conversation: &Conversation, contacts: &'a [Contact]) -> Option<&'a Contact> {
    let local_part = conversation.cid.split('@').next().unwrap_or_default();
    contacts.iter().find(|contact| {
        contact.pid.eq_ignore_ascii_case(&conversation.cid)
            || contact.puuid.as_str().eq_ignore_ascii_case(local_part)
    })
}

/// Whisper threads worth reading: one-to-one, with a friend, capped. Unread ones come first,
/// then the latest conversation as last read (Riot clears unread counts once read in the
/// client, so the cap would otherwise follow Riot's arbitrary list order).
pub(super) fn direct_threads(
    conversations: &[Conversation],
    contacts: &[Contact],
    cache: &ThreadCache,
) -> Vec<DirectThread> {
    let mut found: Vec<(&Conversation, &Contact)> = conversations
        .iter()
        .filter(|conversation| is_direct(conversation))
        .filter_map(|conversation| Some((conversation, contact_of(conversation, contacts)?)))
        .collect();
    let newest_at = |cid: &str| cache.get(cid).map_or(0, CachedThread::newest_at);
    found.sort_by_key(|(conversation, _)| {
        let recency = std::cmp::Reverse(newest_at(&conversation.cid));
        (std::cmp::Reverse(conversation.unread_count), recency)
    });
    found
        .into_iter()
        .take(MAX_DIRECT_THREADS)
        .map(|(conversation, contact)| DirectThread {
            cid: conversation.cid.clone(),
            mid: conversation.mid.clone(),
            contact: contact.clone(),
        })
        .collect()
}

/// One thread as the dock shows it; Riot's system lines are left out of whispers.
pub(super) fn direct_view(
    contact: &Contact,
    own: &Puuid,
    messages: &[ChatMessage],
) -> DirectChatView {
    let mut roster = Roster::default();
    roster.add(contact.puuid.as_str(), &contact.game_name, None);
    DirectChatView {
        puuid: contact.puuid.as_str().to_owned(),
        game_name: contact.game_name.clone(),
        tag_line: contact.tag_line.clone(),
        messages: conversation(&roster, own, messages, false),
    }
}

/// The newest message time of a thread; 0 when it is empty.
fn newest_at(thread: &DirectChatView) -> i64 {
    thread
        .messages
        .iter()
        .map(|message| message.sent_at_ms)
        .max()
        .unwrap_or(0)
}

/// Threads with messages, the latest conversation first.
pub(super) fn ordered(mut threads: Vec<DirectChatView>) -> Vec<DirectChatView> {
    threads.retain(|thread| !thread.messages.is_empty());
    threads.sort_by_key(|thread| std::cmp::Reverse(newest_at(thread)));
    threads
}

#[cfg(test)]
mod tests {
    use super::*;

    fn friend(puuid: &str, name: &str) -> Friend {
        Friend {
            puuid: Some(Puuid::new(puuid)),
            game_name: name.to_owned(),
            game_tag: "TAG".to_owned(),
            pid: format!("{puuid}@eu1.pvp.net"),
            ..Friend::default()
        }
    }

    fn whisper(cid: &str, unread: u32) -> Conversation {
        Conversation {
            cid: cid.to_owned(),
            kind: "chat".to_owned(),
            unread_count: unread,
            ..Conversation::default()
        }
    }

    fn line(id: &str, puuid: &str, time: &str) -> ChatMessage {
        ChatMessage {
            id: id.to_owned(),
            puuid: Some(Puuid::new(puuid)),
            time: time.to_owned(),
            body: "hey".to_owned(),
            game_name: "NameFromChat".to_owned(),
            kind: "chat".to_owned(),
            ..ChatMessage::default()
        }
    }

    #[test]
    fn friends_without_a_chat_id_cannot_be_whispered() {
        let mut no_pid = friend("b", "B");
        no_pid.pid.clear();

        let found = contacts(&[friend("a", "A"), no_pid]);

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].pid, "a@eu1.pvp.net");
    }

    #[test]
    fn only_one_to_one_threads_with_friends_are_read() {
        let contacts = contacts(&[friend("a", "A")]);
        let mut party = whisper("p@ares-parties.eu1.pvp.net", 0);
        party.kind = "groupchat".to_owned();
        let conversations = [
            whisper("a@eu1.pvp.net", 0),
            whisper("stranger@eu1.pvp.net", 4),
            party,
        ];

        let threads = direct_threads(&conversations, &contacts, &ThreadCache::default());

        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].contact.game_name, "A");
    }

    #[test]
    fn unread_threads_are_read_first_and_the_list_is_capped() {
        let friends: Vec<Friend> = (0..20).map(|n| friend(&format!("f{n}"), "F")).collect();
        let contacts = contacts(&friends);
        let mut conversations: Vec<Conversation> = (0..20)
            .map(|n| whisper(&format!("f{n}@eu1.pvp.net"), 0))
            .collect();
        conversations[19].unread_count = 2;

        let threads = direct_threads(&conversations, &contacts, &ThreadCache::default());

        assert_eq!(threads.len(), MAX_DIRECT_THREADS);
        assert_eq!(threads[0].cid, "f19@eu1.pvp.net");
    }

    #[test]
    fn a_whisper_matches_its_friend_by_puuid_when_the_ids_differ() {
        let contacts = contacts(&[friend("a", "A")]);
        let conversations = [whisper("a@other.pvp.net", 0)];

        let threads = direct_threads(&conversations, &contacts, &ThreadCache::default());

        assert_eq!(threads.len(), 1);
    }

    #[test]
    fn without_unread_ones_the_latest_conversations_fill_the_cap() {
        let friends: Vec<Friend> = (0..20).map(|n| friend(&format!("f{n}"), "F")).collect();
        let contacts = contacts(&friends);
        let conversations: Vec<Conversation> = (0..20)
            .map(|n| whisper(&format!("f{n}@eu1.pvp.net"), 0))
            .collect();
        let mut cache = ThreadCache::default();
        let recent = CachedThread {
            mid: "m".to_owned(),
            messages: vec![line("1", "f17", "500")],
        };
        cache.insert("f17@eu1.pvp.net".to_owned(), recent);

        let threads = direct_threads(&conversations, &contacts, &cache);

        assert_eq!(threads[0].cid, "f17@eu1.pvp.net");
    }

    #[test]
    fn an_unchanged_thread_is_not_read_again() {
        let mut cache = ThreadCache::default();
        let cached = CachedThread {
            mid: "m1".to_owned(),
            messages: vec![line("1", "a", "100")],
        };
        cache.insert("a@eu1.pvp.net".to_owned(), cached);
        let contact = contacts(&[friend("a", "A")]).remove(0);
        let thread = |mid: &str| DirectThread {
            cid: "a@eu1.pvp.net".to_owned(),
            mid: mid.to_owned(),
            contact: contact.clone(),
        };

        assert!(unchanged(&cache, &thread("m1")).is_some());
        assert!(unchanged(&cache, &thread("m2")).is_none());
        assert!(
            unchanged(&cache, &thread("")).is_none(),
            "no id: read to be sure"
        );
    }

    #[test]
    fn whispers_go_only_to_friends() {
        let contacts = contacts(&[friend("a", "A")]);
        let mut known = HashMap::new();
        known.insert(Puuid::new("stale"), "stale@eu1.pvp.net".to_owned());

        let to_friend = whisper_target(&contacts, &HashMap::new(), &Puuid::new("a"));
        let to_stranger = whisper_target(&contacts, &known, &Puuid::new("stale"));

        assert_eq!(to_friend.ok().as_deref(), Some("a@eu1.pvp.net"));
        assert!(
            to_stranger.is_err(),
            "a cached thread is no pass for a non-friend"
        );
    }

    #[test]
    fn an_existing_thread_is_reused() {
        let contacts = contacts(&[friend("a", "A")]);
        let mut known = HashMap::new();
        known.insert(Puuid::new("a"), "thread@eu1.pvp.net".to_owned());

        let target = whisper_target(&contacts, &known, &Puuid::new("a"));

        assert_eq!(target.ok().as_deref(), Some("thread@eu1.pvp.net"));
    }

    #[test]
    fn a_thread_names_the_friend_as_the_friend_list_does() {
        let contact = contacts(&[friend("a", "Luna")]).remove(0);
        let messages = [line("1", "a", "100"), line("2", "me", "200")];

        let view = direct_view(&contact, &Puuid::new("me"), &messages);

        assert_eq!(
            view.messages[0].author, "Luna",
            "never the name the chat sends"
        );
        assert!(view.messages[1].is_self);
        assert_eq!(view.tag_line, "TAG");
    }

    #[test]
    fn the_latest_conversation_comes_first_and_empty_ones_go() {
        let luna = contacts(&[friend("a", "Luna")]).remove(0);
        let mia = contacts(&[friend("b", "Mia")]).remove(0);
        let own = Puuid::new("me");
        let threads = vec![
            direct_view(&luna, &own, &[line("1", "a", "100")]),
            direct_view(&mia, &own, &[line("2", "b", "300")]),
            direct_view(&mia, &own, &[]),
        ];

        let shown = ordered(threads);

        let names: Vec<&str> = shown
            .iter()
            .map(|thread| thread.game_name.as_str())
            .collect();
        assert_eq!(names, ["Mia", "Luna"]);
    }
}
