//! Live lobby: during agent select and the match, every player's
//! rank, RR, peak, win rate, level and party stack. Rows appear at once and fill in as
//! each player's MMR arrives; ranks are fetched once per match. Names are never requested
//! for incognito players, and enemy ranks wait for the match to start unless the player opts
//! in to seeing them during agent select.

mod view;

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use domain::ids::{PartyId, Puuid};
use domain::match_details::player_row::{RankerInputs, RankerRow, derive_ranker_row};
use domain::phase::Phase;
use domain::presence::{parse_parties, stack_sizes};
use riot::api::glz::common::PhaseLink;
use riot::api::glz::coregame::{self, CoregameMatch};
use riot::api::glz::pregame::{self as pregame_api};
use riot::api::glz::pregame_match::PregameMatch;
use riot::api::local::events::UriKind;
use riot::api::local::friends::get_presences;
use riot::api::pd::mmr::get_player_mmr;
use riot::api::shared::{Content, get_content};
use riot::session::RiotSession;
use riot::{CachePolicy, Request};
use serde_json::Value;
use tokio::sync::broadcast::error::RecvError;
use tokio_util::sync::CancellationToken;

use view::{LobbyInputs, coregame_roster, lobby_view, pregame_roster, stack_groups};
pub use view::{LobbyPlayerView, LobbyView, Roster, RosterEntry};

use crate::assets::AssetStore;
use crate::ctx::Ctx;
use crate::event::AppEvent;
use crate::names::NameBook;

/// Riot repeats match events in bursts; read the lobby once after the burst.
const DEBOUNCE: Duration = Duration::from_millis(1500);
/// Agents change during agent select; re-read the roster this often while live.
const LIVE_REFRESH: Duration = Duration::from_secs(4);

#[derive(Default)]
struct LobbyState {
    match_id: String,
    rows: HashMap<Puuid, RankerRow>,
    view: Option<LobbyView>,
    season_id: Option<String>,
}

struct Inner {
    ctx: Ctx,
    assets: AssetStore,
    names: NameBook,
    state: Mutex<LobbyState>,
    /// One pass at a time; a trigger during a pass is picked up by the next tick.
    pass: tokio::sync::Mutex<()>,
}

/// Cheap to clone.
#[derive(Clone)]
pub struct LobbyService {
    inner: Arc<Inner>,
}

impl LobbyService {
    pub fn new(ctx: Ctx, assets: AssetStore, names: NameBook) -> Self {
        Self {
            inner: Arc::new(Inner {
                ctx,
                assets,
                names,
                state: Mutex::new(LobbyState::default()),
                pass: tokio::sync::Mutex::new(()),
            }),
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, LobbyState> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// The last lobby (live or the previous match).
    pub fn current(&self) -> Option<LobbyView> {
        self.state().view.clone()
    }

    /// Background task.
    pub async fn run(self, stop: CancellationToken) {
        let mut events = self.inner.ctx.riot_events();
        let mut game = self.inner.ctx.game();
        let mut tick = tokio::time::interval(LIVE_REFRESH);
        loop {
            let is_match_event = tokio::select! {
                () = stop.cancelled() => return,
                event = events.recv() => match event {
                    Ok(event) => matches!(event.kind, UriKind::Pregame | UriKind::Coregame),
                    Err(RecvError::Lagged(_)) => true,
                    Err(RecvError::Closed) => return,
                },
                changed = game.changed() => {
                    if changed.is_err() {
                        return;
                    }
                    true
                },
                _ = tick.tick() => false,
            };
            let phase = game.borrow().phase;
            if !phase.is_live() {
                self.end_match();
                continue;
            }
            if is_match_event {
                tokio::time::sleep(DEBOUNCE).await;
            }
            self.pass(phase).await;
        }
    }

    /// The match ended: keep the table, marked as the last match.
    fn end_match(&self) {
        let mut state = self.state();
        let Some(view) = state.view.as_mut().filter(|view| view.is_live) else {
            return;
        };
        view.is_live = false;
        let view = view.clone();
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Lobby(Some(view)));
    }

    async fn pass(&self, phase: Phase) {
        let Ok(_running) = self.inner.pass.try_lock() else {
            return;
        };
        let Some(session) = self.inner.ctx.session() else {
            return;
        };
        let Some(roster) = read_roster(&session, phase).await else {
            return;
        };
        self.start_match(&roster.match_id);
        let visible: Vec<Puuid> = roster
            .entries
            .iter()
            .filter(|entry| !entry.is_incognito)
            .map(|entry| entry.puuid.clone())
            .collect();
        self.inner.names.learn(&session, visible).await;
        let stacks = read_stacks(&session, &roster).await;
        self.publish(&session, &roster, &stacks);
        self.fill_ranks(&session, &roster, &stacks).await;
    }

    /// A new match forgets the previous match's ranks and act (an act can end between matches).
    fn start_match(&self, match_id: &str) {
        let mut state = self.state();
        if state.match_id != match_id {
            state.match_id = match_id.to_owned();
            state.rows.clear();
            state.season_id = None;
        }
    }

    async fn fill_ranks(
        &self,
        session: &RiotSession,
        roster: &Roster,
        stacks: &HashMap<Puuid, (u32, u32)>,
    ) {
        let season_id = self.season_id(session).await;
        let are_enemy_ranks_hidden = self.are_enemy_ranks_hidden(roster);
        // Hidden enemy ranks are never requested, not merely left undisplayed.
        let readable = roster
            .entries
            .iter()
            .filter(|entry| entry.is_ally || !are_enemy_ranks_hidden);
        for entry in readable {
            if self.state().rows.contains_key(&entry.puuid) {
                continue;
            }
            let mmr = fetch_value(session, &get_player_mmr(&entry.puuid)).await;
            let Some(mmr) = mmr else {
                continue;
            };
            let row = derive_ranker_row(&RankerInputs {
                mmr: &mmr,
                season_id: &season_id,
                competitive_updates: None,
                live_badge: None,
            });
            self.state().rows.insert(entry.puuid.clone(), row);
            self.publish(session, roster, stacks);
        }
    }

    /// Riot sends no enemy team during agent select; should a roster ever carry one there, its
    /// ranks stay unread, as the game hides them until the match starts.
    fn are_enemy_ranks_hidden(&self, roster: &Roster) -> bool {
        roster.is_pregame
    }

    /// The active act, read once per match.
    async fn season_id(&self, session: &RiotSession) -> String {
        if let Some(id) = self.state().season_id.clone() {
            return id;
        }
        let content: Option<Content> = fetch_value(session, &get_content())
            .await
            .and_then(|value| serde_json::from_value(value).ok());
        let id = content
            .as_ref()
            .and_then(Content::active_act_id)
            .unwrap_or_default()
            .to_owned();
        if !id.is_empty() {
            self.state().season_id = Some(id.clone());
        }
        id
    }

    fn publish(&self, session: &RiotSession, roster: &Roster, stacks: &HashMap<Puuid, (u32, u32)>) {
        let index = self.inner.assets.index();
        let names = self.inner.names.snapshot();
        let party = self.inner.names.party();
        let view = {
            let state = self.state();
            let inputs = LobbyInputs {
                index: &index,
                own: &session.puuid,
                names: &names,
                party: &party,
                rows: &state.rows,
                stacks,
                are_enemy_ranks_hidden: self.are_enemy_ranks_hidden(roster),
            };
            lobby_view(roster, &inputs)
        };
        let mut state = self.state();
        if state.view.as_ref() == Some(&view) {
            return;
        }
        state.view = Some(view.clone());
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Lobby(Some(view)));
    }
}

