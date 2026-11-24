import { describe, expect, it } from "vitest";
import pickerSheet from "./agentPicker.module.css?raw";
import lobbySheet from "./lobby.module.css?raw";
import summarySheet from "./postmatchLayouts.module.css?raw";
import skinPickerSheet from "./skinPickerLayouts.module.css?raw";
import storeSheet from "./store.module.css?raw";
import valStoreSheet from "./styled/currentStore.module.css?raw";

// Read as text: tests run without the JSX transform, so the registry cannot be imported here.
const SOURCES = import.meta.glob<string>("../studio/registry/**/*.tsx", { query: "?raw", import: "default", eager: true });
// LF throughout: a Windows checkout may hand the files over with CRLF.
const registry = Object.values(SOURCES).join("\n").replaceAll("\r\n", "\n");

/** Each curated piece and the sheet that must style its layouts. */
const CURATED: Record<string, string> = {
  "val-store": valStoreSheet,
  "agent-picker": pickerSheet,
  lobby: lobbySheet,
  "post-match": summarySheet,
  "skin-picker": skinPickerSheet,
  "store-bundle": storeSheet,
};

/** Every piece sheet, for layouts styled outside a curated piece's own sheet. */
const ALL_SHEETS = Object.values(
  import.meta.glob<string>("./**/*.module.css", { query: "?raw", import: "default", eager: true }),
).join("\n");

/** Each registered piece's layout values in order, read entry by entry ([] without layouts). */
const LAYOUTS_BY_KIND = new Map(
  registry
    .split(/\n {2}\{\n {4}kind: /)
    .slice(1)
    .map((entry): [string, string[]] => {
      const kind = /^"([^"]+)"/.exec(entry)?.[1] ?? "";
      const list = /layouts: \[([\s\S]*?)\],/.exec(entry)?.[1] ?? "";
      return [kind, [...list.matchAll(/value: "([a-z-]+)"/g)].map((match) => match[1] ?? "")];
    }),
);

const layoutsOf = (kind: string): string[] => LAYOUTS_BY_KIND.get(kind) ?? [];

/** Each piece's size-driven layouts (autoLayouts), read the same way. */
const AUTO_BY_KIND = new Map(
  registry
    .split(/\n {2}\{\n {4}kind: /)
    .slice(1)
    .map((entry): [string, string[]] => {
      const kind = /^"([^"]+)"/.exec(entry)?.[1] ?? "";
      const list = /autoLayouts: \{([^}]*)\}/.exec(entry)?.[1] ?? "";
      return [kind, [...list.matchAll(/"([a-z-]+)"/g)].map((match) => match[1] ?? "")];
    }),
);

describe.each(Object.entries(CURATED))("%s layouts", (kind, sheet) => {
  it("offers several layouts", () => {
    expect(layoutsOf(kind).length).toBeGreaterThan(2);
  });

  it("styles every layout except the first, which is the piece's base look", () => {
    const rest = layoutsOf(kind).slice(1);
    expect(rest.filter((layout) => sheet.includes(`[data-layout="${layout}"]`))).toEqual(rest);
  });
});

describe("every piece with layouts", () => {
  const withLayouts = [...LAYOUTS_BY_KIND].filter(([, values]) => values.length > 0);

  it("are found in the registry", () => {
    expect(withLayouts.length).toBeGreaterThan(Object.keys(CURATED).length);
  });

  it.each(withLayouts)("%s styles each layout after its first", (_kind, values) => {
    const unstyled = values.slice(1).filter((layout) => !ALL_SHEETS.includes(`[data-layout="${layout}"]`));
    expect(unstyled).toEqual([]);
  });
});

describe("pieces that change layout with their size", () => {
  const sized = [...AUTO_BY_KIND].filter(([, values]) => values.length > 0);

  it("are found in the registry", () => {
    expect(sized.length).toBeGreaterThan(10);
  });

  it.each(sized)("%s only switches to layouts it offers", (kind, values) => {
    expect(values.filter((value) => !layoutsOf(kind).includes(value))).toEqual([]);
  });
});
