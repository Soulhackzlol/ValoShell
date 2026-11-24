//! Progress: account level, this act's battle pass (tier, XP left, next reward) and the active
//! daily and weekly missions with their names and goals from valorant-api.com, the agent
//! recruitment event and the agent contract levels.

mod recruitment;

use std::collections::HashSet;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use domain::ids::Puuid;
use riot::api::pd::account::{AccountXp, get_account_xp};
use riot::api::pd::contracts::{
    Contracts, Mission as RiotMission, get_active_recruitment_event, get_contracts,
};
use riot::api::pd::entitlements::ITEM_TYPE_CONTRACTS;
use riot::api::shared::{Content, get_content};
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::action::{ActionError, fetch_json};
use crate::assets::{AssetIndex, AssetStore, Contract, ContractReward, image_url};
use crate::collection::read_owned;
use crate::ctx::Ctx;

pub use recruitment::{AgentContractView, RecruitmentView, agent_contract_views, recruitment_view};

const VIEW_TTL: Duration = Duration::from_secs(90);
const PROGRESS_READ: &str = "load your progress";
const WEEKLY: &str = "Weekly";
const DAILY: &str = "Daily";

/// A battle pass reward, named and pictured.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RewardView {
    pub name: String,
    pub image: Option<String>,
}

/// This act's battle pass.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BattlePassView {
    /// `Season 2026 // Act V`.
    pub name: String,
    /// Tiers completed.
    pub tier: u32,
    /// Every tier, the epilogue included.
    pub tier_count: u32,
    /// XP still needed for the next tier; 0 once every tier is done.
    #[ts(type = "number")]
    pub xp_left: i64,
    /// When the act ends (ISO 8601), if known.
    pub ends_at: Option<String>,
    /// `None` when ownership could not be read.
    pub is_premium_owned: Option<bool>,
    /// What the next tier unlocks; `None` once every tier is done.
    pub next_reward: Option<RewardView>,
}

/// One active mission.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct MissionView {
    pub title: String,
    #[ts(type = "number")]
    pub done: i64,
    #[ts(type = "number")]
    pub goal: i64,
    #[ts(type = "number")]
    pub xp: i64,
    pub is_complete: bool,
}

/// The Progress page.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct ProgressView {
    pub account_level: u32,
    /// XP inside the current account level (5,000 per level).
    pub account_xp: u32,
    pub battle_pass: Option<BattlePassView>,
    pub weekly_missions: Vec<MissionView>,
    pub daily_missions: Vec<MissionView>,
    /// When the weekly missions refill (ISO 8601); empty when Riot did not say.
    pub weekly_refill_at: String,
    /// The agent recruitment event running now, if any.
    pub recruitment: Option<RecruitmentView>,
    /// Agent contracts with progress, highest level first.
    pub agent_contracts: Vec<AgentContractView>,
}

/// What the view is built from besides the asset index.
pub struct ProgressInputs<'a> {
    pub contracts: &'a Contracts,
    pub account: &'a AccountXp,
    /// The active act; empty when the content service did not answer.
    pub act_id: &'a str,
    /// Owned contract ids (lowercase); `None` when they could not be read.
    pub owned_contracts: Option<&'a HashSet<String>>,
    /// The recruitment event body; `None` when it could not be read.
    pub recruitment_event: Option<&'a Value>,
}

/// The first picture there is, in order of preference.
fn first_art(candidates: &[&Option<String>]) -> Option<String> {
    candidates.iter().find_map(|art| art.as_ref()).cloned()
}

