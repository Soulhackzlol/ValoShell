//! `AppEvent`: the only thing pushed from the backend to the UI. One broadcast bus; the app
//! shell forwards every event to the webviews and overlay sources.

use domain::match_flow::FlowEffect;
use domain::phase::GameSnapshot;
use serde::Serialize;
use tokio::sync::broadcast;
use ts_rs::TS;

const BUS_CAPACITY: usize = 512;

/// Connection to the Riot Client, as the menu shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "state", rename_all = "snake_case")]
#[ts(export)]
pub enum ConnectionStatus {
    WaitingForRiot,
    RiotFound,
    Connecting,
    Connected {
        riot_id: Option<String>,
        region: String,
    },
    Failed {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
#[ts(export)]
pub enum AppEvent {
    Connection(ConnectionStatus),
    GameState(GameSnapshot),
    MatchFlow(FlowEffect),
    Assets(crate::assets::AssetsStatus),
    /// `None` while disconnected or before the first read.
    Party(Option<crate::party::PartyView>),
    /// `None` when agent select ends.
    Pregame(Option<crate::pregame::PregameView>),
    Wallet(crate::wallet::WalletView),
    /// The live lobby; stays (with `is_live` false) after the match.
    Lobby(Option<crate::lobby::LobbyView>),
    /// Friends with live status, best available first.
    Friends(Vec<crate::social::FriendView>),
    /// The summary of the match just played (again with the RR change, and once seen).
    PostMatch(Option<crate::post_match::PostMatchView>),
    /// Party and agent-select chat; `None` while disconnected.
    Chat(Option<crate::chat::ChatView>),
    /// A newer ValoShell, and how far its install has got.
    Update(crate::update::UpdateView),
    /// Settings as just saved, so every window (the in-game overlay too) follows them live.
    Settings(store::Settings),
}

/// Cheap to clone; every service holds one.
#[derive(Clone)]
pub struct Bus {
    sender: broadcast::Sender<AppEvent>,
}

impl Default for Bus {
    fn default() -> Self {
        Self {
            sender: broadcast::channel(BUS_CAPACITY).0,
        }
    }
}

impl Bus {
    /// Publish to every subscriber. No subscriber is fine (the UI may not be up yet).
    pub fn publish(&self, event: AppEvent) {
        let _ = self.sender.send(event);
    }

    /// A new receiver. Slow receivers lose the oldest events, never block publishers.
    pub fn subscribe(&self) -> broadcast::Receiver<AppEvent> {
        self.sender.subscribe()
    }
}
