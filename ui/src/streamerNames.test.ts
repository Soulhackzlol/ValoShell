import { describe, expect, it } from "vitest";

// Streamer mode must hide every player name and party code the app puts on screen. The blur
// reaches only elements marked `data-sensitive` (theme/base.css), so a name or code drawn as text
// needs the mark on itself or a parent close above it. A tooltip is drawn outside the page and
// can't be blurred, so a tooltip naming a player goes through sensitiveTitle (state/settings.ts).
// Toasts aren't blurred either, so only state/partyCode.ts may put a code in one, and it checks.
const SOURCES = import.meta.glob<string>(["./**/*.tsx", "./**/*.ts", "!./**/*.test.ts"], {
  query: "?raw",
  import: "default",
  eager: true,
});

/** A player's name (or a piece of it) as a JSX value: `{friend.game_name}`, `{playerName(p)}`... */
const NAME_AS_TEXT = />\{[^}]*(game_name|playerName\(|lobbyName\(|profile\.name\(\)|\.riot_id|ownRiotId\(\)\??\.name)[^}]*\}/;
/** A party code as a JSX value; anyone who reads it can join the party. */
const CODE_AS_TEXT = />\{[^}]*invite_code[^}]*\}|>\{code\(\)\}/;
const NAME_IN_TOOLTIP = /title=\{[^\n]*(game_name|tag_line|playerName\(|lobbyName\(|profile\.name\(\))/;
const CODE_IN_TOAST = /pushToast\([^\n]*(invite_code|\bcode\b)/;
const CODE_TOAST_OWNER = "./state/partyCode.ts";
/** How far above a name its `data-sensitive` parent may sit (a wrapping element or two). */
const PARENT_LINES = 6;

function secretsWithoutBlur(path: string, source: string): string[] {
  const lines = source.split("\n");
  return lines.flatMap((line, index) => {
    if (!NAME_AS_TEXT.test(line) && !CODE_AS_TEXT.test(line)) return [];
    const nearby = lines.slice(Math.max(0, index - PARENT_LINES), index + 1).join("\n");
    return nearby.includes("data-sensitive") ? [] : [`${path}:${index + 1}`];
  });
}

function tooltipsWithNames(path: string, source: string): string[] {
  return source
    .split("\n")
    .flatMap((line, index) =>
      NAME_IN_TOOLTIP.test(line) && !line.includes("sensitiveTitle(") ? [`${path}:${index + 1}`] : [],
    );
}

function toastsWithCodes(path: string, source: string): string[] {
  if (path === CODE_TOAST_OWNER) return [];
  return source.split("\n").flatMap((line, index) => (CODE_IN_TOAST.test(line) ? [`${path}:${index + 1}`] : []));
}

/** Every finding of `check` across the app's sources. */
function leaksOf(check: (path: string, source: string) => string[]): string[] {
  return Object.entries(SOURCES).flatMap(([path, source]) => check(path, source));
}

describe("streamer mode", () => {
  it("blurs every player name and party code drawn on screen", () => {
    expect(leaksOf(secretsWithoutBlur)).toEqual([]);
  });

  it("drops tooltips that name a player", () => {
    expect(leaksOf(tooltipsWithNames)).toEqual([]);
  });

  it("keeps party codes out of toasts", () => {
    expect(leaksOf(toastsWithCodes)).toEqual([]);
  });

  it("reads the app's sources (an empty glob would pass the checks above)", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  });

  it("would catch each kind of leak", () => {
    expect(secretsWithoutBlur("x.tsx", "<b>{friend.game_name}</b>")).toEqual(["x.tsx:1"]);
    expect(secretsWithoutBlur("x.tsx", "<span>{view().invite_code}</span>")).toEqual(["x.tsx:1"]);
    expect(tooltipsWithNames("x.tsx", "<i title={friend.game_name} />")).toEqual(["x.tsx:1"]);
    expect(toastsWithCodes("x.tsx", 'pushToast("positive", "Copied", code);')).toEqual(["x.tsx:1"]);
  });
});
