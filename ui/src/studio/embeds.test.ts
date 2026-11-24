import { describe, expect, it } from "vitest";
import { blockedReason, embedSource, embedUrl, isDomain, isShortLink, kindForUrl } from "./embeds";

describe("embeds", () => {
  it("turns a TikTok video link into the embed player", () => {
    const url = embedUrl("https://www.tiktok.com/@user/video/7234567890123456789?lang=en", "tauri.localhost");
    expect(url).toBe("https://www.tiktok.com/player/v1/7234567890123456789?autoplay=1&loop=1&music_info=0&description=0");
  });

  it("turns YouTube watch, short and youtu.be links into a looping muted embed", () => {
    for (const link of ["https://www.youtube.com/watch?v=abc123", "https://youtu.be/abc123", "https://youtube.com/shorts/abc123"]) {
      expect(embedUrl(link, "x")).toBe("https://www.youtube.com/embed/abc123?autoplay=1&mute=1&loop=1&playlist=abc123&controls=0");
    }
  });

  it("gives Twitch the parent host it requires", () => {
    expect(embedUrl("https://www.twitch.tv/somechannel", "tauri.localhost")).toBe(
      "https://player.twitch.tv/?channel=somechannel&parent=tauri.localhost&muted=true",
    );
  });

  it("keeps other sites and rejects non-web links", () => {
    expect(embedUrl("https://example.com/page", "x")).toBe("https://example.com/page");
    expect(embedUrl("javascript:alert(1)", "x")).toBe("");
    expect(embedUrl("not a url", "x")).toBe("");
  });

  it("guesses the widget for a link", () => {
    expect(kindForUrl("https://media.giphy.com/media/x/giphy.gif")).toBe("image");
    expect(kindForUrl("https://cdn.example.com/clip.webm")).toBe("video");
    expect(kindForUrl("https://www.tiktok.com/@a/video/1")).toBe("web");
    expect(kindForUrl("hello")).toBeNull();
  });

  it("names the source", () => {
    expect(embedSource("https://www.tiktok.com/@a/video/1")).toBe("TikTok");
    expect(embedSource("https://open.spotify.com/track/1")).toBe("Spotify");
  });

  it("knows TikTok short links and which links cannot be framed", () => {
    expect(isShortLink("https://vm.tiktok.com/ZMabc/")).toBe(true);
    expect(isShortLink("https://www.tiktok.com/t/ZTabc/")).toBe(true);
    expect(isShortLink("https://www.tiktok.com/@a/video/1")).toBe(false);
    expect(blockedReason("https://www.tiktok.com/@a/video/1")).toBeNull();
    expect(blockedReason("https://www.tiktok.com/@someone")).not.toBeNull();
    expect(blockedReason("https://www.tiktok.com/")).not.toBeNull();
    expect(blockedReason("https://www.instagram.com/p/x")).not.toBeNull();
    expect(blockedReason("https://open.spotify.com/track/1")).toBeNull();
  });

  it("matches a domain and its subdomains, not look-alikes", () => {
    expect([isDomain("tiktok.com", "tiktok.com"), isDomain("vm.tiktok.com", "tiktok.com")]).toEqual([true, true]);
    expect(isDomain("eviltiktok.com", "tiktok.com")).toBe(false);
    expect(isShortLink("https://eviltiktok.com/t/abc/")).toBe(false);
    expect(embedSource("https://notyoutube.com/watch?v=x")).toBe("notyoutube.com");
    expect(kindForUrl("https://evilgiphy.com/page")).toBe("web");
  });
});
