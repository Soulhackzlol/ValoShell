//! Party service: keeps the lobby view current from party websocket events
//! and runs the party actions the home scene offers (queue, ready, invites, open/closed).

mod custom;
mod view;

use std::sync::{Arc, Mutex, PoisonError};
use std::time::Duration;

use domain::ids::{PartyId, Puuid};
use domain::phase::Phase;
use riot::Request;
use riot::api::glz::party::{self, Accessibility};
use riot::api::glz::party_dto::{Party, PartyPlayer};
use riot::api::glz::{custom_game, matchmaking, party_member};
use riot::api::local::events::UriKind;
use riot::session::RiotSession;
use tokio::sync::broadcast::error::RecvError;
use tokio_util::sync::CancellationToken;

pub use custom::{CustomLobbyView, LobbyTeam};
pub use view::{MemberView, PartyView, QueueOption, RankBadge, queue_option, rank_badge};
use view::{ViewContext, party_view};

use crate::action::{ActionError, fetch_json, send_ok};
use crate::assets::AssetStore;
use crate::ctx::Ctx;
use crate::event::AppEvent;
use crate::names::NameBook;

/// Riot repeats party events in bursts; refresh once after the burst.
const DEBOUNCE: Duration = Duration::from_millis(300);
/// Riot's party record catches up a little after the phase change back to the menus.
const SETTLE_AFTER_MATCH: Duration = Duration::from_secs(3);
/// Safety net for missed events (queue timer, eligibility changes).
const RESYNC_INTERVAL: Duration = Duration::from_secs(20);

#[derive(Default)]
struct PartyState {
    view: Option<PartyView>,
    party_id: Option<PartyId>,
}

struct Inner {
    ctx: Ctx,
    assets: AssetStore,
    names: NameBook,
    state: Mutex<PartyState>,
}

/// Cheap to clone; commands and the background task share one.
#[derive(Clone)]
pub struct PartyService {
    inner: Arc<Inner>,
}

impl PartyService {
    pub fn new(ctx: Ctx, assets: AssetStore, names: NameBook) -> Self {
        Self {
            inner: Arc::new(Inner {
                ctx,
                assets,
                names,
                state: Mutex::new(PartyState::default()),
            }),
        }
    }

