// Full-bleed scene background driven by the Studio theme: the game's own home-screen video,
// aurora glow, a map's loading screen, an agent, an image, a looping video or a live shader, optionally redrawn as ASCII,
// with pointer parallax, dim, blur, grain and vignette. Agent select always shows the map
// being played; the in-game stage shows a stand-in game view to design against. Map and agent
// backdrops show the picked one, your last match's, or a new one each launch (backdrop/subject).
import { Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { agentColours, catalog } from "~/state/catalog";
import { gameVideoUrl, pickGameVideo } from "~/state/gameVideos";
import { party } from "~/state/party";
import { pregame } from "~/state/pregame";
import { isResting } from "~/state/performance";
import { game } from "~/state/session";
import { historyView } from "~/state/views";
import { pushToast } from "~/state/toasts";
import { doc } from "~/studio/store";
import { AsciiLayer, type AsciiPlacement, type AsciiSource } from "./backdrop/AsciiLayer";
import { ShaderCanvas } from "./backdrop/ShaderCanvas";
import { type SubjectChoice, backdropAgent, backdropMap, lastMatch } from "./backdrop/subject";
import type { SceneId } from "./scenes";
import styles from "./SceneBackdrop.module.css";

/** An image element whose pixels may be read (CORS), re-created when the url changes. */
function useReadableImage(url: () => string | null): () => HTMLImageElement | null {
  const [image, setImage] = createSignal<HTMLImageElement | null>(null);
  createEffect(
    on(url, (current) => {
      setImage(null);
      if (!current) return;
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => url() === current && setImage(element);
      element.src = current;
    }),
  );
  return image;
}

/** Where the figure stands across the screen: right of centre, or as far left when mirrored. */
const FIGURE_CENTRE = 0.68;

/** The map and agent a map/agent backdrop shows; reads the match history only when following it. */
function useBackdropSubject() {
  const backdrop = () => doc.theme.backdrop;
  const isFollowingHistory = () => backdrop().pick === "recent" && (backdrop().kind === "map" || backdrop().kind === "agent");
  // Once: a failed load leaves the picked one showing instead of retrying in a loop (the
  // history reloads by itself when the player is back from a match).
  createEffect(() => {
    const isUnread = !historyView.value() && !historyView.isLoading() && !historyView.error();
    if (isFollowingHistory() && isUnread) void historyView.load();
  });
  const choice = (id: string): SubjectChoice => ({
    pick: backdrop().pick,
    id,
    last: isFollowingHistory() ? lastMatch(historyView.value()?.rows ?? []) : undefined,
  });
  const map = createMemo(() => backdropMap(choice(backdrop().mapId), catalog().maps));
  const agent = createMemo(() => backdropAgent(choice(backdrop().agentUuid), catalog().agents));
  return { map, agent };
}

/** The agent's colours as CSS variables for the figure looks that use them (accent without). */
function figureColours(agentColors: string[]): Record<string, string> {
  const [light, , deep] = agentColors;
  return { "--agent-light": light ?? "var(--accent)", "--agent-deep": deep ?? agentColors[1] ?? "var(--accent-2, var(--accent))" };
}

export function SceneBackdrop(props: { scene: SceneId }) {
  let root: HTMLDivElement | undefined;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const [video, setVideo] = createSignal<HTMLVideoElement | null>(null);
  const [shaderCanvas, setShaderCanvas] = createSignal<HTMLCanvasElement | null>(null);
  const [isAsciiBlocked, setAsciiBlocked] = createSignal(false);

  const theme = () => doc.theme;
  const backdrop = () => doc.theme.backdrop;
  const isMotionAllowed = () =>
    document.documentElement.dataset["motion"] !== "reduced" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // In a match or while nobody looks (state/performance.ts) the backdrop stops drawing.
  const isPaused = () => game()?.phase === "ingame" || isResting();

  const applyParallax = () => {
    frame = 0;
    const travel = theme().parallax;
    root?.style.setProperty("--parallax-x", `${(pointerX * travel).toFixed(2)}px`);
    root?.style.setProperty("--parallax-y", `${(pointerY * travel).toFixed(2)}px`);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isMotionAllowed() || !document.hasFocus() || theme().parallax === 0) return;
    pointerX = event.clientX / window.innerWidth - 0.5;
    pointerY = event.clientY / window.innerHeight - 0.5;
    frame ||= requestAnimationFrame(applyParallax);
  };

  onMount(() => window.addEventListener("pointermove", onPointerMove, { passive: true }));
  onCleanup(() => {
    window.removeEventListener("pointermove", onPointerMove);
    cancelAnimationFrame(frame);
  });

  /** Pan, zoom and tilt the whole picture, never so far that the ground shows at an edge. */
  const framing = () => {
    const { offsetX, offsetY, zoom, rotate, hue, saturation } = backdrop();
    const cover = 1 + (2 * Math.max(Math.abs(offsetX), Math.abs(offsetY))) / 100 + Math.abs(rotate) / 40;
    const scale = Math.max(zoom, cover);
    return {
      transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale.toFixed(3)}) rotate(${rotate}deg)`,
      filter: hue === 0 && saturation === 1 ? "none" : `hue-rotate(${hue}deg) saturate(${saturation})`,
    };
  };

  /** The VALORANT style's custom lobby sits on its chosen map, as the client does. */
  const customMap = () => (props.scene === "home" && doc.theme.skin === "current" ? party()?.custom?.map_splash ?? null : null);
  /** What fills the background: agent select always shows the map being played. */
  const kind = () => (props.scene === "agent-select" || customMap() ? "map-live" : backdrop().kind);
  const subject = useBackdropSubject();
  const mapSplash = () => subject.map()?.splash ?? null;
  const agent = subject.agent;
  /** The giant name behind everything, for map and agent backdrops that ask for it. */
  const nameMark = () => {
    if (!backdrop().isNameOn) return null;
    if (kind() === "map") return subject.map()?.display_name ?? null;
    return kind() === "agent" ? agent()?.display_name ?? null : null;
  };

  /** The still image of the current source, if it is one. */
  const art = createMemo<string | null>(() => {
    switch (kind()) {
      case "map-live":
        return customMap() ?? pregame()?.map_splash ?? null;
      case "map":
        return mapSplash();
      case "image":
        return backdrop().url || null;
      case "agent":
        return agent()?.background ?? null;
      default:
        return null;
    }
  });
  const portrait = () => (kind() === "agent" ? agent()?.portrait ?? null : null);
  /** The figure's box: right of centre, feet below the edge, moved and sized from its feet. */
  const figureBox = createMemo<AsciiPlacement>(() => {
    const { figureX, figureY, figureScale } = backdrop();
    const width = 0.76 * figureScale;
    const height = 1.08 * figureScale;
    const side = backdrop().isFigureMirrored ? 1 - FIGURE_CENTRE : FIGURE_CENTRE;
    const centre = side + figureX / 100;
    const feet = 1.1 + figureY / 100;
    return { left: centre - width / 2, top: feet - height, width, height };
  });
  const figureStyle = () => {
    const box = figureBox();
    const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
    const shown = agent();
    const colours = figureColours(shown ? agentColours(shown) : []);
    const place = { left: percent(box.left), top: percent(box.top), width: percent(box.width), height: percent(box.height) };
    return { "--portrait": `url("${portrait() ?? ""}")`, ...colours, ...place };
  };
  const gameVideo = () => (kind() === "game" ? pickGameVideo(backdrop().gameVideo) : undefined);
  const videoUrl = createMemo<string | null>(() => {
    if (kind() === "video") return backdrop().url || null;
    const found = gameVideo();
    return found ? gameVideoUrl(found) : null;
  });
  /** The glow also stands in for the game's video when no install is found. */
  const isGlow = () => kind() === "aurora" || (kind() === "game" && !gameVideo());

  // A playing menu video costs GPU time the match needs. This effect alone starts playback (no
  // autoplay), and it re-runs on a new source, which would otherwise restart a paused video.
  createEffect(() => {
    const element = video();
    videoUrl();
    if (!element) return;
    if (isPaused()) element.pause();
    else void element.play().catch(() => undefined);
  });

  const isAscii = () => backdrop().isAscii && !isAsciiBlocked() && props.scene !== "ingame";
  // Agents read best as ASCII from the figure; everything else from the picture itself.
  const asciiImage = useReadableImage(() => (isAscii() ? portrait() ?? art() : null));
  const asciiSource = (): AsciiSource | null => {
    if (videoUrl()) return video();
    if (kind() === "shader") return shaderCanvas();
    return asciiImage();
  };

  createEffect(on(() => [backdrop().kind, backdrop().url, backdrop().agentUuid, backdrop().mapId, backdrop().gameVideo, backdrop().isAscii], () => setAsciiBlocked(false)));

  const reportUnreadable = () => {
    if (isAsciiBlocked()) return;
    setAsciiBlocked(true);
    pushToast("info", "ASCII unavailable for this picture", "Its site does not allow reading pixels, so it is shown normally.");
  };

  return (
    <div
      ref={root}
      class={styles.backdrop}
      data-part="backdrop"
      aria-hidden="true"
      data-kind={kind()}
      data-ascii={isAscii() ? "" : undefined}
      style={{ "--dim": backdrop().dim, "--blur": `${backdrop().blur}px` }}
    >
      <Switch>
        <Match when={props.scene === "ingame"}>
          <div class={styles.gameStandIn}>
            <span class={styles.crosshair} />
            <span class={styles.gameNote}>In-game overlay · pieces here float over VALORANT</span>
          </div>
        </Match>
        <Match when={true}>
          <div class={styles.frame} style={framing()}>
            <div
              class={styles.motion}
              data-motion={isMotionAllowed() ? backdrop().motion : "none"}
              data-paused={isPaused() ? "" : undefined}
              style={{ "--motion-speed": backdrop().motionSpeed }}
            >
              <Show when={isGlow()}>
                <div class={styles.glow} />
              </Show>
              <Show when={kind() === "shader"}>
                <ShaderCanvas
                  class={styles.shader}
                  shader={backdrop().shader}
                  colors={{ accent: theme().accent, accent2: theme().accent2, ground: theme().ground }}
                  isPaused={isPaused}
                  onCanvas={setShaderCanvas}
                />
              </Show>
              <Show when={art()}>{(url) => <div class={styles.art} style={{ "--scene-art": `url("${url()}")` }} />}</Show>
              <Show when={videoUrl()}>
                {(url) => {
                  onCleanup(() => setVideo(null));
                  return (
                    <video
                      ref={(element) => setVideo(element)}
                      class={styles.video}
                      src={url()}
                      crossOrigin={isAscii() ? "anonymous" : undefined}
                      muted
                      loop
                      playsinline
                    />
                  );
                }}
              </Show>
              <Show when={nameMark()}>
                {(name) => (
                  <div class={styles.nameMark} data-part="backdrop-name">
                    <span data-text={name()}>{name()}</span>
                  </div>
                )}
              </Show>
              <Show when={portrait()}>
                <div
                  class={styles.portrait}
                  style={figureStyle()}
                  data-look={backdrop().figureLook}
                  data-mirrored={backdrop().isFigureMirrored ? "" : undefined}
                />
              </Show>
              <Show when={isAscii()}>
                <AsciiLayer
                  class={styles.ascii}
                  source={asciiSource}
                  isAnimated={videoUrl() !== null || kind() === "shader"}
                  cellPx={backdrop().asciiSize}
                  color={theme().accent}
                  isPaused={isPaused}
                  onUnreadable={reportUnreadable}
                  placement={() => (portrait() ? figureBox() : null)}
                />
              </Show>
            </div>
          </div>
          <div class={styles.dim} data-map={kind() === "map-live" && art() ? "" : undefined} data-lobby={customMap() ? "" : undefined} />
          <div class={styles.grain} />
          <div class={styles.vignette} />
        </Match>
      </Switch>
    </div>
  );
}
