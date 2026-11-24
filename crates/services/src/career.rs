//! Career: current rank and RR, the act's record, peak rank this act,
//! and the RR history of recent ranked matches.

use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use domain::ids::Puuid;
use domain::static_data::map_by_map_id_path;
use riot::CachePolicy;
use riot::api::pd::history::IndexWindow;
use riot::api::pd::mmr::{
    CompetitiveUpdate, CompetitiveUpdates, MmrPlayer, get_competitive_updates, get_player_mmr,
};
use riot::api::pd::premier::{
    PremierPlayer, PremierRoster, get_premier_player, get_premier_roster,
};
use riot::session::RiotSession;
use serde::Serialize;
use ts_rs::TS;

use crate::action::{ActionError, fetch_json};
use crate::assets::{AssetIndex, AssetStore, image_url};
use crate::ctx::Ctx;
use crate::party::{RankBadge, rank_badge};

const VIEW_TTL: Duration = Duration::from_secs(90);
const COMPETITIVE: &str = "competitive";
const UPDATES_SHOWN: u32 = 20;
const CAREER_READ: &str = "load your career";

/// RR change of one ranked match.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RrUpdate {
    pub match_id: String,
    pub map_name: String,
    pub map_image: Option<String>,
    /// Epoch ms.
    #[ts(type = "number")]
    pub started_at_ms: i64,
    pub rr_earned: i32,
    pub rr_after: i32,
    pub rank_after: RankBadge,
    pub is_promotion: bool,
    pub is_demotion: bool,
    pub afk_penalty: i32,
}

/// The player's Premier team, as the client's Career page shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct PremierTeam {
    pub name: String,
    pub tag: String,
    pub is_enrolled: bool,
    pub division: u32,
    pub wins: u32,
    pub games: u32,
}

impl PremierTeam {
    fn from_roster(roster: PremierRoster) -> Self {
        Self {
            name: roster.name,
            tag: roster.tag,
            is_enrolled: roster.season.is_enrolled,
            division: roster.season.division,
            wins: roster.season.wins,
            games: roster.season.games_played,
        }
    }
}

/// The career scene.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct CareerView {
    pub rank: RankBadge,
    pub rr: u32,
    /// 0 when not on the leaderboard.
    pub leaderboard_rank: u32,
    pub wins: u32,
    pub games: u32,
    /// Highest tier with a win this act.
    pub peak: Option<RankBadge>,
    /// Ranked games still needed before a rank is shown.
    pub placements_left: u32,
    pub updates: Vec<RrUpdate>,
    /// None without a team (or when Premier can't be read right now).
    pub premier: Option<PremierTeam>,
}

fn rr_update(index: &AssetIndex, update: &CompetitiveUpdate) -> RrUpdate {
    let internal_id = update.map_id.rsplit('/').nth(1).unwrap_or_default();
    let map = index.map_by_internal_id(internal_id);
    let tier_after = u32::try_from(update.tier_after_update).unwrap_or(0);
    RrUpdate {
        match_id: update
            .match_id
            .as_ref()
            .map(ToString::to_string)
            .unwrap_or_default(),
        map_name: map
            .as_ref()
            .map(|map| map.display_name.clone())
            .or_else(|| map_by_map_id_path(&update.map_id).map(|entry| entry.display_name()))
            .unwrap_or_else(|| "Unknown map".to_owned()),
        map_image: map.and_then(|map| map.list_view_icon.as_deref().map(image_url)),
        started_at_ms: update.match_start_time,
        rr_earned: update.ranked_rating_earned,
        rr_after: update.ranked_rating_after_update,
        rank_after: rank_badge(index, tier_after),
        is_promotion: update.tier_after_update > update.tier_before_update,
        is_demotion: update.tier_after_update < update.tier_before_update,
        afk_penalty: update.afk_penalty,
    }
}

/// Build the view. The act is the one of the latest ranked match (the act the player is in).
pub fn career_view(
    index: &AssetIndex,
    mmr: &MmrPlayer,
    updates: &CompetitiveUpdates,
) -> CareerView {
    let season_id = mmr
        .latest_competitive_update
        .as_ref()
        .map(|update| update.season_id.clone())
        .or_else(|| {
            updates
                .matches
                .first()
                .map(|update| update.season_id.clone())
        })
        .unwrap_or_default();
    let season = mmr.seasonal_info(COMPETITIVE, &season_id);
    let tier = season.map_or(0, |info| info.competitive_tier);
    let peak = season.and_then(|info| {
        info.wins_by_tier
            .keys()
            .filter_map(|tier| tier.parse::<u32>().ok())
            .max()
            .map(|tier| rank_badge(index, tier))
    });
    CareerView {
        rank: rank_badge(index, tier),
        rr: season.map_or(0, |info| info.ranked_rating),
        leaderboard_rank: season.map_or(0, |info| info.leaderboard_rank),
        wins: season.map_or(0, |info| {
            info.number_of_wins_with_placements.max(info.number_of_wins)
        }),
        games: season.map_or(0, |info| info.number_of_games),
        peak,
        placements_left: mmr
            .queue_skills
            .get(COMPETITIVE)
            .map_or(0, |skill| skill.current_season_games_needed_for_rating),
        updates: updates
            .matches
            .iter()
            .map(|update| rr_update(index, update))
            .collect(),
        premier: None,
    }
}