    fn state(&self) -> std::sync::MutexGuard<'_, PartyState> {
        self.inner
            .state
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
    }

    /// The last published view (the UI's initial read).
    pub fn current(&self) -> Option<PartyView> {
        self.state().view.clone()
    }

    fn session(&self) -> Result<Arc<RiotSession>, ActionError> {
        self.inner.ctx.session().ok_or(ActionError::NotConnected)
    }

    /// Background task: refresh on party events, phase changes and a slow resync tick.
    pub async fn run(self, stop: CancellationToken) {
        let mut events = self.inner.ctx.riot_events();
        let mut game = self.inner.ctx.game();
        let mut resync = tokio::time::interval(RESYNC_INTERVAL);
        let mut last_phase = game.borrow().phase;
        loop {
            let is_wanted = tokio::select! {
                () = stop.cancelled() => return,
                event = events.recv() => match event {
                    Ok(event) => matches!(event.kind, UriKind::Party | UriKind::OutOfSync),
                    Err(RecvError::Lagged(_)) => true,
                    Err(RecvError::Closed) => return,
                },
                changed = game.changed() => {
                    if changed.is_err() {
                        return;
                    }
                    let phase = game.borrow_and_update().phase;
                    if phase == Phase::Menus && last_phase != Phase::Menus {
                        self.on_back_in_menus(&stop).await;
                    }
                    last_phase = phase;
                    true
                },
                _ = resync.tick() => game.borrow().phase == Phase::Menus,
            };
            if is_wanted {
                tokio::time::sleep(DEBOUNCE).await;
                while events.try_recv().is_ok() {}
                self.refresh_quietly().await;
            }
        }
    }

    /// Back from a match (or agent select): Riot may have moved the player to a new party and
    /// its party record trails the phase change, so drop the old id and read it again shortly.
    async fn on_back_in_menus(&self, stop: &CancellationToken) {
        self.forget_party();
        self.refresh_quietly().await;
        tokio::select! {
            () = stop.cancelled() => {}
            () = tokio::time::sleep(SETTLE_AFTER_MATCH) => {}
        }
    }

    async fn refresh_quietly(&self) {
        if self.inner.ctx.session().is_none() {
            self.publish(None);
            return;
        }
        if let Err(error) = self.refresh().await {
            tracing::debug!(%error, "party_refresh_failed");
        }
    }

    /// Fetch the party now and publish it.
    pub async fn refresh(&self) -> Result<Option<PartyView>, ActionError> {
        let session = self.session()?;
        let player: PartyPlayer = fetch_json(
            &session,
            &party::get_player_party(&session.puuid),
            "read your party",
        )
        .await?;
        let party_id = player
            .current_party_id
            .ok_or_else(|| ActionError::could_not("read your party", "you are not in one yet"))?;
        let party: Party =
            fetch_json(&session, &party::get_party(&party_id), "read your party").await?;
        Ok(self.apply(&session, &party).await)
    }

    async fn apply(&self, session: &RiotSession, party: &Party) -> Option<PartyView> {
        let members: Vec<_> = party
            .members
            .iter()
            .filter_map(|member| member.subject.clone())
            .collect();
        self.inner.names.set_party(members.iter().cloned());
        self.inner.names.learn(session, members).await;
        let index = self.inner.assets.index();
        let names = self.inner.names.snapshot();
        let context = ViewContext {
            index: &index,
            own: &session.puuid,
            names: &names,
        };
        let view = party_view(party, &context);
        self.state().party_id.clone_from(&party.id);
        self.publish(view.clone());
        view
    }

    fn publish(&self, view: Option<PartyView>) {
        let mut state = self.state();
        if state.view == view {
            return;
        }
        if view.is_none() {
            state.party_id = None;
            self.inner.names.set_party([]);
        }
        state.view.clone_from(&view);
        drop(state);
        self.inner.ctx.bus.publish(AppEvent::Party(view));
    }

    async fn party_id(&self) -> Result<PartyId, ActionError> {
        if let Some(id) = self.state().party_id.clone() {
            return Ok(id);
        }
        self.refresh().await?;
        self.state()
            .party_id
            .clone()
            .ok_or_else(|| ActionError::could_not("find your party", "it is not loaded yet"))
    }

    /// Send a party mutation; its answer is the new party when Riot includes one.
    async fn mutate(&self, request: Request, what: &str) -> Result<(), ActionError> {
        let session = self.session()?;
        let reply = send_ok(&session.http, &request, what).await?;
        match serde_json::from_str::<Party>(&reply.body) {
            Ok(party) if party.id.is_some() => {
                self.apply(&session, &party).await;
            }
            _ => self.refresh_quietly().await,
        }
        Ok(())
    }

    /// Forget the party id, so the next action looks it up fresh.
    fn forget_party(&self) {
        self.state().party_id = None;
    }

    /// Run a mutation on the current party. Riot can move the player to a new party (after a
    /// match, a kick, a join): when the mutation fails, look the party up again and retry once
    /// if it changed, instead of failing on the old id forever.
    async fn in_party(
        &self,
        build: impl Fn(&PartyId) -> Request,
        what: &str,
    ) -> Result<(), ActionError> {
        let id = self.party_id().await?;
        let Err(error) = self.mutate(build(&id), what).await else {
            return Ok(());
        };
        self.forget_party();
        let fresh = self.party_id().await?;
        if fresh == id {
            return Err(error);
        }
        tracing::info!("party_changed_retrying");
        self.mutate(build(&fresh), what).await
    }

    /// Pick the party's queue (owner only). `custom` opens the custom lobby; any other queue
    /// picked from the custom lobby turns the party back into a matchmaking one.
    pub async fn change_queue(&self, queue_id: &str) -> Result<(), ActionError> {
        let is_custom_now = self
            .state()
            .view
            .as_ref()
            .is_some_and(|view| view.is_custom_game);
        if queue_id == view::CUSTOM_QUEUE {
            return self
                .in_party(custom_game::make_custom_game, "open a custom game")
                .await;
        }
        if is_custom_now {
            return self
                .in_party(
                    |id| custom_game::convert_to_default(id, queue_id),
                    "leave the custom game",
                )
                .await;
        }
        self.in_party(
            |id| matchmaking::change_queue(id, queue_id),
            "change the queue",
        )
        .await
    }

    /// Start searching.
    pub async fn start_queue(&self) -> Result<(), ActionError> {
        self.in_party(matchmaking::join_matchmaking, "start the queue")
            .await
    }

    /// Cancel the search.
    pub async fn stop_queue(&self) -> Result<(), ActionError> {
        self.in_party(matchmaking::leave_matchmaking, "cancel the queue")
            .await
    }

    /// Own ready flag.
    pub async fn set_ready(&self, is_ready: bool) -> Result<(), ActionError> {
        let own = self.session()?.puuid.clone();
        self.in_party(
            |id| party_member::set_ready(id, &own, is_ready),
            "change ready state",
        )
        .await
    }

    /// Open the party to friends or close it.
    pub async fn set_open(&self, is_open: bool) -> Result<(), ActionError> {
        let accessibility = if is_open {
            Accessibility::Open
        } else {
            Accessibility::Closed
        };
        self.in_party(
            |id| party::set_accessibility(id, accessibility),
            "change who can join",
        )
        .await
    }

    /// Invite by `Name#Tag`.
    pub async fn invite(&self, riot_id: &str) -> Result<(), ActionError> {
        let (name, tag) = riot_id
            .rsplit_once('#')
            .filter(|(name, tag)| !name.trim().is_empty() && !tag.trim().is_empty())
            .ok_or_else(|| ActionError::could_not("invite", "type the Riot ID as Name#Tag"))?;
        self.in_party(
            |id| party::invite_by_riot_id(id, name.trim(), tag.trim()),
            "send the invite",
        )
        .await
    }

    /// Owner removes a member.
    pub async fn kick(&self, member: &str) -> Result<(), ActionError> {
        self.mutate(party::kick_member(&Puuid::new(member)), "remove the player")
            .await
    }

    /// Leave and start a fresh solo party.
    pub async fn leave(&self) -> Result<(), ActionError> {
        let own = self.session()?.puuid.clone();
        self.mutate(party::leave_party(&own), "leave the party")
            .await
    }

    /// Move a player to a custom-lobby column: `attackers`, `defenders` or `spectators`.
    pub async fn change_team(&self, team: &str, puuid: &str) -> Result<(), ActionError> {
        let team = LobbyTeam::parse(team).ok_or_else(|| {
            ActionError::could_not("change team", "pick attackers, defenders or spectators")
        })?;
        let player = Puuid::new(puuid);
        self.in_party(
            |id| custom_game::change_team(id, team.riot_team(), &player),
            "change team",
        )
        .await
    }

    /// Start the custom game (owner only).
    pub async fn start_custom_game(&self) -> Result<(), ActionError> {
        self.in_party(custom_game::start_custom_game, "start the custom game")
            .await
    }

    /// Create a shareable party code.
    pub async fn generate_code(&self) -> Result<(), ActionError> {
        self.in_party(party::generate_invite_code, "create a party code")
            .await
    }

    /// Join the party that owns `code`.
    pub async fn join_by_code(&self, code: &str) -> Result<(), ActionError> {
        let code = code.trim();
        if code.is_empty() {
            return Err(ActionError::could_not("join", "type a party code"));
        }
        self.mutate(party::join_by_code(code), "join with that code")
            .await
    }
}
