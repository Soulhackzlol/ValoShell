// Every backend command with its argument and result types. `call` is the only way the UI
// talks to Rust; in a plain browser (dev preview, filming without the game) the demo backend
// answers instead, so every screen stays usable.
import { invoke } from "@tauri-apps/api/core";
import type { AgentOfferView } from "~/bindings/AgentOfferView";
import type { AgentProgress } from "~/bindings/AgentProgress";
import type { CareerView } from "~/bindings/CareerView";
import type { ChatScope } from "~/bindings/ChatScope";
import type { ChatView } from "~/bindings/ChatView";
import type { Catalog } from "~/bindings/Catalog";
import type { CollectionView } from "~/bindings/CollectionView";
import type { ConnectionStatus } from "~/bindings/ConnectionStatus";
import type { CosmeticKind } from "~/bindings/CosmeticKind";
import type { CosmeticOption } from "~/bindings/CosmeticOption";
import type { FriendRequestView } from "~/bindings/FriendRequestView";
import type { FriendView } from "~/bindings/FriendView";
import type { GameSnapshot } from "~/bindings/GameSnapshot";
import type { GameVideo } from "~/bindings/GameVideo";
import type { UiSound } from "~/bindings/UiSound";
import type { LobbyView } from "~/bindings/LobbyView";
import type { PartyView } from "~/bindings/PartyView";
import type { PenaltyView } from "~/bindings/PenaltyView";
import type { PostMatchView } from "~/bindings/PostMatchView";
import type { PresetApplied } from "~/bindings/PresetApplied";
import type { PregameView } from "~/bindings/PregameView";
import type { ProgressView } from "~/bindings/ProgressView";
import type { ServiceNoticeView } from "~/bindings/ServiceNoticeView";
import type { Settings } from "~/bindings/Settings";
import type { SkinCard } from "~/bindings/SkinCard";
import type { SkinOption } from "~/bindings/SkinOption";
import type { StatsView } from "~/bindings/StatsView";
import type { StoreView } from "~/bindings/StoreView";
import type { UpdateView } from "~/bindings/UpdateView";
import type { HistoryView } from "~/bindings/HistoryView";
import type { IdentityChange } from "~/bindings/IdentityChange";
import type { IdentityView } from "~/bindings/IdentityView";
import type { LeaderboardView } from "~/bindings/LeaderboardView";
import type { InstantCloneAction } from "~/bindings/InstantCloneAction";
import type { InstantCloneState } from "~/bindings/InstantCloneState";
import type { InstantCloneTarget } from "~/bindings/InstantCloneTarget";
import type { CommunityLook } from "~/bindings/CommunityLook";
import type { NewsView } from "~/bindings/NewsView";
import type { WalletView } from "~/bindings/WalletView";
import { isTauri } from "./runtime";

type NoArgs = Record<string, never>;

