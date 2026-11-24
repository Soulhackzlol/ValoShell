//! Riot's service status for the player's region: running or scheduled maintenance and
//! warning/critical incidents, so the menu can say why queueing or the store may fail.

use riot::api::local::status::{
    Incident, Maintenance, ServiceStatus, get_service_status, latest_update_text, localized,
    parse_status_body,
};
use serde::Serialize;
use ts_rs::TS;

use crate::action::ActionError;
use crate::ctx::Ctx;

const STATUS_ENDPOINT: &str = "riot_status";
const STATUS_READ: &str = "read the server status";
const IN_PROGRESS: &str = "in_progress";
const CRITICAL: &str = "critical";

/// What kind of notice Riot posted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ServiceNoticeKind {
    Maintenance,
    Incident,
}

/// One active maintenance or incident.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[ts(export)]
pub struct ServiceNoticeView {
    pub id: String,
    pub kind: ServiceNoticeKind,
    /// A maintenance running now or a critical incident (not a scheduled or minor one).
    pub is_urgent: bool,
    pub title: String,
    /// Riot's newest update; empty when there is none.
    pub detail: String,
}

fn maintenance_view(maintenance: &Maintenance) -> ServiceNoticeView {
    ServiceNoticeView {
        id: maintenance.id.clone(),
        kind: ServiceNoticeKind::Maintenance,
        is_urgent: maintenance.maintenance_status == IN_PROGRESS,
        title: localized(&maintenance.titles)
            .unwrap_or("Scheduled maintenance")
            .to_owned(),
        detail: latest_update_text(&maintenance.updates)
            .unwrap_or_default()
            .to_owned(),
    }
}

fn incident_view(incident: &Incident) -> ServiceNoticeView {
    ServiceNoticeView {
        id: incident.id.clone(),
        kind: ServiceNoticeKind::Incident,
        is_urgent: incident.incident_severity == CRITICAL,
        title: localized(&incident.titles)
            .unwrap_or("Service issue")
            .to_owned(),
        detail: latest_update_text(&incident.updates)
            .unwrap_or_default()
            .to_owned(),
    }
}

/// Active maintenances and shown incidents, urgent ones first.
pub fn service_notices(status: &ServiceStatus) -> Vec<ServiceNoticeView> {
    let mut notices: Vec<ServiceNoticeView> = status
        .active_maintenances()
        .map(maintenance_view)
        .chain(status.shown_incidents().map(incident_view))
        .collect();
    notices.sort_by_key(|notice| !notice.is_urgent);
    notices
}

/// The region's notices, read fresh (a local Riot Client call).
pub async fn read_service_status(ctx: &Ctx) -> Result<Vec<ServiceNoticeView>, ActionError> {
    let session = ctx.session().ok_or(ActionError::NotConnected)?;
    let request = get_service_status(&session.http.region().region);
    let reply = session.http.send(&request).await;
    if !reply.is_success() {
        tracing::warn!(
            endpoint = STATUS_ENDPOINT,
            status = reply.status,
            "riot_read_failed"
        );
        let reason = format!("Riot answered HTTP {}", reply.status);
        return Err(ActionError::could_not(STATUS_READ, reason));
    }
    let status = parse_status_body(&reply.body).map_err(|error| {
        tracing::warn!(endpoint = STATUS_ENDPOINT, %error, "riot_decode_failed");
        ActionError::could_not(STATUS_READ, "Riot sent an unexpected answer")
    })?;
    Ok(service_notices(&status))
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATUS: &str = r#"{
        "maintenances":[
          {"id":1,"maintenance_status":"scheduled",
           "titles":[{"locale":"en_US","content":"Patch 13.09"}],"updates":[]},
          {"id":2,"maintenance_status":"archived","titles":[],"updates":[]}],
        "incidents":[
          {"id":10,"incident_severity":"critical",
           "titles":[{"locale":"en_US","content":"Login issues"}],
           "updates":[{"translations":[{"locale":"en_US","content":"Investigating"}]}]},
          {"id":11,"incident_severity":"info","titles":[],"updates":[]}]}"#;

    fn notices() -> Vec<ServiceNoticeView> {
        service_notices(&parse_status_body(STATUS).expect("decodes"))
    }

    #[test]
    fn service_notices_keep_active_and_severe_entries_urgent_first() {
        let found = notices();

        let ids: Vec<&str> = found.iter().map(|notice| notice.id.as_str()).collect();

        assert_eq!(ids, ["10", "1"]);
    }

    #[test]
    fn service_notices_carry_title_detail_and_urgency() {
        let found = notices();

        assert_eq!(found[0].kind, ServiceNoticeKind::Incident);
        assert!(found[0].is_urgent);
        assert_eq!(found[0].title, "Login issues");
        assert_eq!(found[0].detail, "Investigating");
        assert!(!found[1].is_urgent);
        assert_eq!(found[1].detail, "");
    }

    #[test]
    fn service_notices_are_empty_without_problems() {
        assert!(service_notices(&ServiceStatus::default()).is_empty());
    }
}
