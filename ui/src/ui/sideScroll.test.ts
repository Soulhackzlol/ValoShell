import { describe, expect, it, vi } from "vitest";
import { slideOnWheel } from "./sideScroll";

function wheel(deltaX: number, deltaY: number) {
  const strip = { scrollLeft: 0 } as HTMLElement;
  const preventDefault = vi.fn();
  slideOnWheel({ deltaX, deltaY, preventDefault, currentTarget: strip } as unknown as WheelEvent & { currentTarget: HTMLElement });
  return { scrollLeft: strip.scrollLeft, isPrevented: preventDefault.mock.calls.length > 0 };
}

describe("slideOnWheel", () => {
  it("slides the strip sideways by a vertical wheel turn", () => {
    expect(wheel(0, 120)).toEqual({ scrollLeft: 120, isPrevented: true });
  });

  it("leaves a sideways trackpad swipe to the browser", () => {
    expect(wheel(40, 5)).toEqual({ scrollLeft: 0, isPrevented: false });
  });
});
