// Recognising look files (a shared look's `.json`) without touching the live document, so the
// checks run anywhere, tests included.

export const BYTES_PER_MB = 1024 * 1024;
/** Same cap as the backend's for stored documents (store/src/documents.rs). */
export const MAX_LOOK_FILE_BYTES = 4 * BYTES_PER_MB;

/** A file that may be a look (`.json`); anything else is left to the other drop handlers. */
export function isLookFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".json");
}

/** Whether parsed JSON has a look's shape, so an unrelated JSON file is never applied. */
export function isLookShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const isObject = (field: unknown) => typeof field === "object" && field !== null;
  return isObject(candidate["theme"]) && isObject(candidate["stages"]);
}

/** A link that makes the app fetch from a server: a web scheme, or protocol-relative `//host`. */
const REMOTE_LINK = /^\s*(?:(?:https?|wss?|ftp):)?\/\//i;
/** Deeper than any real look; stops a hostile file from recursing forever. */
const MAX_SCAN_DEPTH = 12;

function collectLinks(value: unknown, depth: number, links: string[]): void {
  if (typeof value === "string") {
    if (REMOTE_LINK.test(value)) links.push(value.trim());
    return;
  }
  if (depth >= MAX_SCAN_DEPTH || !value || typeof value !== "object") return;
  for (const child of Object.values(value)) collectLinks(child, depth + 1, links);
}

/** Hosts a look loads content from, found in every text value of it (any widget field: links,
 * images, sprays; the backdrop), so applying or sharing one can say where it will connect.
 * Sorted, without duplicates. */
export function remoteHosts(doc: { theme: unknown; stages: unknown }): string[] {
  const links: string[] = [];
  collectLinks(doc.theme, 0, links);
  collectLinks(doc.stages, 0, links);
  const hosts = new Set<string>();
  for (const link of links) {
    try {
      // The base only resolves `//host` links; full links ignore it.
      hosts.add(new URL(link, "https://base.invalid").hostname);
    } catch {
      // Not a parseable link: it loads nothing.
    }
  }
  return [...hosts].sort();
}