export interface CommandMap {
  get_settings: [NoArgs, Settings];
  save_settings: [{ settings: Settings }, Settings];
  get_game_snapshot: [NoArgs, GameSnapshot];
  get_connection: [NoArgs, ConnectionStatus];
  get_catalog: [NoArgs, Catalog];
  get_game_videos: [NoArgs, GameVideo[]];
  get_ui_sounds: [NoArgs, UiSound[]];
  open_sounds_folder: [NoArgs, null];
  resolve_embed_link: [{ url: string }, string | null];
  get_wallet: [NoArgs, WalletView | null];
  quit_app: [NoArgs, null];
  get_store: [{ isForced: boolean }, StoreView];
  get_career: [{ isForced: boolean }, CareerView];
  get_progress: [{ isForced: boolean }, ProgressView];
  get_leaderboard: [{ isForced: boolean }, LeaderboardView];
  get_match_history: [{ isForced: boolean }, HistoryView];
  get_match_summary: [{ matchId: string }, PostMatchView];
  get_stats: [{ isForced: boolean }, StatsView];
  get_news: [{ locale: string }, NewsView | null];
  get_lobby: [NoArgs, LobbyView | null];
  get_post_match: [NoArgs, PostMatchView | null];
  dismiss_post_match: [NoArgs, null];
  get_friends: [NoArgs, FriendView[]];
  get_collection: [NoArgs, CollectionView];
  get_skin_options: [{ weaponId: string }, SkinOption[]];
  equip_skin: [{ weaponId: string; skinId: string; chromaId: string }, CollectionView];
  get_identity: [NoArgs, IdentityView];
  search_store_skins: [{ query: string }, SkinCard[]];
  get_skin_cards: [{ skinIds: string[] }, SkinCard[]];
  get_cosmetic_options: [{ kind: CosmeticKind }, CosmeticOption[]];
  equip_identity: [{ change: IdentityChange }, IdentityView];
  get_agent_progress: [{ isForced: boolean }, AgentProgress];
  get_party: [NoArgs, PartyView | null];
  party_refresh: [NoArgs, PartyView | null];
  get_penalties: [NoArgs, PenaltyView[]];
  get_friend_requests: [NoArgs, FriendRequestView[]];
  friend_request_accept: [{ puuid: string }, null];
  /** Declines an incoming request or cancels an outgoing one. */
  friend_request_remove: [{ puuid: string }, null];
  friend_request_send: [{ riotId: string }, null];
  get_service_status: [NoArgs, ServiceNoticeView[]];
  /** View only: there is no command that buys. */
  get_agent_store: [NoArgs, AgentOfferView[]];
  /** Skin ids starred in VALORANT itself (lowercase); read only. */
  get_favorite_skins: [NoArgs, string[]];
  get_chat: [NoArgs, ChatView | null];
  chat_send: [{ scope: ChatScope; text: string }, null];
  chat_send_direct: [{ puuid: string; text: string }, null];
  party_change_queue: [{ queueId: string }, null];
  party_start_queue: [NoArgs, null];
  party_stop_queue: [NoArgs, null];
  party_set_ready: [{ isReady: boolean }, null];
  party_set_open: [{ isOpen: boolean }, null];
  party_invite: [{ riotId: string }, null];
  party_kick: [{ puuid: string }, null];
  party_leave: [NoArgs, null];
  party_generate_code: [NoArgs, null];
  party_join_code: [{ code: string }, null];
  party_change_team: [{ team: "attackers" | "defenders" | "spectators"; puuid: string }, null];
  party_start_custom: [NoArgs, null];
  get_pregame: [NoArgs, PregameView | null];
  pregame_select: [{ agentUuid: string }, null];
  pregame_lock: [{ agentUuid: string }, null];
  pregame_dodge: [NoArgs, null];
  list_ui_documents: [{ kind: DocumentKind }, string[]];
  load_ui_document: [{ kind: DocumentKind; name: string }, unknown];
  save_ui_document: [{ kind: DocumentKind; name: string; document: unknown }, null];
  delete_ui_document: [{ kind: DocumentKind; name: string }, null];
  open_looks_folder: [NoArgs, null];
  reveal_look: [{ name: string }, null];
  /** The community gallery's list, read from the ValoShell repository. */
  community_looks: [NoArgs, CommunityLook[]];
  /** One community look's document; untrusted, so normalizeDoc it before use. */
  community_look: [{ id: string }, unknown];
  /** One community look's screenshot as a `data:` URL (only a WebP passes). */
  community_thumb: [{ id: string }, string];
  save_loadout_preset: [{ name: string }, null];
  apply_loadout_preset: [{ name: string }, PresetApplied];
  set_overlay_enabled: [{ isEnabled: boolean }, null];
  set_window_mode: [{ isWindowed: boolean }, null];
  set_overlay_preview: [{ isVisible: boolean }, null];
  instant_clone_state: [{ target: InstantCloneTarget }, InstantCloneState | null];
  instant_clone_send: [{ target: InstantCloneTarget; action: InstantCloneAction; delayMs: number }, null];
  get_update: [NoArgs, UpdateView];
  check_for_update: [NoArgs, UpdateView];
  /** Restarts into the new copy; only answers when the install failed. */
  install_update: [NoArgs, null];
}

export type DocumentKind = "layouts" | "themes" | "loadouts";
export type Command = keyof CommandMap;
export type ArgsOf<C extends Command> = CommandMap[C][0];
export type ResultOf<C extends Command> = CommandMap[C][1];

/** Run a backend command. Rejects with the backend's plain-language message. */
export async function call<C extends Command>(command: C, args: ArgsOf<C>): Promise<ResultOf<C>> {
  if (isTauri) {
    return invoke<ResultOf<C>>(command, args);
  }
  const demo = await import("./demo");
  return demo.handle(command, args);
}

/** The message of a rejected `call`, whatever shape it came in. */
export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
