//! Party, agent-select and whisper chat, through the Riot Client's own local chat API.
//!
//! Names never come from the chat itself: an author is named only as the party lineup or the
//! agent-select roster already shows them (which leaves out players who hide their name), and
//! falls back to their agent or to nothing. So chat can never reveal a name the menu hides.
//! Whispers are with friends only, named as the friend list names them.

mod direct;
mod view;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use domain::ids::Puuid;
use domain::phase::Phase;
use riot::Request;
use riot::api::local::chat::{
    Conversation, ConversationsResponse, MessageKind, MessagesResponse, get_conversations,
    get_messages, get_party_conversation, get_pregame_conversation, send_message,
};
use riot::api::local::events::UriKind;
use riot::api::local::friends::{Friend, FriendsResponse, get_friends};
use riot::session::RiotSession;
use serde::Deserialize;
use tokio::sync::broadcast::error::RecvError;
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

pub use direct::DirectChatView;
pub use view::{ChatMessageView, ChatView, Roster, chat_view};

use direct::{
    ThreadCache, contacts, direct_threads, direct_view, ordered, unchanged, whisper_target,
};

use crate::action::{ActionError, send_ok};
use crate::ctx::Ctx;
use crate::event::AppEvent;
use crate::party::PartyService;
use crate::pregame::PregameService;

/// Chat events come in bursts (one per message part); read once after the burst.
const DEBOUNCE: Duration = Duration::from_millis(250);
/// Safety net for missed events.
const RESYNC_INTERVAL: Duration = Duration::from_secs(20);
/// Longest message accepted, so a paste never floods the party.
const MAX_MESSAGE_CHARS: usize = 300;

/// Which conversation a message goes to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ChatScope {
    Party,
    /// The team chat of agent select.
    Team,
}

#[derive(Default)]
struct ChatState {
    party_cid: Option<String>,
    team_cid: Option<String>,
    /// Whisper conversation per friend, as last read.
    direct_cids: HashMap<Puuid, String>,
    /// Whisper histories by conversation, so unchanged threads cost no call.
    direct_cache: ThreadCache,
    view: Option<ChatView>,
}

/// The party and team chats as one refresh read them.
struct GroupChats {
    view: ChatView,
    party_cid: Option<String>,
    team_cid: Option<String>,
}

/// The whisper threads as one refresh read them.
#[derive(Default)]
struct DirectChats {
    threads: Vec<DirectChatView>,
    cids: HashMap<Puuid, String>,
    cache: ThreadCache,
}

struct Inner {
    ctx: Ctx,
    party: PartyService,
    pregame: PregameService,
    state: Mutex<ChatState>,
}

/// Cheap to clone.
#[derive(Clone)]
pub struct ChatService {
    inner: Arc<Inner>,
}

