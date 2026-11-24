//! Short links pasted into the web widget (`vm.tiktok.com/...`) only say where they lead by
//! redirecting, which a page cannot follow across origins. This follows them for the UI.
//! Only known short-link hosts are fetched: it is not a general-purpose proxy.

use std::time::Duration;

const SHORT_LINK_HOSTS: [&str; 2] = ["vm.tiktok.com", "vt.tiktok.com"];
const TIMEOUT: Duration = Duration::from_secs(8);
/// TikTok answers bare clients with an error page instead of the redirect.
const BROWSER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/// TikTok itself or one of its subdomains; a bare suffix check would also let `eviltiktok.com` in.
fn is_tiktok_host(host: &str) -> bool {
    host == "tiktok.com" || host.ends_with(".tiktok.com")
}

/// True for a link this module would follow.
pub fn is_short_link(raw: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(raw.trim()) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default();
    url.scheme() == "https"
        && (SHORT_LINK_HOSTS.contains(&host)
            || (is_tiktok_host(host) && url.path().starts_with("/t/")))
}

/// Where a short link leads, or `None` when it is not one or cannot be followed.
pub async fn resolve_short_link(raw: &str) -> Option<String> {
    if !is_short_link(raw) {
        return None;
    }
    riot::tls::install_crypto_provider();
    let client = reqwest::Client::builder()
        .user_agent(BROWSER_AGENT)
        .timeout(TIMEOUT)
        .build()
        .ok()?;
    let response = client.get(raw.trim()).send().await.ok()?;
    Some(response.url().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_tiktok_short_links_are_followed() {
        assert!(is_short_link("https://vm.tiktok.com/ZMabc123/"));
        assert!(is_short_link("https://www.tiktok.com/t/ZTabc/"));
        assert!(!is_short_link("http://vm.tiktok.com/ZMabc123/"));
        assert!(!is_short_link("https://www.tiktok.com/@someone/video/123"));
        assert!(!is_short_link("https://example.com/vm.tiktok.com"));
        assert!(!is_short_link("https://eviltiktok.com/t/ZTabc/"));
    }
}
