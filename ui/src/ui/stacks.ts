// Party stacks, as every screen marks them: the size in players' words ("Duo", "Trio") and one
// colour per stack (theme --party-* tokens), so a duo reads the same on the friends list, the
// live lobby, the post-match scoreboard and the history.

const STACK_COLORS = ["var(--party-1)", "var(--party-2)", "var(--party-3)", "var(--party-4)", "var(--party-5)"];

/** A party's size as players say it: "Duo", "Trio", "4-stack"; empty for a solo player. */
export function partyLabel(size: number): string {
  if (size <= 1) return "";
  if (size === 2) return "Duo";
  if (size === 3) return "Trio";
  return `${size}-stack`;
}

/** The colour of stack `group`, or transparent for a solo player. */
export function stackColor(group: number | null): string {
  if (group === null) return "transparent";
  return STACK_COLORS[group % STACK_COLORS.length] ?? "transparent";
}