/// Name and picture of a cosmetic reward; skin levels fall back to their skin's art.
fn cosmetic_reward(
    index: &AssetIndex,
    reward_type: &str,
    id: &str,
) -> Option<(String, Option<String>)> {
    match reward_type {
        "EquippableSkinLevel" => {
            let level = index.skin_level(id)?;
            let skin_icon = index
                .skin_of_level(id)
                .and_then(|skin| skin.display_icon.clone());
            Some((
                level.display_name.clone(),
                first_art(&[&level.display_icon, &skin_icon]),
            ))
        }
        "EquippableCharmLevel" => index
            .buddy_level(id)
            .map(|level| (level.display_name.clone(), level.display_icon.clone())),
        "PlayerCard" => index.player_card(id).map(|card| {
            (
                card.display_name.clone(),
                first_art(&[&card.large_art, &card.display_icon]),
            )
        }),
        "Spray" => index.spray(id).map(|spray| {
            let image = first_art(&[&spray.full_transparent_icon, &spray.display_icon]);
            (spray.display_name.clone(), image)
        }),
        // Battle pass "Totem" rewards are flex items.
        "Totem" => index
            .flex(id)
            .map(|flex| (flex.display_name.clone(), flex.display_icon.clone())),
        _ => None,
    }
}

/// Name and picture of one reward; `None` for kinds the asset cache does not describe.
pub fn reward_view(index: &AssetIndex, reward: &ContractReward) -> Option<RewardView> {
    let id = reward.uuid.as_str();
    let (name, image) = match reward.reward_type.as_str() {
        "Title" => index.player_title(id).map(|title| {
            let text = title.title_text.clone();
            (text.unwrap_or_else(|| title.display_name.clone()), None)
        })?,
        "Currency" => index.currency(id).map(|currency| {
            let image = first_art(&[&currency.large_icon, &currency.display_icon]);
            (
                format!("{} {}", reward.amount, currency.display_name),
                image,
            )
        })?,
        other => cosmetic_reward(index, other, id)?,
    };
    Some(RewardView {
        name,
        image: image.as_deref().map(image_url),
    })
}

fn battle_pass_view(
    index: &AssetIndex,
    pass: &Contract,
    inputs: &ProgressInputs<'_>,
) -> BattlePassView {
    let levels: Vec<_> = pass
        .content
        .chapters
        .iter()
        .flat_map(|chapter| &chapter.levels)
        .collect();
    let progress = inputs.contracts.progress_of(&pass.uuid);
    let tier = progress.map_or(0, |progress| progress.progression_level_reached);
    let next = usize::try_from(tier).ok().and_then(|tier| levels.get(tier));
    let towards_next = progress.map_or(0, |progress| progress.progression_towards_next_level);
    BattlePassView {
        name: pass.display_name.clone(),
        tier,
        tier_count: u32::try_from(levels.len()).unwrap_or(u32::MAX),
        xp_left: next.map_or(0, |level| (level.xp - towards_next).max(0)),
        ends_at: index
            .season(inputs.act_id)
            .and_then(|act| act.end_time.clone()),
        is_premium_owned: inputs
            .owned_contracts
            .map(|owned| owned.contains(&pass.uuid.to_lowercase())),
        next_reward: next.and_then(|level| reward_view(index, &level.reward)),
    }
}

/// One mission as the page lists it; `None` for missions valorant-api.com does not describe.
fn mission_view(index: &AssetIndex, mission: &RiotMission) -> Option<(String, MissionView)> {
    let definition = index.mission(&mission.id)?;
    let kind = definition.mission_type.clone().unwrap_or_default();
    let objective = definition.objectives.first();
    let goal = match definition.progress_to_complete {
        0 => objective.map_or(1, |objective| objective.value.max(1)),
        goal => goal,
    };
    let progress = objective.and_then(|objective| {
        mission
            .objectives
            .iter()
            .find(|(id, _)| id.eq_ignore_ascii_case(&objective.objective_uuid))
            .map(|(_, done)| *done)
    });
    let done = if mission.complete {
        goal
    } else {
        progress.unwrap_or(0).clamp(0, goal)
    };
    let view = MissionView {
        title: definition.title.clone().unwrap_or_default(),
        done,
        goal,
        xp: definition.xp_grant,
        is_complete: mission.complete,
    };
    Some((kind, view))
}

