//! Party view model: the Riot party DTO joined with names and art, shaped for the lineup.

use std::collections::HashMap;

use domain::ids::Puuid;
use riot::api::glz::common::PlayerIdentity;
use riot::api::glz::party_dto::{Party, PartyMember};
use serde::Serialize;
use ts_rs::TS;

use super::custom::{CustomLobbyView, custom_lobby_view};
use crate::assets::{AssetIndex, PlayerCard, image_url};
use crate::names::RiotName;

/// A queue the party can pick.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct QueueOption {
    pub id: String,
    pub label: String,
    /// The client's mode card art (`listViewIconTall`); Premier and custom have none.
    pub art: Option<String>,
    /// The mode's white glyph drawn before its name (`displayIcon`).
    pub icon: Option<String>,
}

/// Rank badge of a member; `tier` 0 is unranked.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct RankBadge {
    pub tier: u32,
    pub name: String,
    pub icon: Option<String>,
    /// `RRGGBBAA` from the asset table.
    pub color: Option<String>,
}

/// One player card in the lineup.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct MemberView {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub is_self: bool,
    pub is_owner: bool,
    pub is_ready: bool,
    /// `None` when the player hides it.
    pub account_level: Option<u32>,
    pub card_tall: Option<String>,
    /// Square card art for small portraits (party and friend rows).
    pub card_small: Option<String>,
    pub card_wide: Option<String>,
    pub title: Option<String>,
    /// The title in Spanish, for the VALORANT style in a Spanish client.
    pub title_es: Option<String>,
    pub level_border: Option<String>,
    pub rank: RankBadge,
    pub ping_ms: Option<u32>,
}

/// The party as the home scene shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct PartyView {
    pub party_id: String,
    pub is_owner: bool,
    pub is_open: bool,
    pub is_queueing: bool,
    pub is_custom_game: bool,
    pub queue: QueueOption,
    /// ISO-8601 time the search started; set only while queueing.
    pub queue_entry_time: Option<String>,
    pub eligible_queues: Vec<QueueOption>,
    pub invite_code: Option<String>,
    /// Self first, then the others in party order.
    pub members: Vec<MemberView>,
    pub max_size: u32,
    /// Seconds the party may not queue (dodge penalty), 0 when free.
    pub restricted_seconds: u32,
    /// Teams, map, mode and server while the party is in custom setup.
    pub custom: Option<CustomLobbyView>,
}

/// Display order of queues in the picker; unknown queues follow alphabetically.
const QUEUE_ORDER: [&str; 12] = [
    "unrated",
    "competitive",
    "swiftplay",
    "spikerush",
    "deathmatch",
    "hurm",
    "ggteam",
    "premier",
    "onefa",
    "snowball",
    "newmap",
    "valaram",
];

/// Label and art for a queue id, preferring the live asset table.
pub fn queue_option(index: &AssetIndex, queue_id: &str) -> QueueOption {
    let queue = index.queue(queue_id);
    let label = queue
        .as_ref()
        .map(|queue| queue.display_name.clone())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| domain::game_modes::label_for(queue_id));
    QueueOption {
        id: queue_id.to_owned(),
        label,
        art: queue
            .as_ref()
            .and_then(|queue| queue.list_view_icon_tall.as_deref().map(image_url)),
        icon: queue
            .as_ref()
            .and_then(|queue| queue.display_icon.clone())
            .or_else(|| mode_icon(index, queue_id))
            .as_deref()
            .map(image_url),
    }
}

/// Queues Riot ships without an icon of their own, with the game mode whose icon the client
/// shows for them (its folder under `GameModes/`).
const QUEUE_MODES: [(&str, &str); 3] = [
    ("unrated", "Bomb"),
    ("custom", "Bomb"),
    ("deathmatch", "Deathmatch"),
];

/// The icon of the queue's game mode, for a queue with none of its own.
fn mode_icon(index: &AssetIndex, queue_id: &str) -> Option<String> {
    let (_, folder) = QUEUE_MODES.iter().find(|(id, _)| *id == queue_id)?;
    index
        .game_mode_by_path(&format!("GameModes/{folder}/"))?
        .display_icon
        .clone()
}

fn queue_rank(queue_id: &str) -> usize {
    QUEUE_ORDER
        .iter()
        .position(|known| *known == queue_id)
        .unwrap_or(QUEUE_ORDER.len())
}

