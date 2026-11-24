//! Store: today's skins, the featured bundles, the night market and the
//! accessory rotation, with names, art and prices. View only: nothing here can buy.

use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use riot::CachePolicy;
use riot::api::pd::bundle::Bundle;
use riot::api::pd::entitlements::ITEM_TYPE_SKIN_LEVELS;
use riot::api::pd::offer::{Cost, Offer};
use riot::api::pd::store::{Storefront, post_storefront};
use riot::api::pd::wallet::{CURRENCY_KINGDOM_CREDITS, CURRENCY_VALORANT_POINTS};
use serde::Serialize;
use ts_rs::TS;

use crate::action::ActionError;
use crate::assets::{AssetIndex, AssetStore, image_url};
use crate::collection::edition_of;
use crate::ctx::Ctx;

pub mod agent_store;

/// A store answer is reused for this long (sections themselves last hours).
const VIEW_TTL: Duration = Duration::from_secs(10 * 60);

/// One thing on sale.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct StoreItem {
    pub id: String,
    /// The skin a skin-level offer sells (the wishlist matches on it); `None` for other items.
    pub skin_id: Option<String>,
    pub name: String,
    pub image: Option<String>,
    /// Price in its currency (VP for skins, KC for accessories).
    #[ts(type = "number")]
    pub price: i64,
    #[ts(type = "number | null")]
    pub discounted_price: Option<i64>,
    /// Whole percent (30 = 30 % off).
    pub discount_percent: Option<f64>,
    /// `vp` or `kc`.
    pub currency: String,
    /// Skin edition (`Select` ... `Ultra`), which tints its store card; none for other items.
    pub edition: Option<String>,
}

/// A featured bundle.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct BundleView {
    pub name: String,
    pub image: Option<String>,
    #[ts(type = "number")]
    pub price: i64,
    #[ts(type = "number | null")]
    pub discounted_price: Option<i64>,
    #[ts(type = "number")]
    pub ends_in_s: i64,
    pub items: Vec<StoreItem>,
}

/// The store scene.
#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[ts(export)]
pub struct StoreView {
    pub daily: Vec<StoreItem>,
    #[ts(type = "number")]
    pub daily_ends_in_s: i64,
    pub bundles: Vec<BundleView>,
    pub night_market: Option<Vec<StoreItem>>,
    #[ts(type = "number")]
    pub night_market_ends_in_s: i64,
    pub accessories: Vec<StoreItem>,
    #[ts(type = "number")]
    pub accessories_end_in_s: i64,
    /// Epoch ms when Riot answered; countdowns run from here.
    pub observed_at_ms: f64,
}

fn currency_of(cost: &Cost) -> (&'static str, i64) {
    if let Some(price) = cost.get(CURRENCY_VALORANT_POINTS) {
        return ("vp", *price);
    }
    if let Some(price) = cost.get(CURRENCY_KINGDOM_CREDITS) {
        return ("kc", *price);
    }
    ("vp", cost.values().copied().next().unwrap_or(0))
}

/// Name, best art and edition for an item: skins use the skin's own icon (levels often have none).
fn item_art(
    index: &AssetIndex,
    type_id: &str,
    id: &str,
) -> (String, Option<String>, Option<String>) {
    if type_id.eq_ignore_ascii_case(ITEM_TYPE_SKIN_LEVELS)
        && let Some(skin) = index.skin_of_level(id)
    {
        let image = index
            .skin_level(id)
            .and_then(|level| level.display_icon.clone())
            .or_else(|| skin.display_icon.clone())
            .or_else(|| {
                skin.chromas
                    .first()
                    .and_then(|chroma| chroma.full_render.clone())
            });
        let edition = skin.content_tier_uuid.as_deref().and_then(edition_of);
        return (skin.display_name.clone(), image, edition);
    }
    match index.item_by_type_and_id(type_id, id) {
        Some(info) => (info.name, info.icon, None),
        None => ("Unknown item".to_owned(), None, None),
    }
}

fn offer_item(index: &AssetIndex, offer: &Offer, discounted: Option<&Cost>) -> Option<StoreItem> {
    let reward = offer.first_reward()?;
    let id = reward.item_id.as_ref()?.to_string();
    let (name, image, edition) = item_art(index, &reward.item_type_id, &id);
    let skin_id = reward
        .item_type_id
        .eq_ignore_ascii_case(ITEM_TYPE_SKIN_LEVELS)
        .then(|| index.skin_of_level(&id))
        .flatten()
        .map(|skin| skin.uuid.to_lowercase());
    let (currency, price) = currency_of(&offer.cost);
    let discounted_price = discounted.map(|cost| currency_of(cost).1);
    Some(StoreItem {
        id,
        skin_id,
        name,
        image: image.as_deref().map(image_url),
        price,
        discounted_price,
        discount_percent: discounted_price
            .filter(|_| price > 0)
            .map(|now| ((1.0 - now as f64 / price as f64) * 100.0).round()),
        currency: currency.to_owned(),
        edition,
    })
}

