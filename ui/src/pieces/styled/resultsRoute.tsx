// Which match a style's report shows, shared by every look of the Results job: the match just
// played (state/postMatch; Continue clears it and goes home), or a past one opened from the
// history with `?match=<id>` (Continue goes back to where it was opened).
import { type Component, Match, Show, Switch } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import type { PostMatchView } from "~/bindings/PostMatchView";
import { errorText } from "~/ipc/commands";
import { dismissPostMatch, postMatch } from "~/state/postMatch";
import { Empty } from "~/ui/controls";
import { usePastMatch } from "../postmatch";

export type ReportProps = { view: PostMatchView; onContinue: () => void };

function PastReport(props: { matchId: string; report: Component<ReportProps> }) {
  const { view, back } = usePastMatch(() => props.matchId);
  // The error is checked first: reading a failed resource throws.
  return (
    <Switch>
      <Match when={view.error}>
        <Empty title="Match report">{errorText(view.error)}</Empty>
      </Match>
      <Match when={view()}>{(loaded) => <props.report view={loaded()} onContinue={back} />}</Match>
      <Match when={view.loading}>
        <Empty title="Match report">Loading the match…</Empty>
      </Match>
    </Switch>
  );
}

function LatestReport(props: { report: Component<ReportProps> }) {
  const navigate = useNavigate();
  const close = () => {
    dismissPostMatch();
    navigate("/home");
  };
  return (
    <Show when={postMatch()} fallback={<Empty title="Match report">Your result appears here after a match.</Empty>}>
      {(view) => <props.report view={view()} onContinue={close} />}
    </Show>
  );
}

/** The report for the match the page is about. */
export function ResultsRoute(props: { report: Component<ReportProps> }) {
  const location = useLocation();
  const pastMatchId = () => new URLSearchParams(location.search).get("match");
  return (
    <Show when={pastMatchId()} keyed fallback={<LatestReport report={props.report} />}>
      {(matchId) => <PastReport matchId={matchId} report={props.report} />}
    </Show>
  );
}