/// Build the view. Missions of other kinds (tutorial, new-player) are left out.
pub fn progress_view(index: &AssetIndex, inputs: &ProgressInputs<'_>) -> ProgressView {
    let mut weekly_missions = Vec::new();
    let mut daily_missions = Vec::new();
    for (kind, view) in inputs
        .contracts
        .missions
        .iter()
        .filter_map(|mission| mission_view(index, mission))
    {
        if kind.ends_with(WEEKLY) {
            weekly_missions.push(view);
        } else if kind.ends_with(DAILY) {
            daily_missions.push(view);
        }
    }
    ProgressView {
        account_level: inputs.account.progress.level,
        account_xp: inputs.account.progress.xp,
        battle_pass: index
            .battle_pass_of_act(inputs.act_id)
            .map(|pass| battle_pass_view(index, &pass, inputs)),
        weekly_missions,
        daily_missions,
        weekly_refill_at: inputs.contracts.mission_metadata.weekly_refill_time.clone(),
        recruitment: inputs
            .recruitment_event
            .and_then(|event| recruitment_view(index, event, inputs.contracts)),
        agent_contracts: agent_contract_views(index, inputs.contracts),
    }
}

/// Cheap to clone.
#[derive(Clone)]
pub struct ProgressService {
    ctx: Ctx,
    assets: AssetStore,
    last: Arc<Mutex<Option<(Instant, Puuid, ProgressView)>>>,
}

impl ProgressService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            last: Arc::new(Mutex::new(None)),
        }
    }

    /// The progress, reusing a recent answer unless `is_forced`.
    pub async fn view(&self, is_forced: bool) -> Result<ProgressView, ActionError> {
        let session = self.ctx.session().ok_or(ActionError::NotConnected)?;
        if !is_forced && let Some(view) = self.fresh(&session.puuid) {
            return Ok(view);
        }
        let contracts_request = get_contracts(&session.puuid);
        let account_request = get_account_xp(&session.puuid);
        let content_request = get_content();
        let recruitment_request = get_active_recruitment_event();
        let (contracts, account, content, owned, recruitment) = tokio::join!(
            fetch_json::<Contracts>(&session, &contracts_request, PROGRESS_READ),
            fetch_json::<AccountXp>(&session, &account_request, PROGRESS_READ),
            fetch_json::<Content>(&session, &content_request, PROGRESS_READ),
            read_owned(&session, ITEM_TYPE_CONTRACTS),
            fetch_json::<Value>(&session, &recruitment_request, PROGRESS_READ),
        );
        let (contracts, account) = (contracts?, account?);
        // The act, pass ownership and recruitment only refine the page; it shows without them.
        let content = optional(content, "progress_content_failed");
        let owned = optional(owned, "progress_owned_failed");
        let recruitment = optional(recruitment, "progress_recruitment_failed");
        let inputs = ProgressInputs {
            contracts: &contracts,
            account: &account,
            act_id: content
                .as_ref()
                .and_then(Content::active_act_id)
                .unwrap_or_default(),
            owned_contracts: owned.as_ref(),
            recruitment_event: recruitment.as_ref(),
        };
        let view = progress_view(&self.assets.index(), &inputs);
        *self.last.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), session.puuid.clone(), view.clone()));
        Ok(view)
    }

    fn fresh(&self, puuid: &Puuid) -> Option<ProgressView> {
        let last = self.last.lock().unwrap_or_else(PoisonError::into_inner);
        last.as_ref()
            .filter(|(at, owner, _)| at.elapsed() < VIEW_TTL && owner == puuid)
            .map(|(_, _, view)| view.clone())
    }
}

/// A part the page can do without: logged (the error never names the player) and dropped.
fn optional<T, E: std::fmt::Display>(result: Result<T, E>, label: &'static str) -> Option<T> {
    result
        .inspect_err(|error| tracing::warn!(%error, "{label}"))
        .ok()
}

#[cfg(test)]
mod tests;