impl ChatService {
    pub fn new(ctx: Ctx, party: PartyService, pregame: PregameService) -> Self {
        Self {
            inner: Arc::new(Inner {
                ctx,
                party,
                pregame,
                state: Mutex::new(ChatState::default()),
            }),
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, ChatState> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// The last published chat.
    pub fn current(&self) -> Option<ChatView> {
        self.state().view.clone()
    }

    /// Background task: re-read after chat, party and agent-select changes (debounced).
    pub async fn run(self, stop: CancellationToken) {
        let mut events = self.inner.ctx.riot_events();
        let mut game = self.inner.ctx.game();
        let mut resync = tokio::time::interval(RESYNC_INTERVAL);
        loop {
            let is_wanted = tokio::select! {
                () = stop.cancelled() => return,
                event = events.recv() => match event {
                    Ok(event) => is_chat_event(event.kind),
                    Err(RecvError::Lagged(_)) => true,
                    Err(RecvError::Closed) => return,
                },
                // A closed channel would answer at once forever: stop instead of spinning.
                changed = game.changed() => {
                    if changed.is_err() {
                        return;
                    }
                    true
                },
                _ = resync.tick() => true,
            };
            if !is_wanted {
                continue;
            }
            tokio::time::sleep(DEBOUNCE).await;
            while events.try_recv().is_ok() {}
            self.refresh().await;
        }
    }

    /// Read every conversation again and publish the chat if it changed.
    pub async fn refresh(&self) {
        let Some(session) = self.inner.ctx.session() else {
            // The next session may be another account: nothing read for this one carries over.
            let view = self.state().view.take();
            *self.state() = ChatState {
                view,
                ..ChatState::default()
            };
            self.publish(None);
            return;
        };
        let groups = self.read_groups(&session).await;
        let cache = std::mem::take(&mut self.state().direct_cache);
        let direct = read_direct(&session, &cache).await;
        let mut state = self.state();
        state.party_cid = groups.party_cid;
        state.team_cid = groups.team_cid;
        state.direct_cids = direct.cids;
        state.direct_cache = direct.cache;
        drop(state);
        self.publish(Some(ChatView {
            direct: direct.threads,
            ..groups.view
        }));
    }

    /// The party chat, and the team chat while in agent select.
    async fn read_groups(&self, session: &RiotSession) -> GroupChats {
        let is_in_pregame = self.inner.ctx.game().borrow().phase == Phase::Pregame;
        let party_cid = conversation_id(session, &get_party_conversation()).await;
        let team_cid = if is_in_pregame {
            conversation_id(session, &get_pregame_conversation()).await
        } else {
            None
        };
        let party = read_messages(session, party_cid.as_deref()).await;
        let team = read_messages(session, team_cid.as_deref()).await;
        let roster = Roster::from_views(
            self.inner.party.current().as_ref(),
            self.inner.pregame.current().as_ref(),
        );
        let view = chat_view(&roster, &session.puuid, &party, &team);
        GroupChats {
            view: ChatView {
                is_party_open: party_cid.is_some(),
                is_team_open: team_cid.is_some(),
                ..view
            },
            party_cid,
            team_cid,
        }
    }

    fn publish(&self, view: Option<ChatView>) {
        let mut state = self.state();
        if state.view == view {
            return;
        }
        state.view.clone_from(&view);
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Chat(view));
    }

    /// Send `text` to the party or the team.
    pub async fn send(&self, scope: ChatScope, text: &str) -> Result<(), ActionError> {
        let text = message_text(text)?;
        let session = self.inner.ctx.session().ok_or(ActionError::NotConnected)?;
        let cid = match scope {
            ChatScope::Party => self.state().party_cid.clone(),
            ChatScope::Team => self.state().team_cid.clone(),
        };
        let cid =
            cid.ok_or_else(|| ActionError::could_not("send that", "that chat is not open"))?;
        let request = send_message(&cid, text, MessageKind::GroupChat);
        self.post(&session, &request).await
    }

    /// Whisper `text` to a friend; anyone else is refused.
    pub async fn send_direct(&self, puuid: &Puuid, text: &str) -> Result<(), ActionError> {
        let text = message_text(text)?;
        let session = self.inner.ctx.session().ok_or(ActionError::NotConnected)?;
        // Read fresh on every send: friendship is checked now, not from what was cached.
        let friends = read_friend_list(&session)
            .await
            .ok_or_else(|| ActionError::could_not("send that", "your friend list did not load"))?;
        let known = self.state().direct_cids.clone();
        let cid = whisper_target(&contacts(&friends), &known, puuid)?;
        let request = send_message(&cid, text, MessageKind::Whisper);
        self.post(&session, &request).await?;
        if !self.state().direct_cids.contains_key(puuid) {
            // The thread should exist now (riot::api::local::chat::MessageKind); if Riot ever
            // changes how whispers are addressed, this is where it shows.
            // The cid holds the friend's puuid, so only the event is logged.
            tracing::warn!("chat_whisper_thread_not_found_after_send");
        }
        Ok(())
    }

    /// Send one message, then read the chat again so it shows at once. Riot's own chat event
    /// follows too; its re-read finds nothing changed, and unchanged whispers cost no call.
    async fn post(&self, session: &RiotSession, request: &Request) -> Result<(), ActionError> {
        send_ok(&session.http, request, "send that message").await?;
        self.refresh().await;
        Ok(())
    }
}

/// The message as it is sent: trimmed, not empty, not longer than Riot accepts.
fn message_text(text: &str) -> Result<&str, ActionError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(ActionError::could_not("send that", "the message is empty"));
    }
    if text.chars().count() > MAX_MESSAGE_CHARS {
        let reason = format!("keep it under {MAX_MESSAGE_CHARS} characters");
        return Err(ActionError::could_not("send that", reason));
    }
    Ok(text)
}

