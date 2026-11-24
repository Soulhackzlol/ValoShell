// Any match row, in any style, opens that match's summary: a click, or Enter / Space when the
// row has focus. Studio's edit mode leaves rows alone so they can be selected and dragged.
import { useNavigate } from "@solidjs/router";
import { isEditing } from "~/studio/store";
import { playCue } from "./sound";

/** The summary route for one match. */
export function matchSummaryPath(matchId: string): string {
  return `/post-match?match=${encodeURIComponent(matchId)}`;
}

/** What a row needs to act like a button that opens its match. */
export interface MatchRowProps {
  role: "button";
  tabIndex: number;
  title: string;
  "data-opens-match": "";
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

export interface OpenMatch {
  /** Go to one match's summary (ignored while editing). */
  open: (matchId: string) => void;
  /** Attributes that make a row open its match; spread them first so the row can override. */
  rowProps: (matchId: string) => MatchRowProps;
}

export function useOpenMatch(): OpenMatch {
  const navigate = useNavigate();
  const open = (matchId: string) => {
    if (isEditing() || !matchId) return;
    playCue("confirm");
    navigate(matchSummaryPath(matchId));
  };
  const rowProps = (matchId: string): MatchRowProps => ({
    role: "button",
    tabIndex: 0,
    title: "Open the match summary",
    "data-opens-match": "",
    onClick: () => open(matchId),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Styles with a global Enter shortcut (Pip-Boy's PLAY) must not see this key too.
      event.preventDefault();
      event.stopPropagation();
      open(matchId);
    },
  });
  return { open, rowProps };
}
