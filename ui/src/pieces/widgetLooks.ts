// The Look and Layout options every free widget shares. Looks are drawn by
// widgetLooks.module.css from theme tokens, so each menu style recolours them, and "Style's own"
// is drawn in each menu style's own language; layouts are
// read by each widget's own CSS, and "auto" is resolved here from the piece's size.
import { createSignal, onCleanup } from "solid-js";
import type { PieceProps, PropField } from "~/studio/registry";

export const WIDGET_LOOKS = [
  { value: "native", label: "Style's own" },
  { value: "panel", label: "Panel" },
  { value: "glass", label: "Glass" },
  { value: "minimal", label: "Minimal" },
  { value: "broadcast", label: "Broadcast" },
] as const;

export const WIDGET_LAYOUTS = [
  { value: "auto", label: "Auto (fits the box)" },
  { value: "row", label: "Row" },
  { value: "stack", label: "Stack" },
  { value: "compact", label: "Compact" },
] as const;

export const LOOK_FIELD: PropField = { key: "look", label: "Look", type: "select", options: WIDGET_LOOKS };
export const LAYOUT_FIELD: PropField = { key: "layout", label: "Layout", type: "select", options: WIDGET_LAYOUTS };

const FALLBACKS = { look: "panel", layout: "auto" } as const;
const ALLOWED: Record<keyof typeof FALLBACKS, readonly string[]> = {
  look: WIDGET_LOOKS.map((option) => option.value),
  layout: WIDGET_LAYOUTS.map((option) => option.value),
};

/** Below either size only the essentials fit on one line. */
const COMPACT_MAX = { w: 170, h: 56 };
/** Width-to-height ratio from which a box reads as a strip rather than a card. */
const ROW_MIN_RATIO = 3.2;

/**
 * The piece's look or layout. Anything unset or unknown (layouts saved before these options)
 * gets `fallback`, which each widget sets to the look it always had.
 */
export function widgetChoice(props: PieceProps, key: keyof typeof FALLBACKS, fallback: string = FALLBACKS[key]): string {
  const value = props.piece.props[key];
  return typeof value === "string" && ALLOWED[key].includes(value) ? value : fallback;
}

/** The layout a box of this size gets under "auto". */
export function autoLayout(width: number, height: number): "row" | "stack" | "compact" {
  if (width <= COMPACT_MAX.w || height <= COMPACT_MAX.h) return "compact";
  return height > 0 && width / height >= ROW_MIN_RATIO ? "row" : "stack";
}

/**
 * The layout to draw: the picked one, or under "auto" the one that fits the box. Pass the
 * returned `ref` to the widget's outer element.
 */
export function useWidgetLayout(props: PieceProps): { ref: (element: HTMLElement) => void; layout: () => string } {
  const [box, setBox] = createSignal({ width: 0, height: 0 });
  const observer = new ResizeObserver(([entry]) => {
    if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
  });
  onCleanup(() => observer.disconnect());
  const layout = () => {
    const picked = widgetChoice(props, "layout");
    if (picked !== "auto") return picked;
    const { width, height } = box();
    return width === 0 ? "stack" : autoLayout(width, height);
  };
  return { ref: (element) => observer.observe(element), layout };
}
