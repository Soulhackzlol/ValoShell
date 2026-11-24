//! The active agent recruitment event and the agent contract levels for the Progress page.
//!
//! The recruitment body is UNVERIFIED on 13.08 (204 when no event runs), so its fields are
//! looked up by name anywhere in the tree; without an agent the event is left out.

use riot::api::pd::contracts::Contracts;
use serde::Serialize;
use serde_json::Value;
use ts_rs::TS;

use crate::assets::{AssetIndex, image_url};

const AGENT_KEYS: [&str; 4] = ["AgentID", "CharacterID", "AgentUuid", "CharacterUuid"];
const END_KEYS: [&str; 3] = ["EndDate", "EndTime", "EndTimestamp"];
const CONTRACT_KEYS: [&str; 2] = ["ContractDefinitionID", "ContractID"];
const GOAL_KEYS: [&str; 3] = ["MilestoneThreshold", "XPThreshold", "XPRequired"];
const AGENT_RELATION: &str = "Agent";

/// The agent recruitment event running now.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct RecruitmentView {
    pub agent_id: String,
    pub agent_name: String,
    pub agent_icon: Option<String>,
    /// XP earned towards the agent.
    #[ts(type = "number")]
    pub xp: i64,
    /// XP that unlocks the agent, when Riot says.
    #[ts(type = "number | null")]
    pub xp_goal: Option<i64>,
    /// ISO 8601, when Riot says.
    pub ends_at: Option<String>,
}

/// One agent contract the player has progressed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AgentContractView {
    pub agent_id: String,
    pub agent_name: String,
    pub agent_icon: Option<String>,
    pub level: u32,
    pub level_count: u32,
}

/// The first value under one of `keys` (any case), searching the whole tree depth first.
fn find_field<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    match value {
        Value::Object(map) => map
            .iter()
            .find(|(key, _)| keys.iter().any(|wanted| key.eq_ignore_ascii_case(wanted)))
            .map(|(_, found)| found)
            .or_else(|| map.values().find_map(|child| find_field(child, keys))),
        Value::Array(items) => items.iter().find_map(|child| find_field(child, keys)),
        _ => None,
    }
}

fn find_text(value: &Value, keys: &[&str]) -> Option<String> {
    find_field(value, keys)
        .and_then(Value::as_str)
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

/// The event's agent, XP and end; `None` when no event runs or its agent is unknown.
pub fn recruitment_view(
    index: &AssetIndex,
    event: &Value,
    contracts: &Contracts,
) -> Option<RecruitmentView> {
    let agent = index.agent(&find_text(event, &AGENT_KEYS)?)?;
    let xp = find_text(event, &CONTRACT_KEYS)
        .and_then(|id| contracts.progress_of(&id))
        .map_or(0, |progress| {
            progress.contract_progression.total_progression_earned
        });
    Some(RecruitmentView {
        agent_id: agent.uuid.to_lowercase(),
        agent_name: agent.display_name.clone(),
        agent_icon: agent.display_icon.as_deref().map(image_url),
        xp,
        xp_goal: find_field(event, &GOAL_KEYS).and_then(Value::as_i64),
        ends_at: find_text(event, &END_KEYS),
    })
}

/// Agent contracts with any progress, highest level first, then by agent name.
pub fn agent_contract_views(index: &AssetIndex, contracts: &Contracts) -> Vec<AgentContractView> {
    let mut views: Vec<AgentContractView> = contracts
        .contracts
        .iter()
        .filter(|progress| {
            progress.progression_level_reached > 0 || progress.progression_towards_next_level > 0
        })
        .filter_map(|progress| {
            let contract = index.contract(&progress.contract_definition_id)?;
            let content = &contract.content;
            let is_agent = content.relation_type.as_deref() == Some(AGENT_RELATION);
            let agent = index.agent(content.relation_uuid.as_deref().filter(|_| is_agent)?)?;
            let levels: usize = content
                .chapters
                .iter()
                .map(|chapter| chapter.levels.len())
                .sum();
            Some(AgentContractView {
                agent_id: agent.uuid.to_lowercase(),
                agent_name: agent.display_name.clone(),
                agent_icon: agent.display_icon.as_deref().map(image_url),
                level: progress.progression_level_reached,
                level_count: u32::try_from(levels).unwrap_or(u32::MAX),
            })
        })
        .collect();
    views.sort_by(|a, b| {
        b.level
            .cmp(&a.level)
            .then_with(|| a.agent_name.cmp(&b.agent_name))
    });
    views
}

#[cfg(test)]
mod tests {
    use riot::api::pd::contracts::{ContractProgress, ContractProgression};
    use serde_json::json;

    use super::*;
    use crate::assets::{AssetSource, Endpoint, fixtures};

    const JETT: &str = "ADD6443A-41BD-E414-F6AD-E58D267F4E95";

    /// The fixtures plus a Jett contract of three levels.
    fn index() -> AssetIndex {
        let mut documents = fixtures::documents();
        let contracts = r#"{"status":200,"data":[{"uuid":"jett-contract","displayName":"Jett",
            "content":{"relationType":"Agent","relationUuid":"ADD6443A-41BD-E414-F6AD-E58D267F4E95",
            "chapters":[{"levels":[{"xp":1},{"xp":2}]},{"levels":[{"xp":3}]}]}}]}"#;
        documents.insert(Endpoint::Contracts, contracts.to_owned());
        AssetIndex::from_documents(&documents, AssetSource::Cache)
    }

    fn contracts(id: &str, level: u32, xp: i64) -> Contracts {
        Contracts {
            contracts: vec![ContractProgress {
                contract_definition_id: id.to_owned(),
                progression_level_reached: level,
                contract_progression: ContractProgression {
                    total_progression_earned: xp,
                    ..ContractProgression::default()
                },
                ..ContractProgress::default()
            }],
            ..Contracts::default()
        }
    }

    #[test]
    fn recruitment_view_reads_agent_xp_goal_and_end_anywhere_in_the_body() {
        let event = json!({ "RecruitmentEvent": { "AgentID": JETT, "EndDate": "2026-11-01",
            "ContractDefinitionID": "event-1", "MilestoneThreshold": 120000 } });

        let view =
            recruitment_view(&index(), &event, &contracts("EVENT-1", 0, 4500)).expect("event");

        assert_eq!(view.agent_name, "Jett");
        assert_eq!((view.xp, view.xp_goal), (4500, Some(120_000)));
        assert_eq!(view.ends_at.as_deref(), Some("2026-11-01"));
    }

    #[test]
    fn recruitment_view_is_none_without_an_event_or_known_agent() {
        let index = index();

        assert!(recruitment_view(&index, &Value::Null, &Contracts::default()).is_none());
        let unknown = json!({ "AgentID": "nobody" });
        assert!(recruitment_view(&index, &unknown, &Contracts::default()).is_none());
    }

    #[test]
    fn agent_contract_views_list_progressed_agent_contracts_with_level_count() {
        let views = agent_contract_views(&index(), &contracts("JETT-CONTRACT", 2, 0));

        assert_eq!(views.len(), 1);
        assert_eq!(views[0].agent_name, "Jett");
        assert_eq!((views[0].level, views[0].level_count), (2, 3));
    }

    #[test]
    fn agent_contract_views_skip_untouched_and_non_agent_contracts() {
        let index = index();

        assert!(agent_contract_views(&index, &contracts("jett-contract", 0, 0)).is_empty());
        assert!(agent_contract_views(&index, &contracts("unknown", 5, 0)).is_empty());
    }
}
