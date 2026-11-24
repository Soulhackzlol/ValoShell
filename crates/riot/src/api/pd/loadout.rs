//! Player loadout v3: read-modify-write of the equipped cosmetics.
//!
//! Every struct keeps unknown fields in `extra` so a GET -> mutate -> PUT cycle never drops
//! data Riot adds later (Sprays already became ActiveExpressions once).

use domain::ids::Puuid;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::error::{RiotError, RiotResult};
use crate::http::{Host, Request};

fn loadout_path(puuid: &Puuid) -> String {
    format!("/personalization/v3/players/{puuid}/playerloadout")
}

/// `GET /personalization/v3/players/{puuid}/playerloadout` (own puuid only).
pub fn get_player_loadout(puuid: &Puuid) -> Request {
    Request::get(Host::Pd, loadout_path(puuid))
}

/// `PUT /personalization/v3/players/{puuid}/playerloadout`: full replace.
///
/// The body is the GET response without `Subject` and `Version`. Send all guns: whether omitted
/// guns reset is UNVERIFIED. Errors only if the loadout cannot be serialized.
pub fn put_player_loadout(puuid: &Puuid, loadout: &PlayerLoadout) -> RiotResult<Request> {
    let path = loadout_path(puuid);
    let mut body = loadout.clone();
    body.subject = None;
    body.version = None;
    let body = serde_json::to_value(&body).map_err(|error| RiotError::Decode {
        endpoint: crate::http::redacted_path(&path),
        reason: error.to_string(),
    })?;
    Ok(Request::put(Host::Pd, path).json(body))
}

/// The equipped cosmetics of the account.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase", default)]
pub struct PlayerLoadout {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<u64>,
    pub guns: Vec<Gun>,
    pub active_expressions: Vec<Expression>,
    /// "Usually empty"; meaning UNVERIFIED, so it is preserved verbatim.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dynamic_options: Option<Value>,
    pub identity: Identity,
    pub incognito: bool,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

impl PlayerLoadout {
    /// The entry of one weapon uuid, for editing its skin or buddy.
    pub fn gun_mut(&mut self, weapon_id: &str) -> Option<&mut Gun> {
        self.guns
            .iter_mut()
            .find(|gun| gun.id.eq_ignore_ascii_case(weapon_id))
    }
}

/// One weapon slot. The knife has no `Charm*` fields, hence the options.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Gun {
    #[serde(rename = "ID")]
    pub id: String,
    #[serde(rename = "SkinID")]
    pub skin_id: String,
    #[serde(rename = "SkinLevelID")]
    pub skin_level_id: String,
    #[serde(rename = "ChromaID")]
    pub chroma_id: String,
    #[serde(rename = "CharmInstanceID", skip_serializing_if = "Option::is_none")]
    pub charm_instance_id: Option<String>,
    #[serde(rename = "CharmID", skip_serializing_if = "Option::is_none")]
    pub charm_id: Option<String>,
    #[serde(rename = "CharmLevelID", skip_serializing_if = "Option::is_none")]
    pub charm_level_id: Option<String>,
    /// Always `[]` in practice.
    #[serde(rename = "Attachments")]
    pub attachments: Vec<Value>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// A spray or flex slot. Slot order is meaningful (UNVERIFIED how): change only `asset_id`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Expression {
    #[serde(rename = "TypeID")]
    pub type_id: String,
    #[serde(rename = "AssetID")]
    pub asset_id: String,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

/// Player card, title and level display.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct Identity {
    #[serde(rename = "PlayerCardID")]
    pub player_card_id: String,
    #[serde(rename = "PlayerTitleID")]
    pub player_title_id: String,
    /// Echoed from GET; read-only server-side.
    #[serde(rename = "AccountLevel")]
    pub account_level: u32,
    /// Empty string means "automatic".
    #[serde(rename = "PreferredLevelBorderID")]
    pub preferred_level_border_id: String,
    #[serde(rename = "HideAccountLevel")]
    pub hide_account_level: bool,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("fixtures/loadout.json");
    const VANDAL: &str = "9c82e19d-4575-0200-1a81-3eacf00cf872";

    fn fixture() -> PlayerLoadout {
        serde_json::from_str(FIXTURE).expect("fixture decodes")
    }

    #[test]
    fn get_request_targets_v3_loadout() {
        let request = get_player_loadout(&Puuid::new("abc"));

        assert_eq!(request.method, reqwest::Method::GET);
        assert_eq!(
            request.path,
            "/personalization/v3/players/abc/playerloadout"
        );
    }

    #[test]
    fn fixture_decodes_typed_fields() {
        let loadout = fixture();

        assert_eq!(loadout.version, Some(524));
        assert_eq!(loadout.guns.len(), 2);
        assert_eq!(
            loadout.guns[0].charm_id.as_deref(),
            Some("f2f07eae-4518-15eb-546b-018961e0dd60")
        );
        assert!(loadout.guns[1].charm_id.is_none());
        assert_eq!(
            loadout.active_expressions[2].type_id,
            "03a572de-4234-31ed-d344-ababa488f981"
        );
        assert_eq!(loadout.identity.account_level, 120);
        assert!(!loadout.incognito);
    }

    #[test]
    fn put_body_drops_subject_and_version() {
        let request = put_player_loadout(&Puuid::new("abc"), &fixture()).expect("builds");

        let body = request.body.expect("body");
        assert_eq!(request.method, reqwest::Method::PUT);
        assert_eq!(
            request.path,
            "/personalization/v3/players/abc/playerloadout"
        );
        assert!(body.get("Subject").is_none());
        assert!(body.get("Version").is_none());
        assert_eq!(body["Identity"]["AccountLevel"], 120);
    }

    #[test]
    fn modified_loadout_round_trips_unknown_fields() {
        let mut loadout = fixture();
        loadout.gun_mut(VANDAL).expect("vandal").skin_id = "new-skin".to_owned();
        loadout.active_expressions[1].asset_id = "new-spray".to_owned();
        loadout.identity.hide_account_level = true;

        let request = put_player_loadout(&Puuid::new("abc"), &loadout).expect("builds");

        let body = request.body.expect("body");
        assert_eq!(body["Guns"][0]["SkinID"], "new-skin");
        assert_eq!(body["Guns"][0]["FutureGunField"]["keep"], true);
        assert_eq!(body["ActiveExpressions"][0]["Slot"], 0);
        assert_eq!(body["ActiveExpressions"][1]["AssetID"], "new-spray");
        assert_eq!(body["DynamicOptions"]["Experiment"], "A");
        assert_eq!(body["Identity"]["FutureIdentityField"], 7);
        assert_eq!(body["Identity"]["HideAccountLevel"], true);
        assert_eq!(body["FutureTopLevelField"], "kept");
    }

    #[test]
    fn knife_serializes_without_charm_fields() {
        let request = put_player_loadout(&Puuid::new("abc"), &fixture()).expect("builds");

        let knife = &request.body.expect("body")["Guns"][1];

        assert!(knife.get("CharmID").is_none());
        assert_eq!(knife["Attachments"], serde_json::json!([]));
    }

    #[test]
    fn unchanged_loadout_keeps_every_input_key() {
        let original: Value = serde_json::from_str(FIXTURE).expect("json");

        let again = serde_json::to_value(fixture()).expect("serializes");

        for key in original.as_object().expect("object").keys() {
            assert!(again.get(key).is_some(), "missing {key}");
        }
    }
}
