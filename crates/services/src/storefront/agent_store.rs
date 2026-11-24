//! The agent store: which agents are on sale and for what. View only: there is no buy call
//! here and there never will be; unlocking happens in VALORANT.

use riot::api::pd::store::{AgentStorefront, get_agent_storefront};
use serde::Serialize;
use ts_rs::TS;

use super::currency_of;
use crate::action::{ActionError, fetch_json};
use crate::assets::{AssetIndex, AssetStore, image_url};
use crate::ctx::Ctx;

const AGENT_STORE_READ: &str = "read the agent store";

/// One price an agent is offered at.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AgentPriceView {
    /// `vp` or `kc`.
    pub currency: String,
    #[ts(type = "number")]
    pub amount: i64,
}

/// One agent on sale.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct AgentOfferView {
    /// Lowercase agent uuid.
    pub agent_id: String,
    pub name: String,
    pub image: Option<String>,
    pub prices: Vec<AgentPriceView>,
}

/// Agents the asset cache knows, by name; free (priceless) offers are left out.
pub fn agent_offer_views(index: &AssetIndex, store: &AgentStorefront) -> Vec<AgentOfferView> {
    let mut views: Vec<AgentOfferView> = store
        .agent_store
        .agent_store_offers
        .iter()
        .filter_map(|offer| {
            let agent = index.agent(offer.agent_id.as_ref()?.as_str())?;
            let prices: Vec<AgentPriceView> = offer
                .store_offers
                .iter()
                .filter(|store_offer| !store_offer.cost.is_empty())
                .map(|store_offer| {
                    let (currency, amount) = currency_of(&store_offer.cost);
                    AgentPriceView {
                        currency: currency.to_owned(),
                        amount,
                    }
                })
                .collect();
            Some(AgentOfferView {
                agent_id: agent.uuid.to_lowercase(),
                name: agent.display_name.clone(),
                image: agent.display_icon.as_deref().map(image_url),
                prices,
            })
        })
        .filter(|view| !view.prices.is_empty())
        .collect();
    views.sort_by(|a, b| a.name.cmp(&b.name));
    views
}

/// The agent store, read fresh through the request pacing.
pub async fn read_agent_store(
    ctx: &Ctx,
    assets: &AssetStore,
) -> Result<Vec<AgentOfferView>, ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    let store: AgentStorefront = fetch_json(&session, &get_agent_storefront(), AGENT_STORE_READ)
        .await
        .inspect_err(
            |error| tracing::warn!(endpoint = "agent_store", %error, "riot_read_failed"),
        )?;
    Ok(agent_offer_views(&assets.index(), &store))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assets::{AssetSource, fixtures};

    fn index() -> AssetIndex {
        AssetIndex::from_documents(&fixtures::documents(), AssetSource::Cache)
    }

    fn store(json: &str) -> AgentStorefront {
        serde_json::from_str(json).expect("decodes")
    }

    #[test]
    fn agent_offer_views_name_agents_and_list_their_prices() {
        let json = r#"{"AgentStore":{"AgentStoreOffers":[{"AgentID":"add6443a-41bd-e414-f6ad-e58d267f4e95",
            "StoreOffers":[{"OfferID":"o1","Cost":{"85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741":1000}},
            {"OfferID":"o2","Cost":{"85ca954a-41f2-ce94-9b45-8ca3dd39a00d":8000}}]}]}}"#;

        let views = agent_offer_views(&index(), &store(json));

        assert_eq!(views[0].name, "Jett");
        let prices: Vec<(&str, i64)> = views[0]
            .prices
            .iter()
            .map(|price| (price.currency.as_str(), price.amount))
            .collect();
        assert_eq!(prices, [("vp", 1000), ("kc", 8000)]);
    }

    #[test]
    fn agent_offer_views_skip_unknown_agents_and_free_offers() {
        let json = r#"{"AgentStore":{"AgentStoreOffers":[{"AgentID":"unknown","StoreOffers":[
            {"Cost":{"c":1}}]},{"AgentID":"add6443a-41bd-e414-f6ad-e58d267f4e95",
            "StoreOffers":[{"Cost":{}}]}]}}"#;

        assert!(agent_offer_views(&index(), &store(json)).is_empty());
    }
}
