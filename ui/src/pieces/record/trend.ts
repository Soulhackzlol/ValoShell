// Pure helpers the record layouts draw with: the climb as one line across rank changes, an SVG
// path through it, a match's calendar day, a rank in roman numerals and a radar's outline.
import type { RrUpdate } from "~/bindings/RrUpdate";

/** RR points per tier, so a promotion continues the line upward instead of dropping to 0. */
const POINTS_PER_TIER = 100;

/** Rank points after each game, oldest first: tier × 100 + RR. */
export function rankTrend(updates: readonly RrUpdate[]): number[] {
  return [...updates].reverse().map((update) => update.rank_after.tier * POINTS_PER_TIER + update.rr_after);
}

export interface ChartBox {
  width: number;
  height: number;
  /** Space kept free above and below the line, in the chart's units. */
  pad: number;
}

/** Points of `values` spread over the box, the lowest at the bottom and the highest at the top. */
export function chartPoints(values: readonly number[], box: ChartBox): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const step = values.length > 1 ? box.width / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: values.length > 1 ? index * step : box.width / 2,
    y: box.pad + (1 - (value - low) / span) * (box.height - box.pad * 2),
  }));
}

/** An SVG path through the points; `isArea` closes it down to the box's floor for a fill. */
export function chartPath(points: readonly { x: number; y: number }[], height: number, isArea = false): string {
  if (points.length === 0) return "";
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  if (!isArea) return line;
  const first = points[0] as { x: number };
  const last = points[points.length - 1] as { x: number };
  return `${line} L${last.x.toFixed(1)} ${height} L${first.x.toFixed(1)} ${height} Z`;
}

export interface CalendarDay {
  month: number;
  day: number;
  weekday: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The local calendar day a match was played on. */
export function calendarDay(ms: number): CalendarDay {
  const date = new Date(ms);
  return { month: date.getMonth() + 1, day: date.getDate(), weekday: WEEKDAYS[date.getDay()] ?? "" };
}

const ROMAN = ["", "I", "II", "III"] as const;

/** "Diamond 1" as League writes it, "Diamond I"; names without a division stay as they are. */
export function romanRank(name: string): string {
  const match = /^(.*) ([1-3])$/.exec(name);
  return match ? `${match[1]} ${ROMAN[Number(match[2])]}` : name;
}

/** The outline of a radar chart: one point per value (0..1), the first straight up, clockwise. */
export function radarPoints(values: readonly number[], radius: number, center: number): string {
  return values
    .map((value, index) => {
      const angle = (index / values.length) * Math.PI * 2 - Math.PI / 2;
      const reach = radius * Math.min(1, Math.max(0, value));
      return `${(center + Math.cos(angle) * reach).toFixed(1)},${(center + Math.sin(angle) * reach).toFixed(1)}`;
    })
    .join(" ");
}
