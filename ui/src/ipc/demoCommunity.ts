// The community gallery in the browser preview: the looks in the repository's community/
// folder, served the way the app reads them from GitHub (so the preview shows exactly what a
// merged look will look like).
import type { CommunityLook } from "~/bindings/CommunityLook";

/** A line of community/index.json; the app's backend turns `thumb` into `has_thumb`. */
type IndexEntry = Omit<CommunityLook, "has_thumb"> & { thumb?: boolean };

const INDEX = import.meta.glob<{ looks: IndexEntry[] }>("../../../community/index.json", {
  eager: true,
  import: "default",
});
const LOOKS = import.meta.glob<unknown>("../../../community/looks/*.json", { eager: true, import: "default" });
const THUMBS = import.meta.glob<string>("../../../community/thumbs/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export function demoCommunityLooks(): CommunityLook[] {
  const entries = Object.values(INDEX)[0]?.looks ?? [];
  return entries.map(({ thumb, ...entry }) => ({ ...entry, has_thumb: thumb === true }));
}

export function demoCommunityLook({ id }: { id: string }): unknown {
  const look = LOOKS[`../../../community/looks/${id}.json`];
  if (!look) throw new Error("That shared look is not available.");
  return look;
}

/** A URL here, where the app returns a `data:` URL; the card shows either the same way. */
export function demoCommunityThumb({ id }: { id: string }): string {
  const thumb = THUMBS[`../../../community/thumbs/${id}.webp`];
  if (!thumb) throw new Error("That shared look is not available.");
  return thumb;
}
