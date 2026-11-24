//! Collection: what each weapon wears, the skins you own for it, the identity cosmetics
//! (card, title, sprays, flex, buddies), loadout presets, and equipping any of them. Equipping is a
//! read-modify-write of the whole loadout (fresh GET, change one thing, PUT) so nothing else
//! in the loadout can be lost or reverted.

mod identity;
mod presets;
mod view;
mod wishlist;

use std::collections::HashSet;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant};

use riot::api::pd::entitlements::{
    Entitlement, Entitlements, ITEM_TYPE_BUDDIES, ITEM_TYPE_SKIN_CHROMAS, ITEM_TYPE_SKIN_LEVELS,
    get_entitlements,
};
use riot::api::pd::loadout::{PlayerLoadout, get_player_loadout, put_player_loadout};
use riot::session::RiotSession;

pub use identity::{
    BuddyCopy, CosmeticKind, CosmeticOption, ExpressionSlot, GunBuddy, IdentityChange, IdentityView,
};
use identity::{
    Ownership, apply_change, change_kind, cosmetic_options, identity_view, with_free_items,
};
pub use presets::{LoadoutPreset, PresetApplied};
use presets::{PresetOwnership, apply_preset, preset_of};
pub(crate) use view::edition_of;
pub use view::{ChromaOption, CollectionView, Owned, SkinOption, WeaponSlot};
use view::{collection_view, equipped_gun, skin_options};
pub use wishlist::{SkinCard, search_skins, skin_cards};

use crate::action::{ActionError, fetch_json, send_ok};
use crate::assets::{AssetIndex, AssetStore};
use crate::ctx::Ctx;

/// Owned items change rarely (a purchase); re-read them this often at most.
const OWNED_TTL: Duration = Duration::from_secs(5 * 60);

/// Cheap to clone.
#[derive(Clone)]
pub struct CollectionService {
    ctx: Ctx,
    assets: AssetStore,
    owned: Arc<Mutex<Option<(Instant, Owned)>>>,
    /// Held across each GET-change-PUT, so two equips never interleave and undo each other.
    writes: Arc<tokio::sync::Mutex<()>>,
}