/// The client's custom lobby, picked from the same list as the queues.
pub const CUSTOM_QUEUE: &str = "custom";

/// Eligible queues in picker order, then the custom lobby, which Riot never lists but the
/// client always offers.
pub fn sorted_queues(index: &AssetIndex, queue_ids: &[String]) -> Vec<QueueOption> {
    let mut ids: Vec<&str> = queue_ids
        .iter()
        .map(String::as_str)
        .filter(|id| *id != CUSTOM_QUEUE)
        .collect();
    ids.sort_by(|a, b| queue_rank(a).cmp(&queue_rank(b)).then_with(|| a.cmp(b)));
    ids.dedup();
    ids.push(CUSTOM_QUEUE);
    ids.into_iter().map(|id| queue_option(index, id)).collect()
}

/// Rank badge from the latest rank table.
pub fn rank_badge(index: &AssetIndex, tier: u32) -> RankBadge {
    let entry = index.tier(tier);
    RankBadge {
        tier,
        name: entry
            .as_ref()
            .map(|tier| tier.tier_name.clone())
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| {
                if tier == 0 {
                    "Unranked".into()
                } else {
                    format!("Tier {tier}")
                }
            }),
        icon: entry
            .as_ref()
            .and_then(|tier| tier.small_icon.as_deref())
            .map(image_url),
        color: entry.and_then(|tier| tier.color.clone()),
    }
}

/// Hiding the level hides it from others; the client still shows you your own.
fn visible_level(identity: &PlayerIdentity, is_self: bool) -> Option<u32> {
    (is_self || !identity.hide_account_level)
        .then_some(identity.account_level)
        .filter(|level| *level > 0)
}

/// One of a player card's images as a displayable url.
fn art(card: Option<&PlayerCard>, pick: impl Fn(&PlayerCard) -> Option<&str>) -> Option<String> {
    card.and_then(pick).map(image_url)
}

fn member_view(
    index: &AssetIndex,
    member: &PartyMember,
    own: &Puuid,
    names: &HashMap<Puuid, RiotName>,
) -> Option<MemberView> {
    let puuid = member.subject.clone()?;
    let identity = &member.player_identity;
    let card = index.player_card(&identity.player_card_id);
    let name = names.get(&puuid).cloned().unwrap_or_default();
    let is_self = &puuid == own;
    Some(MemberView {
        is_self,
        puuid: puuid.to_string(),
        game_name: name.game_name,
        tag_line: name.tag_line,
        is_owner: member.is_owner,
        is_ready: member.is_ready,
        account_level: visible_level(identity, is_self),
        card_tall: art(card.as_deref(), |card| card.large_art.as_deref()),
        card_wide: art(card.as_deref(), |card| card.wide_art.as_deref()),
        card_small: art(card.as_deref(), |card| card.small_art.as_deref()),
        title: title_text(index.player_title(&identity.player_title_id)),
        title_es: title_text(index.player_title_es(&identity.player_title_id)),
        level_border: index
            .level_border_for(identity.account_level)
            .and_then(|border| border.small_player_card_appearance.clone())
            .map(|url| image_url(&url)),
        rank: rank_badge(index, member.competitive_tier),
        ping_ms: member
            .pings
            .iter()
            .map(|sample| sample.ping)
            .filter(|ping| *ping > 0)
            .min(),
    })
}

/// Inputs the view needs besides the party itself.
pub struct ViewContext<'a> {
    pub index: &'a AssetIndex,
    pub own: &'a Puuid,
    pub names: &'a HashMap<Puuid, RiotName>,
}

/// Build the view; `None` when the party has no id (not a real party answer).
pub fn party_view(party: &Party, context: &ViewContext<'_>) -> Option<PartyView> {
    let party_id = party.id.as_ref()?.to_string();
    let mut members: Vec<MemberView> = party
        .members
        .iter()
        .filter_map(|member| member_view(context.index, member, context.own, context.names))
        .collect();
    members.sort_by_key(|member| !member.is_self);
    let is_custom_game = party.is_custom_game_setup();
    // Riot leaves QueueID on the last matchmade queue during custom setup.
    let queue_id = if is_custom_game {
        CUSTOM_QUEUE
    } else {
        party.matchmaking_data.queue_id.as_str()
    };
    Some(PartyView {
        party_id,
        is_owner: members
            .iter()
            .any(|member| member.is_self && member.is_owner),
        is_open: party.accessibility.eq_ignore_ascii_case("OPEN"),
        is_queueing: party.is_queueing(),
        is_custom_game,
        queue: queue_option(context.index, queue_id),
        queue_entry_time: party.is_queueing().then(|| party.queue_entry_time.clone()),
        eligible_queues: sorted_queues(context.index, &party.eligible_queues),
        invite_code: Some(party.invite_code.clone()).filter(|code| !code.is_empty()),
        members,
        max_size: if is_custom_game { 12 } else { 5 },
        restricted_seconds: party.restricted_seconds,
        custom: is_custom_game.then(|| custom_lobby_view(&party.custom_game_data, context.index)),
    })
}

