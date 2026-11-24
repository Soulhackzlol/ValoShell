//! Which agents the player owns and their Agent Mastery levels, for the Agents page and agent
//! select. Base agents are free and never appear in entitlements, so they are always owned.

use std::collections::HashSet;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use riot::CachePolicy;
use riot::api::pd::bloomline::{BloomlinePlayer, get_bloomline_player};
use riot::api::pd::entitlements::ITEM_TYPE_AGENTS;
use riot::session::RiotSession;
use serde::Serialize;
use ts_rs::TS;

use crate::action::ActionError;
use crate::assets::{AssetIndex, AssetStore};
use crate::collection::read_owned;
use crate::ctx::Ctx;

/// Unlocks and mastery move only after a match or a purchase; re-read this often at most.
const PROGRESS_TTL: Duration = Duration::from_secs(2 * 60);

/// Brimstone, Jett, Phoenix, Sage and Sova: free for everyone. valorant-api.com marks them
/// `isBaseContent`, but the bundled offline index has no such flag.
const STARTER_AGENTS: [&str; 5] = [
    "9f0d8ba9-4140-b941-57d3-a7ad57c6b417",
    "add6443a-41bd-e414-f6ad-e58d267f4e95",
    "eb93336a-449b-9c1b-0a54-a891f7921d69",
    "569fdd95-4d10-43ab-ca70-79becc718b46",
    "320b2a48-4d9b-a075-30f1-1f93a9b638fa",
];

/// One agent's Agent Mastery levels.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AgentMastery {
    pub agent_uuid: String,
    /// Resets every act.
    pub act_level: u32,
    /// Never resets; the number on the Agents page diamond.
    pub lifetime_level: u32,
    /// Mastery points toward the next level; orders agents on the same level.
    pub points: u32,
}

/// Owned agents and mastery levels.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AgentProgress {
    /// Lower-case uuids of every agent the player can pick, base agents included.
    pub owned: Vec<String>,
    /// Only agents the player has earned mastery on.
    pub mastery: Vec<AgentMastery>,
}

/// Cheap to clone.
#[derive(Clone)]
pub struct AgentsService {
    ctx: Ctx,
    assets: AssetStore,
    last: Arc<Mutex<Option<(Instant, AgentProgress)>>>,
}

impl AgentsService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            last: Arc::new(Mutex::new(None)),
        }
    }

    /// Owned agents and mastery; `is_forced` skips the reuse window.
    pub async fn progress(&self, is_forced: bool) -> Result<AgentProgress, ActionError> {
        if !is_forced && let Some(progress) = self.cached() {
            return Ok(progress);
        }
        let session = self.ctx.session().ok_or(ActionError::NotConnected)?;
        let unlocked = read_owned(&session, ITEM_TYPE_AGENTS).await?;
        let progress = AgentProgress {
            owned: owned_agents(&self.assets.index(), &unlocked),
            mastery: read_mastery(&session).await,
        };
        *self.last.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), progress.clone()));
        Ok(progress)
    }

    fn cached(&self) -> Option<AgentProgress> {
        let last = self.last.lock().unwrap_or_else(PoisonError::into_inner);
        last.as_ref()
            .filter(|(at, _)| at.elapsed() < PROGRESS_TTL)
            .map(|(_, progress)| progress.clone())
    }
}

/// Base agents plus every unlocked one, in the asset index's order.
fn owned_agents(index: &AssetIndex, unlocked: &HashSet<String>) -> Vec<String> {
    index
        .agents()
        .iter()
        .filter(|agent| agent.is_playable_character)
        .map(|agent| (agent.uuid.to_lowercase(), agent.is_base_content))
        .filter(|(uuid, is_base)| {
            *is_base || STARTER_AGENTS.contains(&uuid.as_str()) || unlocked.contains(uuid)
        })
        .map(|(uuid, _)| uuid)
        .collect()
}

/// Mastery is decoration: a failed read shows level 0 rather than failing the whole page.
async fn read_mastery(session: &RiotSession) -> Vec<AgentMastery> {
    let fetched = session
        .gate
        .fetch(
            &session.http,
            &get_bloomline_player(&session.puuid),
            CachePolicy::Fresh,
        )
        .await;
    if !fetched.is_complete {
        tracing::warn!(status = fetched.status, "agent_mastery_unavailable");
        return Vec::new();
    }
    serde_json::from_value::<BloomlinePlayer>(fetched.data)
        .map(|player| mastery_rows(&player))
        .unwrap_or_else(|error| {
            tracing::warn!(%error, "agent_mastery_unreadable");
            Vec::new()
        })
}

fn mastery_rows(player: &BloomlinePlayer) -> Vec<AgentMastery> {
    player
        .bonsais
        .iter()
        .map(|bonsai| AgentMastery {
            agent_uuid: bonsai.agent_uuid(),
            act_level: bonsai.flourish.short_level,
            lifetime_level: bonsai.flourish.long_level,
            points: u32::try_from(bonsai.flourish.points.max(0)).unwrap_or(u32::MAX),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    const OMEN: &str = "8e253930-4c05-31dd-1b6c-968525494517";

    #[test]
    fn starter_agents_are_owned_without_entitlements() {
        let owned = owned_agents(&AssetIndex::bundled(), &HashSet::new());

        assert_eq!(owned.len(), STARTER_AGENTS.len());
        assert!(!owned.contains(&OMEN.to_owned()));
    }

    #[test]
    fn unlocked_agents_join_the_owned_list() {
        let owned = owned_agents(&AssetIndex::bundled(), &HashSet::from([OMEN.to_owned()]));

        assert_eq!(owned.len(), STARTER_AGENTS.len() + 1);
        assert!(owned.contains(&OMEN.to_owned()));
    }

    #[test]
    fn mastery_rows_carry_both_levels_per_agent() {
        let body = r#"{"Bonsais":[{"BonsaiID":"9F0D8BA94140B94157D3A7AD57C6B417",
            "Flourish":{"ShortLevel":2,"LongLevel":9,"Points":340}}]}"#;
        let player: BloomlinePlayer = serde_json::from_str(body).unwrap();

        let rows = mastery_rows(&player);

        assert_eq!(
            rows,
            vec![AgentMastery {
                agent_uuid: "9f0d8ba9-4140-b941-57d3-a7ad57c6b417".into(),
                act_level: 2,
                lifetime_level: 9,
                points: 340,
            }]
        );
    }
}
