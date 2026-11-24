//! Pacing for remote reads. About 30 quick requests on pd earn a 429 with
//! `Retry-After: 60`, so every remote read that is not a user action goes through here:
//! at most 2 in flight, 350 ms apart, one shared backoff window for all callers, and a
//! 5-minute cache so each lobby asks each endpoint once per match.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::sync::{Mutex, Semaphore};

use crate::http::{Request, RiotHttp};

const MAX_CONCURRENT_REQUESTS: usize = 2;
const REQUEST_SPACING: Duration = Duration::from_millis(350);
const DEFAULT_BACKOFF: Duration = Duration::from_secs(2);
const MAX_BACKOFF: Duration = Duration::from_secs(20);
const MAX_ATTEMPTS: u32 = 3;
const RESPONSE_TTL: Duration = Duration::from_secs(300);
/// Bound on cached responses; expired entries are dropped first.
const MAX_CACHED_RESPONSES: usize = 512;

/// Whether a successful answer may be served from / stored in the cache.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CachePolicy {
    Cached,
    /// Match history, party reads: must be fresh every time.
    Fresh,
}

/// Result of a gated read. `is_complete == false` means "we failed to ask", which callers must
/// keep apart from "the player has no data" (an outage is not an empty history).
#[derive(Debug, Clone, PartialEq)]
pub struct Fetched {
    pub data: Value,
    pub is_complete: bool,
    pub status: u16,
}

impl Fetched {
    fn answered(data: Value, status: u16) -> Self {
        Self {
            data,
            is_complete: true,
            status,
        }
    }

    fn failed(status: u16) -> Self {
        Self {
            data: Value::Null,
            is_complete: false,
            status,
        }
    }
}

/// What to do after one attempt.
#[derive(Debug, PartialEq)]
enum Verdict {
    Done(Fetched),
    RetryAfter(Duration),
    GiveUp(u16),
}

pub struct RateGate {
    permits: Semaphore,
    resume_at: Mutex<Instant>,
    cache: Mutex<HashMap<String, (Instant, Value)>>,
}

impl Default for RateGate {
    fn default() -> Self {
        Self {
            permits: Semaphore::new(MAX_CONCURRENT_REQUESTS),
            resume_at: Mutex::new(Instant::now()),
            cache: Mutex::new(HashMap::new()),
        }
    }
}

impl RateGate {
    /// Paced read with retries. Never holds a lock while sleeping out a backoff.
    pub async fn fetch(&self, http: &RiotHttp, request: &Request, policy: CachePolicy) -> Fetched {
        let key = format!("{:?}{}", request.host, request.path);
        if let Some(cached) = self.cached(&key, policy).await {
            return Fetched::answered(cached, 200);
        }
        let mut last_status = 0;
        for attempt in 0..MAX_ATTEMPTS {
            let Ok(_permit) = self.permits.acquire().await else {
                break;
            };
            if let Some(cached) = self.cached(&key, policy).await {
                return Fetched::answered(cached, 200);
            }
            self.wait_for_window().await;
            let reply = http.send(request).await;
            last_status = reply.status;
            match judge(reply.status, reply.retry_after, attempt, &reply.body) {
                Verdict::Done(fetched) => return self.remember(key, policy, fetched).await,
                Verdict::RetryAfter(wait) => self.push_window(wait).await,
                Verdict::GiveUp(status) => {
                    last_status = status;
                    break;
                }
            }
        }
        tracing::warn!(path = %crate::http::redacted_path(&request.path), status = last_status, "riot_gate_gave_up");
        Fetched::failed(last_status)
    }

    async fn cached(&self, key: &str, policy: CachePolicy) -> Option<Value> {
        if policy == CachePolicy::Fresh {
            return None;
        }
        let cache = self.cache.lock().await;
        let (stored_at, value) = cache.get(key)?;
        (stored_at.elapsed() < RESPONSE_TTL).then(|| value.clone())
    }

    async fn remember(&self, key: String, policy: CachePolicy, fetched: Fetched) -> Fetched {
        if policy == CachePolicy::Cached && fetched.status == 200 {
            let mut cache = self.cache.lock().await;
            if cache.len() >= MAX_CACHED_RESPONSES {
                cache.retain(|_, (stored_at, _)| stored_at.elapsed() < RESPONSE_TTL);
            }
            if cache.len() < MAX_CACHED_RESPONSES {
                cache.insert(key, (Instant::now(), fetched.data.clone()));
            }
        }
        fetched
    }

    /// Sleep until the shared backoff window has passed, then the spacing gap.
    async fn wait_for_window(&self) {
        let resume_at = *self.resume_at.lock().await;
        tokio::time::sleep_until(resume_at.into()).await;
        tokio::time::sleep(REQUEST_SPACING).await;
    }

    /// Extend the shared window; a 60 s `Retry-After` is honoured literally for everyone.
    async fn push_window(&self, wait: Duration) {
        let mut resume_at = self.resume_at.lock().await;
        *resume_at = (*resume_at).max(Instant::now() + wait);
    }
}

/// Classify one answer (pure, so the retry rules are testable without a network).
fn judge(status: u16, retry_after: Option<Duration>, attempt: u32, body: &str) -> Verdict {
    match status {
        200..=299 => {
            let data = serde_json::from_str(body).unwrap_or(Value::Null);
            Verdict::Done(Fetched::answered(data, status))
        }
        // Legitimately absent (match not published, player never played the queue).
        404 => Verdict::Done(Fetched::answered(Value::Null, status)),
        429 => Verdict::RetryAfter(retry_after.unwrap_or_else(|| backoff(attempt))),
        0 | 500..=599 => Verdict::RetryAfter(backoff(attempt)),
        // Other 4xx cannot succeed by waiting; backing off on them stalled the old app.
        _ => Verdict::GiveUp(status),
    }
}

fn backoff(attempt: u32) -> Duration {
    DEFAULT_BACKOFF
        .saturating_mul(2u32.saturating_pow(attempt))
        .min(MAX_BACKOFF)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_decodes_the_body() {
        let verdict = judge(200, None, 0, r#"{"a":1}"#);
        assert_eq!(
            verdict,
            Verdict::Done(Fetched::answered(serde_json::json!({"a": 1}), 200))
        );
    }

    #[test]
    fn not_found_is_a_complete_empty_answer() {
        let Verdict::Done(fetched) = judge(404, None, 0, "") else {
            panic!("done")
        };
        assert!(fetched.is_complete);
        assert_eq!(fetched.data, Value::Null);
    }

    #[test]
    fn rate_limit_honours_retry_after_literally() {
        let wait = Duration::from_secs(60);
        assert_eq!(judge(429, Some(wait), 0, ""), Verdict::RetryAfter(wait));
    }

    #[test]
    fn rate_limit_without_header_backs_off_exponentially_with_a_cap() {
        assert_eq!(
            judge(429, None, 0, ""),
            Verdict::RetryAfter(Duration::from_secs(2))
        );
        assert_eq!(
            judge(429, None, 2, ""),
            Verdict::RetryAfter(Duration::from_secs(8))
        );
        assert_eq!(backoff(10), MAX_BACKOFF);
    }

    #[test]
    fn transport_and_server_errors_are_retried() {
        assert!(matches!(judge(0, None, 0, ""), Verdict::RetryAfter(_)));
        assert!(matches!(judge(503, None, 1, ""), Verdict::RetryAfter(_)));
    }

    #[test]
    fn other_client_errors_give_up_immediately() {
        assert_eq!(judge(403, None, 0, ""), Verdict::GiveUp(403));
        assert_eq!(judge(400, None, 0, ""), Verdict::GiveUp(400));
    }
}