/// Events after which a conversation, its lineup or a friend's name may have changed.
fn is_chat_event(kind: UriKind) -> bool {
    matches!(
        kind,
        UriKind::Chat | UriKind::Party | UriKind::Pregame | UriKind::Friends | UriKind::OutOfSync
    )
}

/// The conversations the request answers with, or why there are none.
async fn read_conversations(
    session: &RiotSession,
    request: &Request,
) -> riot::RiotResult<Vec<Conversation>> {
    let found: ConversationsResponse = session.http.send_json(request).await?;
    Ok(found.conversations)
}

/// The conversation id the request answers with (its first conversation). No party or no agent
/// select is the usual reason for none, so a failed read is only logged at debug.
async fn conversation_id(session: &RiotSession, request: &Request) -> Option<String> {
    match read_conversations(session, request).await {
        Ok(found) => found
            .into_iter()
            .map(|conversation| conversation.cid)
            .find(|cid| !cid.is_empty()),
        Err(error) => {
            tracing::debug!(%error, "chat_conversation_unread");
            None
        }
    }
}

/// The friend list, read fresh; whispers are named and addressed from it.
async fn read_friend_list(session: &RiotSession) -> Option<Vec<Friend>> {
    match session
        .http
        .send_json::<FriendsResponse>(&get_friends())
        .await
    {
        Ok(found) => Some(found.friends),
        Err(error) => {
            tracing::warn!(%error, "chat_friends_unread");
            None
        }
    }
}

/// Every whisper thread with a friend (capped), the latest conversation first. A thread whose
/// newest message is the one already read is taken from `cache` instead of read again.
async fn read_direct(session: &RiotSession, cache: &ThreadCache) -> DirectChats {
    let conversations = match read_conversations(session, &get_conversations(None)).await {
        Ok(found) if !found.is_empty() => found,
        Ok(_) => return DirectChats::default(),
        Err(error) => {
            tracing::warn!(%error, "chat_whispers_unread");
            return DirectChats::default();
        }
    };
    let Some(friends) = read_friend_list(session).await else {
        return DirectChats::default();
    };
    let mut chats = DirectChats::default();
    let mut threads = Vec::new();
    for thread in direct_threads(&conversations, &contacts(&friends), cache) {
        let messages = match unchanged(cache, &thread) {
            Some(cached) => cached.to_vec(),
            None => read_messages(session, Some(&thread.cid)).await,
        };
        threads.push(direct_view(&thread.contact, &session.puuid, &messages));
        let cached = direct::CachedThread {
            mid: thread.mid,
            messages,
        };
        chats.cache.insert(thread.cid.clone(), cached);
        chats.cids.insert(thread.contact.puuid, thread.cid);
    }
    chats.threads = ordered(threads);
    chats
}

/// One conversation's messages; none when there is no conversation or Riot did not answer.
async fn read_messages(
    session: &RiotSession,
    cid: Option<&str>,
) -> Vec<riot::api::local::chat::ChatMessage> {
    let Some(cid) = cid else {
        return Vec::new();
    };
    match session
        .http
        .send_json::<MessagesResponse>(&get_messages(cid))
        .await
    {
        Ok(found) => found.messages,
        Err(error) => {
            tracing::debug!(%error, "chat_messages_unread");
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn messages_are_sent_trimmed() {
        assert_eq!(
            message_text(
                "  gg wp 
"
            )
            .ok(),
            Some("gg wp")
        );
    }

    #[test]
    fn blank_messages_are_refused() {
        assert!(message_text("   ").is_err());
    }

    #[test]
    fn the_limit_counts_characters_not_bytes() {
        let at_limit = "é".repeat(MAX_MESSAGE_CHARS);
        assert!(message_text(&at_limit).is_ok());
        assert!(message_text(&format!("{at_limit}é")).is_err());
    }

    #[test]
    fn presence_events_do_not_reread_the_chat() {
        assert!(is_chat_event(UriKind::OutOfSync));
        assert!(!is_chat_event(UriKind::Presence));
    }

    #[test]
    fn friend_list_changes_reread_the_whisper_names() {
        assert!(is_chat_event(UriKind::Friends));
    }
}
