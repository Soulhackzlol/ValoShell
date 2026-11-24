//! Skin cards for the wishlist: search every store skin by name or weapon, and name the ones
//! already wished. Read from the asset cache only; the wishlist itself lives in the settings.

use crate::assets::{AssetIndex, Skin};
use serde::Serialize;
use ts_rs::TS;

use super::view::{edition_of, skin_image};

/// The most results a search returns; the picker asks the player to type more past that.
const SEARCH_LIMIT: usize = 60;

/// A skin as the wishlist shows it.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct SkinCard {
    pub skin_id: String,
    pub name: String,
    pub image: Option<String>,
    pub weapon_name: String,
    /// `Select` ... `Ultra`.
    pub edition: Option<String>,
}

fn skin_card(index: &AssetIndex, skin: &Skin) -> SkinCard {
    SkinCard {
        skin_id: skin.uuid.to_lowercase(),
        name: skin.display_name.clone(),
        image: skin_image(skin, ""),
        weapon_name: index
            .weapon_of_skin(&skin.uuid)
            .map(|weapon| weapon.display_name.clone())
            .unwrap_or_default(),
        edition: skin.content_tier_uuid.as_deref().and_then(edition_of),
    }
}

/// Skins the store can sell: they have an edition (default and battle pass skins have none).
fn is_sold_in_store(skin: &Skin) -> bool {
    skin.content_tier_uuid
        .as_deref()
        .and_then(edition_of)
        .is_some()
}

/// Store skins whose name (which names the weapon too) holds every word of `query`.
pub fn search_skins(index: &AssetIndex, query: &str) -> Vec<SkinCard> {
    let words: Vec<String> = query.split_whitespace().map(str::to_lowercase).collect();
    if words.is_empty() {
        return Vec::new();
    }
    index
        .skins()
        .iter()
        .filter(|skin| is_sold_in_store(skin))
        .filter(|skin| {
            let name = skin.display_name.to_lowercase();
            words.iter().all(|word| name.contains(word.as_str()))
        })
        .take(SEARCH_LIMIT)
        .map(|skin| skin_card(index, skin))
        .collect()
}

/// Cards for wished skins, in the order given; unknown ids are left out.
pub fn skin_cards(index: &AssetIndex, ids: &[String]) -> Vec<SkinCard> {
    ids.iter()
        .filter_map(|id| index.skin(id))
        .map(|skin| skin_card(index, &skin))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetSource, fixtures};

    fn index() -> AssetIndex {
        AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
    }

    #[test]
    fn search_matches_every_word_in_any_order() {
        let found = search_skins(&index(), "vandal REAVER");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "Reaver Vandal");
        assert_eq!(found[0].weapon_name, "Vandal");
    }

    #[test]
    fn an_empty_query_finds_nothing() {
        assert!(search_skins(&index(), "   ").is_empty());
    }

    #[test]
    fn cards_keep_the_given_order_and_drop_unknown_ids() {
        let ids = ["missing".to_owned(), "SKIN-REAVER".to_owned()];

        let cards = skin_cards(&index(), &ids);

        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].skin_id, "skin-reaver");
    }
}