fn bundle_view(index: &AssetIndex, bundle: &Bundle) -> BundleView {
    let asset = index.bundle(&bundle.data_asset_id);
    let items = bundle
        .item_offers
        .iter()
        .filter_map(|line| offer_item(index, &line.offer, Some(&line.discounted_cost)))
        .collect();
    let base = currency_of(&bundle.total_base_cost).1;
    let discounted = currency_of(&bundle.total_discounted_cost).1;
    BundleView {
        name: asset.as_ref().map_or_else(
            || "Featured bundle".to_owned(),
            |asset| asset.display_name.clone(),
        ),
        image: asset
            .and_then(|asset| asset.display_icon.clone())
            .as_deref()
            .map(image_url),
        price: base,
        discounted_price: (discounted > 0 && discounted < base).then_some(discounted),
        ends_in_s: bundle.duration_remaining_in_seconds,
        items,
    }
}

/// Bundles with items; older answers only fill the single `Bundle` field.
fn featured_bundles(index: &AssetIndex, store: &Storefront) -> Vec<BundleView> {
    let featured = &store.featured_bundle;
    let mut bundles: Vec<&Bundle> = featured
        .bundles
        .iter()
        .filter(|bundle| !bundle.items.is_empty())
        .collect();
    if bundles.is_empty() {
        bundles.extend(featured.bundle.as_ref());
    }
    bundles
        .into_iter()
        .map(|bundle| bundle_view(index, bundle))
        .collect()
}

fn night_market(index: &AssetIndex, store: &Storefront) -> Option<Vec<StoreItem>> {
    store.bonus_store.as_ref().map(|night| {
        night
            .bonus_store_offers
            .iter()
            .filter_map(|offer| offer_item(index, &offer.offer, Some(&offer.discount_costs)))
            .collect()
    })
}

/// Map the storefront into the scene's view.
pub fn store_view(index: &AssetIndex, store: &Storefront, observed_at_ms: f64) -> StoreView {
    let daily = &store.skins_panel_layout;
    let accessories = &store.accessory_store;
    StoreView {
        daily: daily
            .single_item_store_offers
            .iter()
            .filter_map(|offer| offer_item(index, offer, None))
            .collect(),
        daily_ends_in_s: daily.single_item_offers_remaining_duration_in_seconds,
        bundles: featured_bundles(index, store),
        night_market: night_market(index, store),
        night_market_ends_in_s: store
            .bonus_store
            .as_ref()
            .map_or(0, |night| night.bonus_store_remaining_duration_in_seconds),
        accessories: accessories
            .accessory_store_offers
            .iter()
            .filter_map(|offer| offer_item(index, &offer.offer, None))
            .collect(),
        accessories_end_in_s: accessories.accessory_store_remaining_duration_in_seconds,
        observed_at_ms,
    }
}

/// Cheap to clone.
#[derive(Clone)]
pub struct StoreService {
    ctx: Ctx,
    assets: AssetStore,
    last: Arc<Mutex<Option<(Instant, StoreView)>>>,
}

impl StoreService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            last: Arc::new(Mutex::new(None)),
        }
    }

    /// The store, reusing a recent answer unless `is_forced`.
    pub async fn view(&self, is_forced: bool) -> Result<StoreView, ActionError> {
        if !is_forced
            && let Some((at, view)) = self
                .last
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .as_ref()
            && at.elapsed() < VIEW_TTL
        {
            return Ok(view.clone());
        }
        let session = self.ctx.session().ok_or(ActionError::NotConnected)?;
        let fetched = session
            .gate
            .fetch(
                &session.http,
                &post_storefront(&session.puuid),
                CachePolicy::Fresh,
            )
            .await;
        if !fetched.is_complete {
            return Err(ActionError::could_not(
                "open the store",
                format!("Riot answered HTTP {}", fetched.status),
            ));
        }
        let store: Storefront = serde_json::from_value(fetched.data)
            .map_err(|error| ActionError::could_not("read the store", error))?;
        let view = store_view(&self.assets.index(), &store, crate::pregame::now_ms());
        *self.last.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), view.clone()));
        Ok(view)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetSource, fixtures};

    const STOREFRONT: &str = include_str!("../../riot/src/api/pd/fixtures/storefront.json");

    fn view() -> StoreView {
        let store: Storefront = serde_json::from_str(STOREFRONT).unwrap();
        let index = AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache);
        store_view(&index, &store, 5.0)
    }

    #[test]
    fn daily_offers_are_priced_in_vp() {
        let view = view();

        assert_eq!(view.daily.len(), 1);
        assert_eq!(view.daily[0].price, 1775);
        assert_eq!(view.daily[0].currency, "vp");
        assert_eq!(view.daily_ends_in_s, 40000);
    }

    #[test]
    fn bundle_lines_carry_discounts() {
        let view = view();

        let bundle = &view.bundles[0];
        assert_eq!(bundle.price, 8000);
        assert_eq!(bundle.discounted_price, Some(5360));
        assert_eq!(bundle.items[0].discounted_price, Some(1793));
        assert_eq!(bundle.items[0].discount_percent, Some(33.0));
    }

    #[test]
    fn night_market_is_present_only_when_live() {
        let view = view();

        assert!(view.night_market.is_some());
        assert_eq!(view.night_market_ends_in_s, 900_000);
    }

    #[test]
    fn known_skin_levels_use_the_skin_name_and_art() {
        let index = AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache);

        let (name, image, _) = item_art(&index, ITEM_TYPE_SKIN_LEVELS, "level-1");

        assert_eq!(name, "Reaver Vandal");
        assert!(image.is_some());
    }
}