impl CollectionService {
    pub fn new(ctx: Ctx, assets: AssetStore) -> Self {
        Self {
            ctx,
            assets,
            owned: Arc::new(Mutex::new(None)),
            writes: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    fn session(&self) -> Result<Arc<RiotSession>, ActionError> {
        self.ctx.session().ok_or(ActionError::NotConnected)
    }

    /// Every weapon with its equipped skin.
    pub async fn view(&self) -> Result<CollectionView, ActionError> {
        let session = self.session()?;
        let loadout = read_loadout(&session).await?;
        Ok(collection_view(&self.assets.index(), &loadout))
    }

    /// Owned skins for one weapon.
    pub async fn options(&self, weapon_id: &str) -> Result<Vec<SkinOption>, ActionError> {
        let session = self.session()?;
        let owned = self.owned(&session).await?;
        Ok(skin_options(&self.assets.index(), weapon_id, &owned))
    }

    /// Put `skin_id` (in `chroma_id` when owned) on `weapon_id`.
    pub async fn equip(
        &self,
        weapon_id: &str,
        skin_id: &str,
        chroma_id: &str,
    ) -> Result<CollectionView, ActionError> {
        let session = self.session()?;
        let index = self.assets.index();
        let weapon = index
            .weapon_of_skin(skin_id)
            .filter(|weapon| weapon.uuid.eq_ignore_ascii_case(weapon_id))
            .ok_or_else(|| {
                ActionError::could_not("equip that skin", "it does not belong to this weapon")
            })?;
        let owned = self.owned(&session).await?;
        let is_owned = skin_options(&index, &weapon.uuid, &owned)
            .iter()
            .any(|option| option.skin_id.eq_ignore_ascii_case(skin_id));
        let skin = index
            .skin(skin_id)
            .filter(|_| is_owned)
            .ok_or_else(|| ActionError::could_not("equip that skin", "you do not own it"))?;
        let (skin_id, level_id, chroma_id) = equipped_gun(&skin, chroma_id, &owned)
            .ok_or_else(|| ActionError::could_not("equip that skin", "its data is incomplete"))?;
        let _write = self.writes.lock().await;
        let mut loadout = read_loadout(&session).await?;
        let gun = loadout.gun_mut(&weapon.uuid).ok_or_else(|| {
            ActionError::could_not("equip that skin", "the weapon is missing from your loadout")
        })?;
        gun.skin_id = skin_id;
        gun.skin_level_id = level_id;
        gun.chroma_id = chroma_id;
        let request = put_player_loadout(&session.puuid, &loadout)
            .map_err(|error| ActionError::could_not("equip that skin", error))?;
        let reply = send_ok(&session.http, &request, "equip that skin").await?;
        let saved = saved_loadout(&reply.body, loadout);
        Ok(collection_view(&index, &saved))
    }

    /// Card, title, the spray/flex wheel and every gun's buddy.
    pub async fn identity(&self) -> Result<IdentityView, ActionError> {
        let session = self.session()?;
        let loadout = read_loadout(&session).await?;
        Ok(identity_view(&self.assets.index(), &loadout))
    }

    /// Owned cosmetics of one kind (plus the free ones and whatever is worn now).
    pub async fn cosmetic_options(
        &self,
        kind: CosmeticKind,
    ) -> Result<Vec<CosmeticOption>, ActionError> {
        let session = self.session()?;
        let index = self.assets.index();
        let (loadout, owned) = tokio::join!(
            read_loadout(&session),
            read_cosmetics(&session, &index, kind)
        );
        let equipped = equipped_ids(&loadout?, kind);
        Ok(cosmetic_options(&index, kind, &owned?, &equipped))
    }

    /// Equip one identity cosmetic; returns the updated identity.
    pub async fn equip_identity(
        &self,
        change: &IdentityChange,
    ) -> Result<IdentityView, ActionError> {
        let session = self.session()?;
        let index = self.assets.index();
        let _write = self.writes.lock().await;
        let mut loadout = read_loadout(&session).await?;
        let kind = change_kind(&loadout, change).ok_or_else(|| {
            ActionError::could_not("equip that", "that wheel slot cannot be changed")
        })?;
        let owned = read_cosmetics(&session, &index, kind).await?;
        let buddies = match kind {
            CosmeticKind::Buddy => read_buddy_copies(&session).await?,
            _ => Vec::new(),
        };
        let ownership = Ownership {
            owned: &owned,
            buddies: &buddies,
        };
        apply_change(&mut loadout, &index, change, &ownership)?;
        let request = put_player_loadout(&session.puuid, &loadout)
            .map_err(|error| ActionError::could_not("equip that", error))?;
        let reply = send_ok(&session.http, &request, "equip that").await?;
        let saved = saved_loadout(&reply.body, loadout);
        Ok(identity_view(&index, &saved))
    }

    /// The loadout as it is now, to save as a preset.
    pub async fn snapshot_preset(&self) -> Result<LoadoutPreset, ActionError> {
        let session = self.session()?;
        Ok(preset_of(&read_loadout(&session).await?))
    }

    /// Equip a saved preset in one go; items no longer owned are skipped and counted.
    pub async fn apply_preset(&self, preset: &LoadoutPreset) -> Result<PresetApplied, ActionError> {
        let session = self.session()?;
        let index = self.assets.index();
        let _write = self.writes.lock().await;
        let (loadout, skins, cards, titles, sprays, flex, buddies) = tokio::join!(
            read_loadout(&session),
            self.owned(&session),
            read_cosmetics(&session, &index, CosmeticKind::Card),
            read_cosmetics(&session, &index, CosmeticKind::Title),
            read_cosmetics(&session, &index, CosmeticKind::Spray),
            read_cosmetics(&session, &index, CosmeticKind::Flex),
            read_buddy_copies(&session),
        );
        let mut loadout = loadout?;
        let (skins, cards, titles, sprays, flex, buddies) =
            (skins?, cards?, titles?, sprays?, flex?, buddies?);
        let ownership = PresetOwnership {
            skins: &skins,
            cards: &cards,
            titles: &titles,
            sprays: &sprays,
            flex: &flex,
            buddies: &buddies,
        };
        let skipped = apply_preset(&mut loadout, &index, preset, &ownership);
        let request = put_player_loadout(&session.puuid, &loadout)
            .map_err(|error| ActionError::could_not("equip that loadout", error))?;
        let reply = send_ok(&session.http, &request, "equip that loadout").await?;
        let saved = saved_loadout(&reply.body, loadout);
        Ok(PresetApplied {
            collection: collection_view(&index, &saved),
            skipped,
        })
    }

    async fn owned(&self, session: &RiotSession) -> Result<Owned, ActionError> {
        if let Some((at, owned)) = self
            .owned
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_ref()
            && at.elapsed() < OWNED_TTL
        {
            return Ok(owned.clone());
        }
        let owned = Owned {
            skin_levels: read_owned(session, ITEM_TYPE_SKIN_LEVELS).await?,
            chromas: read_owned(session, ITEM_TYPE_SKIN_CHROMAS).await?,
        };
        *self.owned.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((Instant::now(), owned.clone()));
        Ok(owned)
    }
}

/// The loadout, always fresh (the game may have changed it since).
async fn read_loadout(session: &RiotSession) -> Result<PlayerLoadout, ActionError> {
    session
        .http
        .send_json(&get_player_loadout(&session.puuid))
        .await
        .map_err(|error| ActionError::could_not("read your loadout", error))
}

/// Ids worn now of one kind, so the picker lists them even when they are Riot defaults.
fn equipped_ids(loadout: &PlayerLoadout, kind: CosmeticKind) -> Vec<String> {
    match kind {
        CosmeticKind::Card => vec![loadout.identity.player_card_id.clone()],
        CosmeticKind::Title => vec![loadout.identity.player_title_id.clone()],
        CosmeticKind::Buddy => loadout
            .guns
            .iter()
            .filter_map(|gun| gun.charm_level_id.clone())
            .collect(),
        CosmeticKind::Spray | CosmeticKind::Flex => loadout
            .active_expressions
            .iter()
            .filter(|expression| expression.type_id.eq_ignore_ascii_case(kind.item_type()))
            .map(|expression| expression.asset_id.clone())
            .collect(),
    }
}

/// Every owned entry of one entitlement type.
async fn read_entitlements(
    session: &RiotSession,
    item_type: &str,
) -> Result<Vec<Entitlement>, ActionError> {
    let request = get_entitlements(&session.puuid, item_type);
    let entitlements: Entitlements = fetch_json(session, &request, "read your collection").await?;
    Ok(entitlements
        .of_type(item_type)
        .into_iter()
        .cloned()
        .collect())
}

/// Lower-case ids of every owned item of one entitlement type.
pub(crate) async fn read_owned(
    session: &RiotSession,
    item_type: &str,
) -> Result<HashSet<String>, ActionError> {
    Ok(read_entitlements(session, item_type)
        .await?
        .into_iter()
        .filter_map(|entry| entry.item_id.map(|id| id.to_string().to_lowercase()))
        .collect())
}

/// Identity cosmetics of one kind the player may wear: owned ones plus Riot's free ones.
async fn read_cosmetics(
    session: &RiotSession,
    index: &AssetIndex,
    kind: CosmeticKind,
) -> Result<HashSet<String>, ActionError> {
    let owned = read_owned(session, kind.item_type()).await?;
    Ok(with_free_items(owned, index, kind))
}

/// Every owned buddy copy (one entry per copy, each with its own instance id).
async fn read_buddy_copies(session: &RiotSession) -> Result<Vec<BuddyCopy>, ActionError> {
    Ok(read_entitlements(session, ITEM_TYPE_BUDDIES)
        .await?
        .into_iter()
        .filter_map(|entry| {
            Some(BuddyCopy {
                level_id: entry.item_id?.to_string().to_lowercase(),
                instance_id: entry.instance_id?,
            })
        })
        .collect())
}
/// The loadout Riot saved, from its answer to the PUT. An answer that doesn't decode keeps the
/// one just sent, which Riot accepted; logged so a changed reply shape shows up.
fn saved_loadout(body: &str, sent: PlayerLoadout) -> PlayerLoadout {
    serde_json::from_str(body).unwrap_or_else(|error| {
        tracing::warn!(%error, "loadout_reply_unreadable");
        sent
    })
}
