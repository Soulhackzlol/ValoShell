//! Friends: the friend list joined with live presence, so the menu can
//! show who is online, what they are doing, and invite them in one click.

pub mod requests;

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use domain::game_modes;
use domain::ids::Puuid;
use domain::presence::{LoopState, decode_private, presence_field, read_own_presence};
use riot::api::local::events::UriKind;
use riot::api::local::friends::{
    Friend, FriendsResponse, Presence, PresencesResponse, get_friends, get_presences,
};
use riot::session::RiotSession;
use serde::Serialize;
use serde_json::Value;
use tokio::sync::broadcast::error::RecvError;
use tokio_util::sync::CancellationToken;
use ts_rs::TS;

use crate::assets::{AssetStore, image_url};
use crate::ctx::Ctx;
use crate::event::AppEvent;

/// Presence changes arrive in bursts (every friend's heartbeat); refresh once per burst.
const DEBOUNCE: Duration = Duration::from_millis(1200);
/// Safety net for missed events.
const RESYNC_INTERVAL: Duration = Duration::from_secs(60);

/// What a friend is doing, most available first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum FriendStatus {
    Menus,
    Queueing,
    AgentSelect,
    InMatch,
    /// Online in another Riot game or the client only.
    Online,
    Away,
    Offline,
}

/// One friend row.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct FriendView {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub status: FriendStatus,
    /// "Ascent 7-5" in a match; empty otherwise. The party is `party_size`, which every friends
    /// look prints its own way ("Duo", "Trio").
    pub detail: String,
    pub party_size: u32,
    pub note: String,
    /// Epoch ms of the last time online, for offline friends.
    #[ts(type = "number | null")]
    pub last_online_ms: Option<i64>,
    /// Small player-card art from their VALORANT presence, like the client's friend rows.
    pub card_small: Option<String>,
    pub account_level: Option<u32>,
    /// Mode they are queued or playing ("Competitive", "Custom"); empty outside VALORANT.
    pub queue: String,
    /// Product id for friends in another Riot game (`league_of_legends`...).
    pub product: String,
}

/// What a VALORANT presence says beyond the status line.
#[derive(Debug, Default)]
struct PresenceExtras {
    card_id: String,
    account_level: Option<u32>,
    queue: String,
}

fn presence_extras(private: &serde_json::Map<String, Value>) -> PresenceExtras {
    let text = |key: &str| {
        presence_field(private, key)
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_owned()
    };
    let queue = text("queueId");
    let is_custom = text("provisioningFlow").eq_ignore_ascii_case("CustomGame");
    PresenceExtras {
        card_id: text("playerCardId"),
        account_level: presence_field(private, "accountLevel")
            .and_then(Value::as_u64)
            .and_then(|level| u32::try_from(level).ok())
            .filter(|level| *level > 0),
        queue: match queue.as_str() {
            _ if is_custom => "Custom".to_owned(),
            "" => String::new(),
            raw => game_modes::label_for(raw),
        },
    }
}

fn queue_is_searching(private: &serde_json::Map<String, Value>) -> bool {
    presence_field(private, "partyState").and_then(Value::as_str) == Some("MATCHMAKING")
}

/// Status and detail line from one VALORANT presence.
fn valorant_status(
    private: &serde_json::Map<String, Value>,
    presence: &Presence,
) -> (FriendStatus, String, u32) {
    let own = read_own_presence(private);
    let party_size = own.party_size.unwrap_or(1);
    let scores = own
        .live_scores
        .as_ref()
        .map(|live| format!("{} {}-{}", live.map_name, live.ally_score, live.enemy_score));
    let status = match own.loop_state {
        Some(LoopState::Ingame) => FriendStatus::InMatch,
        Some(LoopState::Pregame) => FriendStatus::AgentSelect,
        _ if queue_is_searching(private) => FriendStatus::Queueing,
        _ if presence.state.eq_ignore_ascii_case("away") => FriendStatus::Away,
        _ => FriendStatus::Menus,
    };
    let detail = match status {
        FriendStatus::InMatch => scores.unwrap_or_else(|| "In a match".to_owned()),
        _ => String::new(),
    };
    (status, detail, party_size)
}

/// Turns a player-card uuid into a displayable small-art url.
pub type CardArt<'a> = &'a dyn Fn(&str) -> Option<String>;