/// A title's text, or nothing for a missing or blank one.
fn title_text(title: Option<std::sync::Arc<crate::assets::PlayerTitle>>) -> Option<String> {
    title
        .and_then(|title| title.title_text.clone())
        .filter(|text| !text.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    const PARTY: &str = include_str!("../../../riot/src/api/glz/fixtures/party.json");
    const ME: &str = "d7ff5397-caf5-4451-9057-0db61e73ab33";

    fn view(names: &HashMap<Puuid, RiotName>) -> PartyView {
        let party: Party = serde_json::from_str(PARTY).unwrap();
        let index = AssetIndex::bundled();
        let own = Puuid::new(ME);
        party_view(
            &party,
            &ViewContext {
                index: &index,
                own: &own,
                names,
            },
        )
        .unwrap()
    }

    #[test]
    fn own_member_comes_first_and_owns_the_party() {
        let party = view(&HashMap::new());

        assert!(party.members[0].is_self);
        assert!(party.is_owner);
        assert!(!party.is_open);
        assert_eq!(party.queue.id, "unrated");
        assert_eq!(party.max_size, 5);
    }

    #[test]
    fn own_hidden_level_is_still_shown_and_ping_is_the_best_pod() {
        let party = view(&HashMap::new());

        let me = &party.members[0];
        assert_eq!(me.account_level, Some(239));
        assert_eq!(me.ping_ms, Some(19));
        assert_eq!(me.rank.tier, 14);
    }

    #[test]
    fn names_are_joined_by_puuid() {
        let mut names = HashMap::new();
        names.insert(
            Puuid::new(ME),
            RiotName {
                game_name: "Player".into(),
                tag_line: "EUW".into(),
            },
        );

        let party = view(&names);

        assert_eq!(party.members[0].game_name, "Player");
        assert_eq!(party.members[0].tag_line, "EUW");
    }

    #[test]
    fn eligible_queues_follow_the_menu_order() {
        let index = AssetIndex::bundled();
        let ids = ["deathmatch", "competitive", "unrated", "zzz", "competitive"].map(String::from);

        let queues = sorted_queues(&index, &ids);

        let order: Vec<&str> = queues.iter().map(|queue| queue.id.as_str()).collect();
        assert_eq!(
            order,
            ["unrated", "competitive", "deathmatch", "zzz", "custom"]
        );
        assert_eq!(queues[1].label, "Competitive");
    }

    #[test]
    fn a_queue_carries_its_card_art_and_glyph() {
        let index = AssetIndex::from_documents(
            &crate::assets::fixtures::documents(),
            crate::assets::AssetSource::Cache,
        );

        let competitive = queue_option(&index, "competitive");
        let unknown = queue_option(&index, "zzz");

        assert!(
            competitive
                .art
                .as_deref()
                .is_some_and(|art| art.contains("listviewicontall"))
        );
        assert!(
            competitive
                .icon
                .as_deref()
                .is_some_and(|icon| icon.contains("displayicon"))
        );
        assert_eq!((unknown.art, unknown.icon), (None, None));
    }

    #[test]
    fn idle_party_has_no_queue_time() {
        let party = view(&HashMap::new());

        assert!(!party.is_queueing);
        assert!(party.queue_entry_time.is_none());
        assert!(party.invite_code.is_none());
    }

    #[test]
    fn queues_without_an_icon_take_their_game_modes() {
        let index = AssetIndex::from_documents(
            &crate::assets::fixtures::documents(),
            crate::assets::AssetSource::Cache,
        );

        for queue in ["unrated", "custom", "deathmatch"] {
            assert!(
                queue_option(&index, queue).icon.is_some(),
                "{queue} has no icon"
            );
        }
    }
}
