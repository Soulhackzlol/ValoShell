//! The player's own stats over their recent matches: overall, by agent and by map. Built from
//! the match summaries the history already keeps, so they cost no extra request.
//!
//! Per-round figures (ACS, ADR, headshot %) are weighted by rounds, so a long match counts
//! more than a short one. Deathmatch, the arcade modes (Team Deathmatch, Escalation,
//! Replication, Spike Rush, Snowball Fight) and custom games are left out: their scores and
//! results don't compare with standard matches.

use std::collections::HashMap;

use serde::Serialize;
use ts_rs::TS;

use crate::post_match::{MatchResult, PostMatchView};

/// Queues whose matches don't count, by Riot queue id (an empty id is a custom game).
const LEFT_OUT_QUEUES: [&str; 7] = [
    "deathmatch",
    "hurm",
    "ggteam",
    "onefa",
    "spikerush",
    "snowball",
    "",
];

/// Totals of one group of matches.
#[derive(Debug, Clone, Default)]
struct Totals {
    matches: u32,
    wins: u32,
    draws: u32,
    kills: u32,
    deaths: u32,
    assists: u32,
    combat_score: u64,
    rounds: u64,
    /// Headshot % times the rounds of the matches that had hits, and those rounds.
    headshot_weighted: f64,
    headshot_rounds: u64,
    adr_weighted: f64,
    adr_rounds: u64,
}

impl Totals {
    fn add(&mut self, view: &PostMatchView) {
        let stats = &view.stats;
        let rounds = u64::from(stats.rounds_played);
        self.matches += 1;
        self.wins += u32::from(view.result == MatchResult::Victory);
        self.draws += u32::from(view.result == MatchResult::Draw);
        self.kills += stats.kills;
        self.deaths += stats.deaths;
        self.assists += stats.assists;
        self.combat_score += u64::from(stats.combat_score);
        self.rounds += rounds;
        if let Some(percent) = stats.headshot_percent {
            self.headshot_weighted += percent * rounds as f64;
            self.headshot_rounds += rounds;
        }
        if let Some(adr) = stats.adr {
            self.adr_weighted += adr * rounds as f64;
            self.adr_rounds += rounds;
        }
    }
}

/// One line of stats.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct StatLine {
    /// The agent or map; `Overall` for the whole set.
    pub name: String,
    pub icon: Option<String>,
    pub matches: u32,
    pub wins: u32,
    /// Wins out of matches that were not draws, 0-100; `None` with only draws.
    pub win_rate: Option<f64>,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    /// Kills per death; kills alone when there was no death.
    pub kd: f64,
    pub acs: f64,
    pub headshot_percent: Option<f64>,
    pub adr: Option<f64>,
}

/// The stats page.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct StatsView {
    pub overall: StatLine,
    /// Most played first.
    pub by_agent: Vec<StatLine>,
    pub by_map: Vec<StatLine>,
}

fn one_decimal(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

/// `part / whole` to one decimal; `None` without a whole.
fn ratio(part: f64, whole: u64) -> Option<f64> {
    (whole > 0).then(|| one_decimal(part / whole as f64))
}

fn line(name: String, icon: Option<String>, totals: &Totals) -> StatLine {
    let decided = totals.matches - totals.draws;
    StatLine {
        name,
        icon,
        matches: totals.matches,
        wins: totals.wins,
        win_rate: ratio(f64::from(totals.wins) * 100.0, u64::from(decided)),
        kills: totals.kills,
        deaths: totals.deaths,
        assists: totals.assists,
        kd: one_decimal(f64::from(totals.kills) / f64::from(totals.deaths.max(1))),
        acs: ratio(totals.combat_score as f64, totals.rounds).unwrap_or(0.0),
        headshot_percent: ratio(totals.headshot_weighted, totals.headshot_rounds),
        adr: ratio(totals.adr_weighted, totals.adr_rounds),
    }
}

/// Group totals by a key (agent or map), most played first, then by name.
fn grouped<'a>(
    views: &[&'a PostMatchView],
    key: impl Fn(&'a PostMatchView) -> Option<(String, Option<String>)>,
) -> Vec<StatLine> {
    let mut groups: HashMap<String, (Option<String>, Totals)> = HashMap::new();
    for view in views {
        let Some((name, icon)) = key(view) else {
            continue;
        };
        let entry = groups
            .entry(name)
            .or_insert_with(|| (icon, Totals::default()));
        entry.1.add(view);
    }
    let mut lines: Vec<StatLine> = groups
        .into_iter()
        .map(|(name, (icon, totals))| line(name, icon, &totals))
        .collect();
    lines.sort_by(|a, b| b.matches.cmp(&a.matches).then_with(|| a.name.cmp(&b.name)));
    lines
}

/// Build the stats from match summaries (any order).
pub fn stats_view(summaries: &[PostMatchView]) -> StatsView {
    let counted: Vec<&PostMatchView> = summaries
        .iter()
        .filter(|view| !LEFT_OUT_QUEUES.contains(&view.queue_id.as_str()))
        .collect();
    let mut overall = Totals::default();
    for view in &counted {
        overall.add(view);
    }
    StatsView {
        overall: line("Overall".to_owned(), None, &overall),
        by_agent: grouped(&counted, |view| {
            view.agent_name
                .clone()
                .map(|name| (name, view.agent_icon.clone()))
        }),
        by_map: grouped(&counted, |view| {
            Some((view.map_name.clone(), view.map_splash.clone()))
        }),
    }
}

#[cfg(test)]
mod tests;
