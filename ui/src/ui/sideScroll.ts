// One-row strips that slide sideways (mode chips, tabs): a mouse wheel only scrolls up and down,
// so without this a strip wider than its panel hides its last items from mouse users.

/** Turns a vertical wheel turn into a sideways slide; a trackpad's own sideways swipe passes through. */
export function slideOnWheel(event: WheelEvent & { currentTarget: HTMLElement }): void {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  event.preventDefault();
  event.currentTarget.scrollLeft += event.deltaY;
}
