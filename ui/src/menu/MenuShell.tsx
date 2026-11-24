// The whole menu: scene backdrop, floating top nav, the active scene (a Studio stage), the
// scene-change wipe, toasts, the Esc menu, and in edit mode the Studio panels. Match-flow
// events move between scenes (agent select when a match is found, home afterwards).
import { Show, createEffect, createMemo, on, onCleanup, type ParentProps } from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { onAppEvent } from "~/ipc/events";
import { postMatch } from "~/state/postMatch";
import { isDockOpen } from "~/state/chat";
import { moment } from "~/state/moment";
import { pregame } from "~/state/pregame";
import { game } from "~/state/session";
import { pushToast } from "~/state/toasts";
import { addFromImageFile, addFromUrl, setCurrentStage } from "~/studio/actions";
import { isLookFile } from "~/studio/lookFiles";
import { applyLookFile } from "~/studio/looks";
import { Inspector } from "~/studio/inspector/Inspector";
import { StudioBar } from "~/studio/StudioBar";
import { useEditorShortcuts } from "~/studio/shortcuts";
import { jobOf } from "~/studio/registry/jobs";
import { doc, isEditing, stagePieces } from "~/studio/store";
import { FriendsDrawer } from "~/pieces/friends";
import { CosmeticPicker } from "~/pieces/identity";
import { LoadoutPresets } from "~/pieces/loadoutPresets";
import { WishlistDialog, WishlistDock } from "~/pieces/wishlist";
import { ChatDock } from "./chat/ChatDock";
import { ClickFx } from "./ClickFx";
import { WelcomeTour } from "./onboarding/WelcomeTour";
import { CommandPalette } from "./CommandPalette";
import { EscMenu } from "./EscMenu";
import { Intro } from "./Intro";
import { MatchFound } from "./MatchFound";
import { RestrictionNotice } from "./RestrictionNotice";
import { SceneBackdrop } from "./SceneBackdrop";
import { SceneWipe } from "./SceneWipe";
import { ServiceNotice } from "./ServiceNotice";
import { Toasts } from "./Toasts";
import { TopNav } from "./TopNav";
import { UpdateNotice } from "./UpdateNotice";
import { PreviewBridge } from "~/studio/gallery/PreviewBridge";
import { isLookPreview } from "~/ipc/runtime";
import { checkSmoothness } from "~/state/performance";
import { sceneForPath } from "./scenes";
import { useWindowMode } from "./windowMode";
import styles from "./MenuShell.module.css";

/** A page change animates for about this long before its frames say anything about the PC. */
const PAGE_SETTLE_MS = 1500;

