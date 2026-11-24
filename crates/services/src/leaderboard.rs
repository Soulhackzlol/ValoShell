//! The competitive leaderboard of the player's region for the active act: the top players and,
//! when the player is ranked below them, their own line.
//!
//! The leaderboard endpoint is UNVERIFIED on 13.08 (see `riot::api::pd::leaderboard`), so a
//! failed read is an ordinary error the page shows, never a crash.

use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use domain::ids::Puuid;
use domain::region::Region;
use riot::api::pd::leaderboard::{
    Affinity, Leaderboard, LeaderboardPage, LeaderboardPlayer, get_leaderboard,
};
use riot::api::shared::{Content, get_content};
use serde::Serialize;
use ts_rs::TS;

use crate::action::{ActionError, fetch_json};
use crate::assets::{AssetIndex, AssetStore, image_url};
use crate::career::CareerService;
use crate::ctx::Ctx;
use crate::party::{RankBadge, rank_badge};

const VIEW_TTL: Duration = Duration::from_secs(5 * 60);
const ROWS_SHOWN: u32 = 50;
const LEADERBOARD_READ: &str = "load the leaderboard";
const PBE_SHARD: &str = "pbe";

/// One ranked player.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct LeaderboardRow {
    pub rank: u32,
    /// Empty for players who hide their name (`is_anonymized`).
    pub game_name: String,
    pub tag_line: String,
    pub is_anonymized: bool,
    pub is_self: bool,
    pub rr: u32,
    pub wins: u32,
    pub tier: RankBadge,
    pub card_small: Option<String>,
}

/// The leaderboard page.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct LeaderboardView {
    /// `EU`, `NA`, `LATAM`, `BR`, `AP` or `KR`.
    pub region: String,
    pub total_players: u32,
    pub rows: Vec<LeaderboardRow>,
    /// The player's line when they are ranked below the rows shown.
    pub own_row: Option<LeaderboardRow>,
}

/// The leaderboard a region is ranked on; `None` where there is none (PBE).
pub fn affinity_of(region: &Region) -> Option<(Affinity, &'static str)> {
    // PBE reports the `na` region (it uses the NA game servers) on a shard of its own.
    if region.shard == PBE_SHARD {
        return None;
    }
    match region.region.as_str() {
        "eu" => Some((Affinity::Eu, "EU")),
        "na" => Some((Affinity::Na, "NA")),
        "latam" => Some((Affinity::Latam, "LATAM")),
        "br" => Some((Affinity::Br, "BR")),
        "ap" => Some((Affinity::Ap, "AP")),
        "kr" => Some((Affinity::Kr, "KR")),
        _ => None,
    }
}

/// Empty when hidden, so a hidden name never crosses to the UI whatever Riot sends with it.
fn unless_hidden(is_hidden: bool, text: &str) -> String {
    if is_hidden {
        String::new()
    } else {
        text.to_owned()
    }
}

fn row(index: &AssetIndex, player: &LeaderboardPlayer, own: &Puuid) -> LeaderboardRow {
    let card = index.player_card(&player.player_card_id);
    LeaderboardRow {
        rank: player.leaderboard_rank,
        game_name: unless_hidden(player.is_anonymized, &player.game_name),
        tag_line: unless_hidden(player.is_anonymized, &player.tag_line),
        is_anonymized: player.is_anonymized,
        is_self: player.puuid.as_ref() == Some(own),
        rr: player.ranked_rating,
        wins: player.number_of_wins,
        tier: rank_badge(index, player.competitive_tier),
        card_small: card.and_then(|card| card.small_art.as_deref().map(image_url)),
    }
}

/// What the view is built from besides the asset index.
pub struct LeaderboardInputs<'a> {
    /// `EU`, `NA`, `LATAM`, `BR`, `AP` or `KR`.
    pub region: &'a str,
    pub top: &'a Leaderboard,
    /// The page holding the player's own line, when it was read.
    pub own_page: Option<&'a Leaderboard>,
    pub own: &'a Puuid,
}

/// Build the view from the top page and, if read, the page holding the player's own line.
pub fn leaderboard_view(index: &AssetIndex, inputs: &LeaderboardInputs<'_>) -> LeaderboardView {
    let own = inputs.own;
    let rows: Vec<LeaderboardRow> = inputs
        .top
        .players
        .iter()
        .map(|player| row(index, player, own))
        .collect();
    let is_listed = rows.iter().any(|row| row.is_self);
    let own_row = inputs
        .own_page
        .filter(|_| !is_listed)
        .and_then(|page| {
            page.players
                .iter()
                .find(|player| player.puuid.as_ref() == Some(own))
        })
        .map(|player| row(index, player, own));
    LeaderboardView {
        region: inputs.region.to_owned(),
        total_players: inputs.top.total_players,
        rows,
        own_row,
    }
}

/// Cheap to clone.
#[derive(Clone)]
pub struct LeaderboardService {
    ctx: Ctx,
    assets: AssetStore,
    career: CareerService,
    last: Arc<Mutex<Option<(Instant, Puuid, LeaderboardView)>>>,
}

impl LeaderboardService {
    pub fn new(ctx: Ctx, assets: AssetStore, career: CareerService) -> Self {
        Self {
            ctx,
            assets,
            career,
            last: Arc::new(Mutex::new(None)),
        }
    }

