import { describe, expect, it } from "vitest";
import { type ShortcutKey, isBrowserShortcut } from "./browserKeys";

const press = (key: string, mods: Partial<ShortcutKey> = {}): ShortcutKey => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe("isBrowserShortcut", () => {
  it("catches reload, print and history keys", () => {
    const keys = [press("r", { ctrlKey: true }), press("P", { ctrlKey: true }), press("F5"), press("ArrowLeft", { altKey: true })];
    expect(keys.map(isBrowserShortcut)).toEqual([true, true, true, true]);
  });

  it("leaves the menu's own keys alone", () => {
    expect([press("r"), press("ArrowLeft"), press("Escape")].map(isBrowserShortcut)).toEqual([false, false, false]);
  });
});