export function MenuShell(props: ParentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const scene = () => sceneForPath(location.pathname);
  /** A chat line piece on this screen is its way into chat, so the floating chip steps aside. */
  const hasChatLine = () => stagePieces(scene()).some((piece) => !piece.isHidden && jobOf(piece.kind)?.id === "chat");
  let sceneArea: HTMLElement | undefined;

  createEffect(() => setCurrentStage(scene()));
  // Each page is measured once it has arrived; a PC that can't keep up gets Lite effects (Auto).
  // Only the page the player stays on is measured: a quick second change cancels the first check.
  let smoothnessTimer = 0;
  createEffect(
    on(
      scene,
      () => {
        window.clearTimeout(smoothnessTimer);
        smoothnessTimer = window.setTimeout(() => void checkSmoothness(), PAGE_SETTLE_MS);
      },
      { defer: true },
    ),
  );
  onCleanup(() => window.clearTimeout(smoothnessTimer));
  // The style's cursor gives way to the Studio's move and resize cursors while editing.
  createEffect(() => document.documentElement.toggleAttribute("data-studio", isEditing()));
  onCleanup(() => document.documentElement.removeAttribute("data-studio"));
  // The game moment on the root, so every style can restyle the menu while searching, in a
  // party or straight after a match (state/momentRules.ts).
  createEffect(() => document.documentElement.setAttribute("data-moment", moment()));
  onCleanup(() => document.documentElement.removeAttribute("data-moment"));
  useEditorShortcuts();
  useWindowMode();

  // Match flow decides the scene; a pregame view appearing is a backup signal.
  const stopFlow = onAppEvent("match_flow", (effect) => {
    if (effect.kind === "enter_scene") navigate(`/${effect.scene === "career" ? "home" : effect.scene}`);
  });
  onCleanup(stopFlow);
  // A memo, so only entering or leaving agent select runs this: `on` alone would also run on
  // every agent-select update (each ally's pick) and pull the player back from any other tab.
  const isInPregameNow = createMemo(() => pregame() !== null);
  createEffect(
    on(
      isInPregameNow,
      (isInPregame, wasInPregame) => {
        if (isInPregame && scene() !== "agent-select") navigate("/agent-select");
        // Leaving agent select into the match is handled below; back to the menus is a dodge.
        if (!isInPregame && wasInPregame && scene() === "agent-select" && game()?.phase !== "ingame") navigate("/home");
      },
    ),
  );

  // Every style's Live tab is the way back while picking: before the match, that is agent select.
  createEffect(on(scene, (current) => current === "live" && isInPregameNow() && navigate("/agent-select"), { defer: true }));

  // When the match starts the menu hides; whoever brings it back mid-match lands on Live.
  createEffect(
    on(
      () => game()?.phase,
      (phase, previous) => {
        if (phase === "ingame" && previous !== "ingame" && !isEditing()) navigate("/live");
        // Backup for the match flow's own return: the match is over, so the live overlay
        // must not stay up in the menus with nothing to press.
        if (phase === "menus" && previous === "ingame" && scene() === "live" && !isEditing()) navigate("/home");
      },
    ),
  );

  // A new match summary opens itself once, when it arrives while the player is in the menus.
  let shownMatchId = "";
  createEffect(
    on(
      () => postMatch(),
      (view) => {
        if (!view || view.is_seen || view.match_id === shownMatchId) return;
        if (game()?.phase !== "menus" || pregame() !== null || isEditing()) return;
        shownMatchId = view.match_id;
        navigate("/post-match");
      },
    ),
  );

  const dropPoint = (event: DragEvent) => {
    const bounds = sceneArea?.getBoundingClientRect();
    if (!bounds) return { x: 0.5, y: 0.5 };
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };

  const onDrop = (event: DragEvent) => {
    if (!isEditing()) return;
    event.preventDefault();
    const at = dropPoint(event);
    const file = event.dataTransfer?.files[0];
    if (file && isLookFile(file)) {
      void applyLookFile(file);
      return;
    }
    if (file) {
      void addFromImageFile(scene(), file, at).then((isAdded) => {
        if (!isAdded) pushToast("info", "Not added", "Drop an image under 1.5 MB, or paste a link.");
      });
      return;
    }
    const url = event.dataTransfer?.getData("text/uri-list") || event.dataTransfer?.getData("text/plain") || "";
    if (!addFromUrl(scene(), url, at)) pushToast("info", "Not added", "Drop an image or a link.");
  };

  return (
    <div class={styles.shell} data-editing={isEditing() ? "" : undefined}>
      <SceneBackdrop scene={scene()} />
      <TopNav />
      <main
        ref={sceneArea}
        class={styles.scene}
        data-part="scene"
        onDragOver={(event) => isEditing() && event.preventDefault()}
        onDrop={onDrop}
      >
        {props.children}
      </main>
      <SceneWipe />
      <MatchFound />
      <Show when={isEditing()}>
        <Inspector />
        <StudioBar />
      </Show>
      {/* The VALORANT and League styles keep their friends in their own right-edge panels. */}
      <Show when={doc.theme.skin !== "current" && doc.theme.skin !== "league"}>
        <FriendsDrawer />
      </Show>
      <CosmeticPicker />
      <LoadoutPresets />
      <WishlistDialog />
      {/* One bottom-left stack for the scene's notices and docks, so they never overlap. */}
      <Show when={!isEditing()}>
        <div class={styles.corner}>
          <Show when={scene() !== "agent-select" && !isLookPreview}>
            <UpdateNotice />
          </Show>
          <Show when={scene() === "home" || scene() === "play"}>
            <ServiceNotice />
            <RestrictionNotice />
          </Show>
          <Show when={scene() === "store"}>
            <WishlistDock />
          </Show>
          {/* Any scene once opened (a friend's Message button works everywhere). */}
          <Show when={scene() === "home" || scene() === "play" || scene() === "agent-select" || isDockOpen()}>
            <ChatDock isTeamScene={scene() === "agent-select"} hasChatLine={hasChatLine()} />
          </Show>
        </div>
      </Show>
      <EscMenu />
      <CommandPalette />
      <ClickFx />
      {/* A gallery preview shows the look as it looks in use: no intro, tour or notices. */}
      <Show when={!isLookPreview} fallback={<PreviewBridge />}>
        <WelcomeTour />
        <Toasts />
        <Intro />
      </Show>
    </div>
  );
}
