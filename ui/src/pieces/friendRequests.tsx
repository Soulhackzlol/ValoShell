// Friend requests inside the friends piece and drawer: an "Add friend" field (Riot ID) and the
// pending requests, incoming ones with Accept / Decline and outgoing ones with Cancel.
import { For, Show, createSignal } from "solid-js";
import { Check, UserPlus, X } from "lucide-solid";
import type { FriendRequestView } from "~/bindings/FriendRequestView";
import { playCue } from "~/menu/sound";
import {
  friendRequestActions,
  friendRequests,
  isRiotId,
} from "~/state/friendRequests";
import { isConnected } from "~/state/session";
import styles from "./friendRequests.module.css";

export function AddFriend() {
  const [riotId, setRiotId] = createSignal("");
  const [isBusy, setBusy] = createSignal(false);
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    if (await friendRequestActions.add(riotId())) setRiotId("");
    setBusy(false);
  };
  return (
    <form class={styles.add} onSubmit={(event) => void submit(event)}>
      <input
        placeholder="Add friend (Name#TAG)"
        aria-label="Add friend by Riot ID"
        value={riotId()}
        spellcheck={false}
        data-sensitive
        onInput={(event) => setRiotId(event.currentTarget.value)}
      />
      <button
        type="submit"
        title="Send friend request"
        disabled={isBusy() || !isRiotId(riotId()) || !isConnected()}
      >
        <UserPlus size={14} />
      </button>
    </form>
  );
}

function RequestRow(props: { request: FriendRequestView }) {
  const [isBusy, setBusy] = createSignal(false);
  const run = async (
    action: (puuid: string) => Promise<boolean>,
    cue: "confirm" | "back",
  ) => {
    playCue(cue);
    setBusy(true);
    await action(props.request.puuid);
    setBusy(false);
  };
  return (
    <li
      class={styles.row}
      data-incoming={props.request.is_incoming ? "" : undefined}
    >
      <span class={styles.name} data-sensitive>
        {props.request.game_name}
        <span class={styles.tag}>#{props.request.tag_line}</span>
      </span>
      <Show
        when={props.request.is_incoming}
        fallback={
          <button
            class={styles.action}
            disabled={isBusy()}
            title="Cancel request"
            onClick={() => void run(friendRequestActions.remove, "back")}
          >
            Cancel
          </button>
        }
      >
        <button
          class={styles.accept}
          disabled={isBusy()}
          title="Accept"
          aria-label={`Accept ${props.request.game_name}`}
          onClick={() => void run(friendRequestActions.accept, "confirm")}
        >
          <Check size={14} />
        </button>
        <button
          class={styles.action}
          disabled={isBusy()}
          title="Decline"
          aria-label={`Decline ${props.request.game_name}`}
          onClick={() => void run(friendRequestActions.remove, "back")}
        >
          <X size={14} />
        </button>
      </Show>
    </li>
  );
}

/** The pending requests; nothing at all when there are none. */
export function FriendRequests() {
  const incoming = () =>
    friendRequests().filter((request) => request.is_incoming);
  const outgoing = () =>
    friendRequests().filter((request) => !request.is_incoming);
  return (
    <Show when={friendRequests().length > 0}>
      <section class={styles.requests} aria-label="Friend requests">
        <Show when={incoming().length > 0}>
          <h3 class={styles.heading}>Requests · {incoming().length}</h3>
          <ol class={styles.rows}>
            <For each={incoming()}>
              {(request) => <RequestRow request={request} />}
            </For>
          </ol>
        </Show>
        <Show when={outgoing().length > 0}>
          <h3 class={styles.heading}>Sent · {outgoing().length}</h3>
          <ol class={styles.rows}>
            <For each={outgoing()}>
              {(request) => <RequestRow request={request} />}
            </For>
          </ol>
        </Show>
      </section>
    </Show>
  );
}
