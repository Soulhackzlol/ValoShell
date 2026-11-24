import { createRoot } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useConfirmPress } from "./confirmPress";

afterEach(() => {
  vi.useRealTimers();
});

function setUp() {
  const action = vi.fn();
  const press = createRoot(() => useConfirmPress(action, 3000));
  return { action, press };
}

describe("useConfirmPress", () => {
  it("arms on the first press and acts on the second", () => {
    const { action, press } = setUp();
    press.press();
    expect(press.isArmed()).toBe(true);
    expect(action).not.toHaveBeenCalled();
    press.press();
    expect(action).toHaveBeenCalledTimes(1);
    expect(press.isArmed()).toBe(false);
  });

  it("disarms on its own, so a later stray click only arms again", () => {
    vi.useFakeTimers();
    const { action, press } = setUp();
    press.press();
    vi.advanceTimersByTime(3001);
    expect(press.isArmed()).toBe(false);
    press.press();
    expect(action).not.toHaveBeenCalled();
  });
});
