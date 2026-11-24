//! Agent select: polls the pregame match while the player is in agent select, publishes the
//! scene's view, sends the player's own picks and tells the match flow when their agent is
//! locked (however it was locked).

mod view;

use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use domain::ids::{AgentId, MatchId};
use domain::phase::Phase;
use riot::api::glz::common::PhaseLink;
use riot::api::glz::pregame;
use riot::api::glz::pregame_match::PregameMatch;
use riot::api::local::events::UriKind;
use riot::session::RiotSession;
use tokio::sync::broadcast::error::RecvError;
use tokio_util::sync::CancellationToken;

use view::{PregameContext, pregame_view};
pub use view::{PregamePlayerView, PregameView};

use crate::action::{ActionError, send_ok};
use crate::assets::AssetStore;
use crate::ctx::Ctx;
use crate::event::AppEvent;
use crate::match_flow::FlowSignal;
use crate::names::NameBook;

/// The official client polls agent select about once a second.
const POLL_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Default)]
struct State {
    view: Option<PregameView>,
    lock_signalled: Option<MatchId>,
}

struct Inner {
    ctx: Ctx,
    assets: AssetStore,
    names: NameBook,
    state: Mutex<State>,
}

/// Cheap to clone; commands and the background task share one.
#[derive(Clone)]
pub struct PregameService {
    inner: Arc<Inner>,
}

/// Services the pregame scene needs.
pub struct PregameDeps {
    pub assets: AssetStore,
    pub names: NameBook,
}

impl PregameService {
    pub fn new(ctx: Ctx, deps: PregameDeps) -> Self {
        Self {
            inner: Arc::new(Inner {
                ctx,
                assets: deps.assets,
                names: deps.names,
                state: Mutex::new(State::default()),
            }),
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, State> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// The last published view.
    pub fn current(&self) -> Option<PregameView> {
        self.state().view.clone()
    }

    /// Background task: poll while in agent select; clear the scene when it ends.
    pub async fn run(self, stop: CancellationToken) {
        let mut events = self.inner.ctx.riot_events();
        let mut game = self.inner.ctx.game();
        let mut tick = tokio::time::interval(POLL_INTERVAL);
        loop {
            let is_pregame_event = tokio::select! {
                () = stop.cancelled() => return,
                event = events.recv() => match event {
                    Ok(event) => event.kind == UriKind::Pregame,
                    Err(RecvError::Lagged(_)) => false,
                    Err(RecvError::Closed) => return,
                },
                changed = game.changed() => {
                    if changed.is_err() {
                        return;
                    }
                    false
                },
                _ = tick.tick() => false,
            };
            let phase = game.borrow().phase;
            if phase == Phase::Pregame || is_pregame_event {
                self.poll().await;
            } else if self.current().is_some() {
                self.leave_pregame();
            }
        }
    }

    fn leave_pregame(&self) {
        self.state().view = None;
        self.inner.ctx.bus.publish(AppEvent::Pregame(None));
    }

    async fn poll(&self) {
        let Some(session) = self.inner.ctx.session() else {
            return;
        };
        let pregame = match read_match(&session).await {
            Read::Match(pregame) => pregame,
            // Riot dropped us from the match (a dodge) before presence said so.
            Read::NotInPregame if self.current().is_some() => {
                self.leave_pregame();
                return;
            }
            Read::NotInPregame | Read::Failed => return,
        };
        let allies = pregame.ally_team.iter().flat_map(|team| &team.players);
        // Like the lobby: a player who hides their name is never looked up (party members
        // still show, as the party already knows them).
        let puuids: Vec<_> = allies
            .filter(|player| !player.player_identity.incognito)
            .filter_map(|player| player.subject.clone())
            .collect();
        self.inner.names.learn(&session, puuids).await;
        let index = self.inner.assets.index();
        let names = self.inner.names.snapshot();
        let party = self.inner.names.party();
        let context = PregameContext {
            index: &index,
            own: &session.puuid,
            names: &names,
            party: &party,
            now_ms: now_ms(),
        };
        let view = pregame_view(&pregame, &context);
        self.state().view = Some(view.clone());
        if view.is_own_locked {
            self.signal_lock_once(&MatchId::new(&view.match_id));
        }
        self.inner.ctx.bus.publish(AppEvent::Pregame(Some(view)));
    }

    fn signal_lock_once(&self, match_id: &MatchId) {
        let mut state = self.state();
        if state.lock_signalled.as_ref() == Some(match_id) {
            return;
        }
        state.lock_signalled = Some(match_id.clone());
        drop(state);
        self.inner.ctx.signal_flow(FlowSignal::OwnAgentLocked);
    }

    /// The match agent select is showing.
    fn current_match(&self) -> Result<(Arc<RiotSession>, MatchId), ActionError> {
        let session = self.inner.ctx.session().ok_or(ActionError::NotConnected)?;
        let match_id = self
            .state()
            .view
            .as_ref()
            .map(|view| MatchId::new(&view.match_id))
            .ok_or_else(|| ActionError::could_not("pick", "you are not in agent select"))?;
        Ok((session, match_id))
    }

    /// Hover an agent.
    pub async fn select(&self, agent_uuid: &str) -> Result<(), ActionError> {
        let (session, match_id) = self.current_match()?;
        let request = pregame::select_agent(&match_id, &AgentId::new(agent_uuid));
        send_ok(&session.http, &request, "select that agent").await?;
        self.poll().await;
        Ok(())
    }

    /// Lock an agent in.
    pub async fn lock(&self, agent_uuid: &str) -> Result<(), ActionError> {
        let (session, match_id) = self.current_match()?;
        let request = pregame::lock_agent(&match_id, &AgentId::new(agent_uuid));
        send_ok(&session.http, &request, "lock that agent").await?;
        self.signal_lock_once(&match_id);
        self.poll().await;
        Ok(())
    }

    /// Leave agent select (queue-dodge penalty applies).
    pub async fn dodge(&self) -> Result<(), ActionError> {
        let (session, match_id) = self.current_match()?;
        send_ok(
            &session.http,
            &pregame::quit_match(&match_id),
            "leave the match",
        )
        .await?;
        Ok(())
    }
}

/// Wall-clock epoch milliseconds, for timers the UI renders.
pub fn now_ms() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0.0, |since| since.as_secs_f64() * 1000.0)
}

/// One read of agent select.
enum Read {
    Match(Box<PregameMatch>),
    /// Riot says the player is in no pregame match (404 or no match id).
    NotInPregame,
    /// Could not tell (timeout, server error, odd body): keep what we have.
    Failed,
}

/// HTTP status for "this player has no pregame match".
const NOT_FOUND: u16 = 404;

async fn read_match(session: &RiotSession) -> Read {
    let reply = session
        .http
        .send(&pregame::get_player(&session.puuid))
        .await;
    if reply.status == NOT_FOUND {
        return Read::NotInPregame;
    }
    if !reply.is_success() {
        return Read::Failed;
    }
    let Ok(link) = reply.json::<PhaseLink>("pregame player") else {
        return Read::Failed;
    };
    let Some(match_id) = link.match_id.filter(|id| !id.is_empty()) else {
        return Read::NotInPregame;
    };
    match session
        .http
        .send_json::<PregameMatch>(&pregame::get_match(&match_id))
        .await
    {
        Ok(pregame) => Read::Match(Box::new(pregame)),
        Err(error) => {
            tracing::warn!(%error, "pregame_match_undecodable");
            Read::Failed
        }
    }
}