/// Paced, cached read (ranks are stable for a match); `None` when Riot did not answer.
async fn fetch_value(session: &RiotSession, request: &Request) -> Option<Value> {
    let fetched = session
        .gate
        .fetch(&session.http, request, CachePolicy::Cached)
        .await;
    fetched.is_complete.then_some(fetched.data)
}

/// The live match roster: the core game in a match, agent select before it.
async fn read_roster(session: &RiotSession, phase: Phase) -> Option<Roster> {
    if phase == Phase::Ingame
        && let Some(roster) = read_coregame(session).await
    {
        return Some(roster);
    }
    let link: PhaseLink = session
        .http
        .send_json(&pregame_api::get_player(&session.puuid))
        .await
        .ok()?;
    let match_id = link.match_id.filter(|id| !id.is_empty())?;
    let pregame: PregameMatch = session
        .http
        .send_json(&pregame_api::get_match(&match_id))
        .await
        .ok()?;
    Some(pregame_roster(&pregame))
}

async fn read_coregame(session: &RiotSession) -> Option<Roster> {
    let link: PhaseLink = session
        .http
        .send_json(&coregame::get_player(&session.puuid))
        .await
        .ok()?;
    let match_id = link.match_id.filter(|id| !id.is_empty())?;
    let core: CoregameMatch = session
        .http
        .send_json(&coregame::get_match(&match_id))
        .await
        .ok()?;
    Some(coregame_roster(&core, &session.puuid))
}

/// Party stacks visible through chat presence (you, your party and friends only).
async fn read_stacks(session: &RiotSession, roster: &Roster) -> HashMap<Puuid, (u32, u32)> {
    let Ok(answer) = session
        .http
        .send_json::<Value>(&get_presences(None, None))
        .await
    else {
        return HashMap::new();
    };
    let presences = answer
        .get("presences")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let puuids: Vec<Puuid> = roster
        .entries
        .iter()
        .map(|entry| entry.puuid.clone())
        .collect();
    let members: HashSet<Puuid> = puuids.iter().cloned().collect();
    let parties = parse_parties(&presences, Some(&members));
    let sizes = stack_sizes(&parties, &puuids);
    let party_ids: HashMap<Puuid, PartyId> = parties
        .into_iter()
        .map(|(puuid, party)| (puuid, party.party_id))
        .collect();
    stack_groups(&sizes, &party_ids)
}
