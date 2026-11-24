//! The player's in-game favourite skins (the star in VALORANT's collection). Read only: no
//! write endpoint is implemented, so ValoShell's own stars never reach Riot.
//!
//! The body is UNVERIFIED on 13.08; the known shape is `FavoritedContent` keyed by item id with
//! an `ItemID` per entry. Ids that name a skin level are also mapped to their skin.

use std::collections::BTreeSet;

use riot::api::pd::favorites::{Favorites, get_favorites};
use serde_json::Value;

use crate::action::{ActionError, fetch_json};
use crate::assets::{AssetIndex, AssetStore};
use crate::ctx::Ctx;

const FAVORITES_READ: &str = "read your favourite skins";
const CONTENT_KEY: &str = "FavoritedContent";
const ITEM_KEY: &str = "ItemID";

/// Every favourite skin id (lowercase, sorted, no repeats).
pub fn favorite_skin_ids(index: &AssetIndex, favorites: &Favorites) -> Vec<String> {
    let Some(content) = favorites.get(CONTENT_KEY).and_then(Value::as_object) else {
        return Vec::new();
    };
    let item_ids = content.iter().flat_map(|(key, entry)| {
        let item = entry.get(ITEM_KEY).and_then(Value::as_str);
        [Some(key.as_str()), item].into_iter().flatten()
    });
    let mut ids = BTreeSet::new();
    for id in item_ids.filter(|id| !id.is_empty()) {
        if let Some(skin) = index.skin_of_level(id) {
            ids.insert(skin.uuid.to_lowercase());
        }
        ids.insert(id.to_lowercase());
    }
    ids.into_iter().collect()
}

/// The favourites, read fresh through the request pacing.
pub async fn read_favorite_skins(
    ctx: &Ctx,
    assets: &AssetStore,
) -> Result<Vec<String>, ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    let favorites: Favorites = fetch_json(&session, &get_favorites(&session.puuid), FAVORITES_READ)
        .await
        .inspect_err(|error| tracing::warn!(endpoint = "favorites", %error, "riot_read_failed"))?;
    Ok(favorite_skin_ids(&assets.index(), &favorites))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::assets::{AssetSource, fixtures};

    fn index() -> AssetIndex {
        AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
    }

    #[test]
    fn favorite_skin_ids_read_keys_and_item_ids_lowercase() {
        let favorites = json!({ "Subject": "p", "FavoritedContent": {
            "SKIN-A": { "FavoriteID": "f1", "ItemID": "SKIN-A" },
            "skin-b": { "ItemID": "SKIN-C" } } });

        assert_eq!(
            favorite_skin_ids(&index(), &favorites),
            ["skin-a", "skin-b", "skin-c"]
        );
    }

    #[test]
    fn favorite_skin_ids_add_the_skin_of_a_favourite_level() {
        let favorites = json!({ "FavoritedContent": { "f1": { "ItemID": "LEVEL-1" } } });

        let ids = favorite_skin_ids(&index(), &favorites);

        assert!(ids.contains(&"skin-reaver".to_owned()));
        assert!(ids.contains(&"level-1".to_owned()));
    }

    #[test]
    fn favorite_skin_ids_are_empty_for_an_unknown_body() {
        assert!(favorite_skin_ids(&index(), &Value::Null).is_empty());
        assert!(favorite_skin_ids(&index(), &json!({ "FavoritedContent": [] })).is_empty());
    }
}