fn friend_view(
    friend: &Friend,
    presences: &HashMap<Puuid, &Presence>,
    card_art: CardArt<'_>,
) -> Option<FriendView> {
    let puuid = friend.puuid.clone()?;
    let presence = presences.get(&puuid);
    let private = presence
        .filter(|presence| presence.is_valorant())
        .map(|presence| decode_private(&presence.private))
        .unwrap_or_default();
    let extras = presence_extras(&private);
    let (status, detail, party_size) = match presence {
        Some(presence) if presence.is_valorant() => valorant_status(&private, presence),
        Some(presence) if presence.state.eq_ignore_ascii_case("away") => {
            (FriendStatus::Away, String::new(), 1)
        }
        Some(presence) => (FriendStatus::Online, presence.product.clone(), 1),
        None => (FriendStatus::Offline, String::new(), 1),
    };
    Some(FriendView {
        puuid: puuid.to_string(),
        game_name: friend.game_name.clone(),
        tag_line: friend.game_tag.clone(),
        status,
        detail,
        party_size,
        note: friend.note.clone(),
        last_online_ms: friend
            .last_online_ts
            .filter(|_| status == FriendStatus::Offline),
        card_small: Some(extras.card_id.as_str())
            .filter(|id| !id.is_empty())
            .and_then(card_art),
        account_level: extras.account_level,
        queue: extras.queue,
        product: presence
            .map(|presence| presence.product.clone())
            .unwrap_or_default(),
    })
}

/// Riot Client presences only say "online"; a game's presence says what they are doing.
const CLIENT_PRODUCTS: [&str; 2] = ["keystone", "riot_client"];

/// How much a presence tells: VALORANT first, then another game, then the client itself.
fn presence_rank(presence: &Presence) -> u8 {
    if presence.is_valorant() {
        2
    } else if CLIENT_PRODUCTS.contains(&presence.product.as_str()) {
        0
    } else {
        1
    }
}

/// Friends joined with presence: available first, then by name; offline by last seen.
pub fn friend_views(
    friends: &[Friend],
    presences: &[Presence],
    card_art: CardArt<'_>,
) -> Vec<FriendView> {
    // One friend can carry several presences at once (VALORANT plus the Riot Client, or a
    // second game); keep the one that says the most, or a VALORANT player reads as elsewhere.
    let mut by_puuid: HashMap<Puuid, &Presence> = HashMap::new();
    for presence in presences {
        let Some(puuid) = presence.puuid.clone() else {
            continue;
        };
        let best = by_puuid.entry(puuid).or_insert(presence);
        if presence_rank(presence) > presence_rank(best) {
            *best = presence;
        }
    }
    let mut views: Vec<FriendView> = friends
        .iter()
        .filter_map(|friend| friend_view(friend, &by_puuid, card_art))
        .collect();
    views.sort_by(|a, b| {
        a.status
            .cmp(&b.status)
            .then_with(|| b.last_online_ms.cmp(&a.last_online_ms))
            .then_with(|| a.game_name.to_lowercase().cmp(&b.game_name.to_lowercase()))
    });
    views
}

/// Cheap to clone.
#[derive(Clone)]
pub struct SocialService {
    ctx: Ctx,
    assets: AssetStore,
    last: Arc<Mutex<Vec<FriendView>>>,
}