    /// The leaderboard, reusing a recent answer unless `is_forced`.
    pub async fn view(&self, is_forced: bool) -> Result<LeaderboardView, ActionError> {
        let session = self.ctx.session().ok_or(ActionError::NotConnected)?;
        if !is_forced && let Some(view) = self.fresh(&session.puuid) {
            return Ok(view);
        }
        let (affinity, region) = affinity_of(session.http.region()).ok_or_else(|| {
            ActionError::could_not(LEADERBOARD_READ, "this region has no leaderboard")
        })?;
        let content: Content = fetch_json(&session, &get_content(), LEADERBOARD_READ).await?;
        let act = content.active_act_id().unwrap_or_default().to_owned();
        let top_page = LeaderboardPage {
            size: ROWS_SHOWN,
            ..LeaderboardPage::default()
        };
        let top: Leaderboard = fetch_json(
            &session,
            &get_leaderboard(affinity, &act, &top_page),
            LEADERBOARD_READ,
        )
        .await?;
        let own_page = self.own_page(&session, affinity, &act).await;
        let inputs = LeaderboardInputs {
            region,
            top: &top,
            own_page: own_page.as_ref(),
            own: &session.puuid,
        };
        let view = leaderboard_view(&self.assets.index(), &inputs);
        *self.last.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), session.puuid.clone(), view.clone()));
        Ok(view)
    }

    /// The one-line page at the player's own rank, when that rank is below the rows shown.
    async fn own_page(
        &self,
        session: &riot::session::RiotSession,
        affinity: Affinity,
        act: &str,
    ) -> Option<Leaderboard> {
        let own_rank = self.career.view(false).await.ok()?.leaderboard_rank;
        if own_rank <= ROWS_SHOWN {
            return None;
        }
        let page = LeaderboardPage {
            start_index: own_rank - 1,
            size: 1,
            name_query: None,
        };
        fetch_json(
            session,
            &get_leaderboard(affinity, act, &page),
            LEADERBOARD_READ,
        )
        .await
        .inspect_err(|error| tracing::debug!(%error, "leaderboard_own_page_failed"))
        .ok()
    }

    fn fresh(&self, puuid: &Puuid) -> Option<LeaderboardView> {
        let last = self.last.lock().unwrap_or_else(PoisonError::into_inner);
        last.as_ref()
            .filter(|(at, owner, _)| at.elapsed() < VIEW_TTL && owner == puuid)
            .map(|(_, _, view)| view.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetSource, fixtures};

    fn player(rank: u32, puuid: &str, name: &str) -> LeaderboardPlayer {
        LeaderboardPlayer {
            puuid: Some(Puuid::new(puuid)),
            game_name: name.to_owned(),
            tag_line: "EUW".to_owned(),
            leaderboard_rank: rank,
            ranked_rating: 900 - rank,
            competitive_tier: 24,
            ..LeaderboardPlayer::default()
        }
    }

    fn board(players: Vec<LeaderboardPlayer>) -> Leaderboard {
        Leaderboard {
            players,
            total_players: 15_000,
            ..Leaderboard::default()
        }
    }

    fn view(top: &Leaderboard, own_page: Option<&Leaderboard>) -> LeaderboardView {
        let index = AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache);
        let own = Puuid::new("me");
        let inputs = LeaderboardInputs {
            region: "EU",
            top,
            own_page,
            own: &own,
        };
        leaderboard_view(&index, &inputs)
    }

    #[test]
    fn shards_map_to_leaderboard_regions() {
        let region = |raw| Region::resolve(raw).expect("known region");

        assert_eq!(
            affinity_of(&region("eu")).map(|(_, label)| label),
            Some("EU")
        );
        assert_eq!(
            affinity_of(&region("na")).map(|(_, label)| label),
            Some("NA")
        );
        assert_eq!(
            affinity_of(&region("br")).map(|(_, label)| label),
            Some("BR")
        );
        assert_eq!(
            affinity_of(&region("latam")).map(|(_, label)| label),
            Some("LATAM")
        );
        assert_eq!(affinity_of(&region("pbe")), None);
    }

    #[test]
    fn rows_keep_riot_order_and_mark_the_player() {
        let top = board(vec![player(1, "a", "Neo"), player(2, "me", "Me")]);

        let view = view(&top, None);

        assert_eq!(view.rows[0].game_name, "Neo");
        assert_eq!(view.rows[0].tier.tier, 24);
        assert!(view.rows[1].is_self);
        assert_eq!(view.own_row, None);
        assert_eq!(view.total_players, 15_000);
    }

    #[test]
    fn hidden_names_never_reach_the_view() {
        let mut hidden = player(1, "a", "Neo");
        hidden.is_anonymized = true;

        let view = view(&board(vec![hidden]), None);

        assert_eq!(
            (
                view.rows[0].game_name.as_str(),
                view.rows[0].tag_line.as_str()
            ),
            ("", "")
        );
        assert!(view.rows[0].is_anonymized);
    }

    #[test]
    fn own_row_comes_from_its_page_when_not_listed() {
        let top = board(vec![player(1, "a", "Neo")]);
        let own_page = board(vec![player(812, "me", "Me")]);

        let view = view(&top, Some(&own_page));

        let own = view.own_row.expect("own row");
        assert_eq!((own.rank, own.is_self), (812, true));
    }
}
