// Riot's server status for the player's region (maintenance, incidents): read at start, on
// connect and every few minutes while connected, since maintenance gets announced while playing.
import { createSignal } from "solid-js";
import type { ServiceNoticeView } from "~/bindings/ServiceNoticeView";
import { call } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";

const POLL_MS = 10 * 60_000;

const [serviceNotices, setServiceNotices] = createSignal<ServiceNoticeView[]>(
  [],
);
/** Ids the player dismissed; a notice Riot posts later still shows. */
const [dismissedIds, setDismissedIds] = createSignal<ReadonlySet<string>>(
  new Set(),
);

export { serviceNotices };

/** The notices not dismissed yet. */
export function visibleServiceNotices(): ServiceNoticeView[] {
  return serviceNotices().filter(
    (notice) => !dismissedIds().has(`${notice.kind}:${notice.id}`),
  );
}

export function dismissServiceNotices(): void {
  setDismissedIds(
    new Set(serviceNotices().map((notice) => `${notice.kind}:${notice.id}`)),
  );
}

/** Read the status again; a failed read keeps the last answer. */
export async function refreshServiceStatus(): Promise<void> {
  try {
    setServiceNotices(await call("get_service_status", {}));
  } catch (error) {
    // Only a hint: the menu works without it.
    console.warn("service_status_read_failed", error);
  }
}

void refreshServiceStatus();
let isConnected = false;
setInterval(() => {
  if (isConnected) void refreshServiceStatus();
}, POLL_MS);
onAppEvent("connection", (status) => {
  isConnected = status.state === "connected";
  if (isConnected) void refreshServiceStatus();
  else setServiceNotices([]);
});