impl SocialService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            last: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// The last published friend list.
    pub fn current(&self) -> Vec<FriendView> {
        self.last
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    /// Background task: refresh on presence and friend events (debounced) and a slow tick.
    pub async fn run(self, stop: CancellationToken) {
        let mut events = self.ctx.riot_events();
        let mut resync = tokio::time::interval(RESYNC_INTERVAL);
        loop {
            let is_wanted = tokio::select! {
                () = stop.cancelled() => return,
                event = events.recv() => match event {
                    Ok(event) => matches!(event.kind, UriKind::Presence | UriKind::Friends),
                    Err(RecvError::Lagged(_)) => true,
                    Err(RecvError::Closed) => return,
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

    async fn refresh(&self) {
        let Some(session) = self.ctx.session() else {
            self.publish(Vec::new());
            return;
        };
        if let Some(views) = read_friends(&session, &self.assets).await {
            self.publish(views);
        }
    }

    fn publish(&self, views: Vec<FriendView>) {
        let mut last = self.last.lock().unwrap_or_else(PoisonError::into_inner);
        if *last == views {
            return;
        }
        last.clone_from(&views);
        drop(last);
        self.ctx.bus.publish(AppEvent::Friends(views));
    }
}

/// Both lists are local Riot Client calls (cheap, not rate limited).
async fn read_friends(session: &RiotSession, assets: &AssetStore) -> Option<Vec<FriendView>> {
    let friends: FriendsResponse = session.http.send_json(&get_friends()).await.ok()?;
    let presences: PresencesResponse = session
        .http
        .send_json(&get_presences(None, None))
        .await
        .unwrap_or_default();
    let index = assets.index();
    let card_art = |id: &str| {
        index
            .player_card(id)
            .and_then(|card| card.small_art.clone())
            .map(|url| image_url(&url))
    };
    Some(friend_views(
        &friends.friends,
        &presences.presences,
        &card_art,
    ))
}

#[cfg(test)]
mod tests {
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;
    use serde_json::json;

    use super::*;

    fn friend(name: &str, puuid: &str, last_online: Option<i64>) -> Friend {
        Friend {
            game_name: name.to_owned(),
            game_tag: "EUW".to_owned(),
            puuid: Some(Puuid::new(puuid)),
            last_online_ts: last_online,
            ..Friend::default()
        }
    }

    fn no_art(_: &str) -> Option<String> {
        None
    }

    fn presence(puuid: &str, private: &Value) -> Presence {
        Presence {
            puuid: Some(Puuid::new(puuid)),
            product: "valorant".to_owned(),
            state: "chat".to_owned(),
            private: STANDARD.encode(private.to_string()),
            ..Presence::default()
        }
    }

    #[test]
    fn in_match_friends_show_map_and_score() {
        let private = json!({
            "sessionLoopState": "INGAME",
            "partyOwnerMatchMap": "/Game/Maps/Ascent/Ascent",
            "partyOwnerMatchScoreAllyTeam": 7,
            "partyOwnerMatchScoreEnemyTeam": 5,
            "partySize": 2
        });

        let views = friend_views(
            &[friend("Ace", "a", None)],
            &[presence("a", &private)],
            &no_art,
        );

        assert_eq!(views[0].status, FriendStatus::InMatch);
        assert_eq!(views[0].detail, "Ascent 7-5");
        assert_eq!(views[0].party_size, 2);
    }

    #[test]
    fn friends_carry_card_level_and_queue_from_presence() {
        let private = json!({
            "matchPresenceData": { "sessionLoopState": "MENUS", "queueId": "competitive" },
            "playerPresenceData": { "playerCardId": "card-1", "accountLevel": 499 }
        });
        let art = |id: &str| Some(format!("art/{id}"));

        let views = friend_views(
            &[friend("Ace", "a", None)],
            &[presence("a", &private)],
            &art,
        );

        assert_eq!(views[0].card_small.as_deref(), Some("art/card-1"));
        assert_eq!(views[0].account_level, Some(499));
        assert_eq!(views[0].queue, "Competitive");
        assert_eq!(views[0].product, "valorant");
    }

    #[test]
    fn available_friends_come_first_and_offline_last() {
        let menus = json!({ "sessionLoopState": "MENUS", "partySize": 1 });
        let friends = [
            friend("Zed", "z", Some(5)),
            friend("Bob", "b", None),
            friend("Amy", "a", Some(9)),
        ];

        let views = friend_views(&friends, &[presence("b", &menus)], &no_art);

        let order: Vec<&str> = views.iter().map(|view| view.game_name.as_str()).collect();
        assert_eq!(order, ["Bob", "Amy", "Zed"]);
        assert_eq!(views[1].status, FriendStatus::Offline);
        assert_eq!(views[1].last_online_ms, Some(9));
    }

    #[test]
    fn other_games_and_away_are_told_apart() {
        let league = Presence {
            puuid: Some(Puuid::new("l")),
            product: "league_of_legends".to_owned(),
            ..Presence::default()
        };
        let away = Presence {
            puuid: Some(Puuid::new("w")),
            product: "valorant".to_owned(),
            state: "away".to_owned(),
            ..Presence::default()
        };

        let views = friend_views(
            &[friend("Lee", "l", None), friend("Wes", "w", None)],
            &[league, away],
            &no_art,
        );

        assert_eq!(views[0].status, FriendStatus::Online);
        assert_eq!(views[1].status, FriendStatus::Away);
    }

    #[test]
    fn a_valorant_presence_wins_over_the_riot_client_one() {
        let menus = json!({ "sessionLoopState": "MENUS" });
        let client = Presence {
            puuid: Some(Puuid::new("p")),
            product: "keystone".to_owned(),
            ..Presence::default()
        };

        let views = friend_views(
            &[friend("Paco", "p", None)],
            &[presence("p", &menus), client],
            &no_art,
        );

        assert_eq!(views[0].status, FriendStatus::Menus);
        assert_eq!(views[0].product, "valorant");
    }
}
