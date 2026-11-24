// Turns links people paste (TikTok, YouTube, Twitch, Spotify) into embeddable player
// urls, and guesses which widget a pasted link should become.

export type EmbedKind = "web" | "image" | "video";

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

/** True when `host` is `domain` itself or one of its subdomains (not `evil-domain.com`). */
export function isDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Which widget a pasted url belongs in. */
export function kindForUrl(raw: string): EmbedKind | null {
  const url = parse(raw);
  if (!url) return null;
  if (IMAGE_EXTENSIONS.test(url.pathname) || isDomain(url.hostname, "giphy.com")) return "image";
  if (VIDEO_EXTENSIONS.test(url.pathname)) return "video";
  return "web";
}

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.slice(1) || null;
  if (!isDomain(url.hostname, "youtube.com")) return null;
  if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
    return url.pathname.split("/")[2] ?? null;
  }
  return url.searchParams.get("v");
}

/** The player url to put in an iframe; unknown sites pass through unchanged. */
export function embedUrl(raw: string, parentHost = window.location.hostname || "localhost"): string {
  const url = parse(raw);
  if (!url) return "";
  const host = url.hostname.replace(/^www\./, "");
  if (isDomain(host, "tiktok.com")) {
    const id = /\/video\/(\d+)/.exec(url.pathname)?.[1];
    return id ? `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&music_info=0&description=0` : raw;
  }
  const youtube = youtubeId(url);
  if (youtube) {
    return `https://www.youtube.com/embed/${youtube}?autoplay=1&mute=1&loop=1&playlist=${youtube}&controls=0`;
  }
  if (host === "twitch.tv" || host === "m.twitch.tv") {
    const channel = url.pathname.split("/")[1];
    return channel ? `https://player.twitch.tv/?channel=${channel}&parent=${parentHost}&muted=true` : raw;
  }
  if (host === "open.spotify.com" && !url.pathname.startsWith("/embed")) {
    return `https://open.spotify.com/embed${url.pathname}`;
  }
  return url.toString();
}

/** Short label for the source of an embed. */
export function embedSource(raw: string): string {
  const url = parse(raw);
  if (!url) return "Web";
  const host = url.hostname.replace(/^www\./, "");
  if (isDomain(host, "tiktok.com")) return "TikTok";
  if (isDomain(host, "youtube.com") || host === "youtu.be") return "YouTube";
  if (isDomain(host, "twitch.tv")) return "Twitch";
  if (isDomain(host, "spotify.com")) return "Spotify";
  return host;
}

/** Sites that refuse to be shown inside another app (they send frame-blocking headers). */
const FRAME_BLOCKING_HOSTS = ["instagram.com", "x.com", "twitter.com", "facebook.com", "reddit.com", "discord.com", "google.com", "github.com"];

/** TikTok's own short links (`vm.tiktok.com/...`), which the app follows to the video first. */
export function isShortLink(raw: string): boolean {
  const url = parse(raw);
  if (!url || url.protocol !== "https:") return false;
  const host = url.hostname;
  return host === "vm.tiktok.com" || host === "vt.tiktok.com" || (isDomain(host, "tiktok.com") && url.pathname.startsWith("/t/"));
}

/** Why a link cannot show in the widget, or null when it can. */
export function blockedReason(raw: string): string | null {
  const url = parse(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (isDomain(host, "tiktok.com") && !isShortLink(raw) && !/\/video\/\d+/.test(url.pathname) && !url.pathname.startsWith("/player/") && !url.pathname.startsWith("/embed/")) {
    return "TikTok only lets single videos play inside other apps. Paste a video link (Share > Copy link on a video).";
  }
  if (FRAME_BLOCKING_HOSTS.some((blocked) => isDomain(host, blocked))) {
    return `${host} does not allow itself to be shown inside other apps.`;
  }
  return null;
}