/// Premier is decoration on the Career page: a failed read shows "no team" rather than failing
/// the whole page.
async fn read_premier(session: &RiotSession) -> Option<PremierTeam> {
    let player_request = get_premier_player(&session.puuid);
    let player: PremierPlayer = fetch_optional(session, &player_request, "premier_player").await?;
    let roster_request = get_premier_roster(player.team()?);
    let roster: PremierRoster = fetch_optional(session, &roster_request, "premier_roster").await?;
    Some(PremierTeam::from_roster(roster))
}

/// HTTP status Riot answers for a player who never opened Premier: an expected "no team".
const NOT_FOUND: u16 = 404;

/// `endpoint` is a fixed label for the logs: the request path holds the player's puuid.
async fn fetch_optional<T: serde::de::DeserializeOwned>(
    session: &RiotSession,
    request: &riot::http::Request,
    endpoint: &'static str,
) -> Option<T> {
    let fetched = session
        .gate
        .fetch(&session.http, request, CachePolicy::Fresh)
        .await;
    if !fetched.is_complete {
        if fetched.status == NOT_FOUND {
            tracing::debug!(endpoint, "premier_not_found");
        } else {
            tracing::warn!(endpoint, status = fetched.status, "premier_unavailable");
        }
        return None;
    }
    serde_json::from_value(fetched.data)
        .map_err(|error| tracing::warn!(endpoint, %error, "premier_unreadable"))
        .ok()
}

/// Cheap to clone.
#[derive(Clone)]
pub struct CareerService {
    ctx: Ctx,
    assets: AssetStore,
    /// Keyed by account: after switching accounts the other one's career is never reused.
    last: Arc<Mutex<Option<(Instant, Puuid, CareerView)>>>,
}

impl CareerService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            last: Arc::new(Mutex::new(None)),
        }
    }

    /// The career, reusing a recent answer unless `is_forced`.
    pub async fn view(&self, is_forced: bool) -> Result<CareerView, ActionError> {
        let session = self.ctx.session().ok_or(ActionError::NotConnected)?;
        if !is_forced && let Some(view) = self.fresh(&session.puuid) {
            return Ok(view);
        }
        let mmr: MmrPlayer =
            fetch_json(&session, &get_player_mmr(&session.puuid), CAREER_READ).await?;
        let window = IndexWindow::new(0, UPDATES_SHOWN);
        let updates: CompetitiveUpdates = fetch_json(
            &session,
            &get_competitive_updates(&session.puuid, window, Some(COMPETITIVE)),
            CAREER_READ,
        )
        .await?;
        let mut view = career_view(&self.assets.index(), &mmr, &updates);
        view.premier = read_premier(&session).await;
        *self.last.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), session.puuid.clone(), view.clone()));
        Ok(view)
    }

    fn fresh(&self, puuid: &Puuid) -> Option<CareerView> {
        let last = self.last.lock().unwrap_or_else(PoisonError::into_inner);
        last.as_ref()
            .filter(|(at, owner, _)| at.elapsed() < VIEW_TTL && owner == puuid)
            .map(|(_, _, view)| view.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MMR: &str = include_str!("../../riot/src/api/pd/fixtures/mmr.json");

    fn view() -> CareerView {
        let mmr: MmrPlayer = serde_json::from_str(MMR).unwrap();
        let updates = CompetitiveUpdates {
            matches: mmr.latest_competitive_update.clone().into_iter().collect(),
            ..CompetitiveUpdates::default()
        };
        career_view(&AssetIndex::bundled(), &mmr, &updates)
    }

    #[test]
    fn current_act_rank_and_record_are_read() {
        let view = view();

        assert_eq!(view.rank.tier, 14);
        assert_eq!(view.rr, 37);
        assert_eq!(view.wins, 28);
        assert_eq!(view.games, 52);
        assert_eq!(view.placements_left, 0);
    }

    #[test]
    fn peak_is_the_highest_tier_with_a_win() {
        assert_eq!(view().peak.map(|peak| peak.tier), Some(14));
    }

    #[test]
    fn rr_updates_name_the_map_and_the_change() {
        let view = view();

        let update = &view.updates[0];
        assert_eq!(update.map_name, "Ascent");
        assert_eq!(update.rr_earned, -18);
        assert!(!update.is_promotion && !update.is_demotion);
    }

    #[test]
    fn a_premier_roster_becomes_the_team_card() {
        let body = r#"{"name":"SinMira","tag":"SM",
            "season":{"isEnrolled":true,"division":7,"wins":9,"gamesPlayed":12}}"#;
        let roster: PremierRoster = serde_json::from_str(body).unwrap();

        let team = PremierTeam::from_roster(roster);

        assert_eq!((team.name.as_str(), team.tag.as_str()), ("SinMira", "SM"));
        assert_eq!(
            (team.is_enrolled, team.division, team.wins, team.games),
            (true, 7, 9, 12)
        );
    }
}
