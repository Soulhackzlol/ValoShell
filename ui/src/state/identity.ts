// Identity cosmetics (card, title, spray/flex wheel, buddies): what is worn lives in
// `identityView`; owned options are read once per kind per session, since only a purchase
// changes them; equipping goes through Riot and shows its answer.
import type { CosmeticKind } from "~/bindings/CosmeticKind";
import type { CosmeticOption } from "~/bindings/CosmeticOption";
import type { IdentityChange } from "~/bindings/IdentityChange";
import { call, errorText } from "~/ipc/commands";
import { onAppEvent } from "~/ipc/events";
import { playCue } from "~/menu/sound";
import { pushToast } from "./toasts";
import { identityView } from "./views";

const optionsByKind = new Map<CosmeticKind, Promise<CosmeticOption[]>>();

/** Owned options of one kind; a failed read is forgotten so the next open asks again. */
export function cosmeticOptions(kind: CosmeticKind): Promise<CosmeticOption[]> {
  const known = optionsByKind.get(kind);
  if (known) return known;
  const loading = call("get_cosmetic_options", { kind });
  optionsByKind.set(kind, loading);
  loading.catch(() => optionsByKind.delete(kind));
  return loading;
}

/** Equip one cosmetic; `true` when Riot accepted it. */
export async function equipIdentity(change: IdentityChange): Promise<boolean> {
  try {
    identityView.set(await call("equip_identity", { change }));
    playCue("confirm");
    // The party lineup carries the card and title art; read it now rather than on its next event.
    if (change.kind === "card" || change.kind === "title") {
      void call("party_refresh", {}).catch((error) => console.warn("party_refresh_failed", error));
    }
    return true;
  } catch (failure) {
    pushToast("negative", "Not equipped", errorText(failure));
    return false;
  }
}

// Another account owns other things: forget what was read for the last one.
onAppEvent("connection", (status) => {
  if (status.state !== "connected") return;
  optionsByKind.clear();
  if (identityView.value() || identityView.error()) void identityView.load(true);
});
