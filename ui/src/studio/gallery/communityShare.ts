// The rules for sharing a look to the community gallery, without side effects so they run in
// tests. They match community/build_index.py, the check every shared look passes on GitHub, so
// a look that leaves ValoShell is never refused there for something ValoShell could have said.
import { remoteHosts } from "../lookFiles";
import type { StudioDoc } from "../types";

export const MAX_NAME_CHARS = 48;
export const MAX_AUTHOR_CHARS = 40;
export const MAX_DESCRIPTION_CHARS = 200;
const MAX_FILE_ID_CHARS = 64;
const FALLBACK_FILE_ID = "my-look";
/** Random characters after the name, so two "Neon Night" looks get different files. */
const SUFFIX_CHARS = 4;
const SUFFIX_RADIX = 36;

export interface ShareMeta {
  name: string;
  /** The credit shown on the card; blank shares without one. */
  author: string;
  description: string;
}

/** The file name (without `.json`) for a look called `name`: lowercase, digits and dashes. */
export function fileIdOf(name: string): string {
  const id = name
    .normalize("NFKD")
    // Accents split off by NFKD go, so "Crème" becomes "creme" rather than "cre-me".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILE_ID_CHARS)
    .replace(/-+$/, "");
  return id || FALLBACK_FILE_ID;
}

/** `fileIdOf(name)` plus a short random part (`neon-night-k3x9`): GitHub refuses a new file
 * whose name is taken, and two players may well pick the same name. */
export function uniqueFileId(name: string, random: () => number = Math.random): string {
  const suffix = Math.floor(random() * SUFFIX_RADIX ** SUFFIX_CHARS)
    .toString(SUFFIX_RADIX)
    .padStart(SUFFIX_CHARS, "0");
  // Room for "-" and the suffix, so the whole id stays within the length GitHub-side checks allow.
  const base = fileIdOf(name).slice(0, MAX_FILE_ID_CHARS - SUFFIX_CHARS - 1).replace(/-+$/, "");
  return `${base}-${suffix}`;
}

/** Why the look cannot be shared as it is; empty when it can. Messages say how to fix it. */
export function shareProblems(meta: ShareMeta, look: StudioDoc): string[] {
  const problems: string[] = [];
  if (!meta.name.trim()) problems.push("Give the look a name.");
  if (meta.name.trim().length > MAX_NAME_CHARS) {
    problems.push(`Keep the name under ${MAX_NAME_CHARS} characters.`);
  }
  if (meta.author.trim().length > MAX_AUTHOR_CHARS) {
    problems.push(`Keep the credit under ${MAX_AUTHOR_CHARS} characters.`);
  }
  if (meta.description.trim().length > MAX_DESCRIPTION_CHARS) {
    problems.push(`Keep the description under ${MAX_DESCRIPTION_CHARS} characters.`);
  }
  const hosts = remoteHosts(look);
  if (hosts.length > 0) {
    const sites = hosts.join(", ");
    problems.push(`It loads content from ${sites}; remove those web widgets or images first.`);
  }
  return problems;
}

/** The file a shared look is: the credit block, then the look itself. */
export function communityFile(meta: ShareMeta, look: StudioDoc): string {
  const community = { name: meta.name.trim(), author: meta.author.trim(), description: meta.description.trim() };
  return `${JSON.stringify({ community, ...look }, null, 2)}\n`;
}
