// The Theme tab's Backdrop section: what fills the background (the game's video, a map, an
// agent, a shader, glow, an image or video link, or a flat colour), that source's own picker,
// the ASCII redraw, and how the picture sits behind the menu (dim, blur, vignette, parallax,
// grain).
import { For, Show } from "solid-js";
import { SHADER_OPTIONS } from "~/menu/backdrop/shaders";
import { playCue } from "~/menu/sound";
import { catalog } from "~/state/catalog";
import { areGameVideosSearched, gameVideos, pickGameVideo } from "~/state/gameVideos";
import { Art } from "~/ui/Art";
import { Range, Segmented, Switch, TextField } from "~/ui/controls";
import { doc, updateTheme } from "../store";
import type { BackdropKind, ShaderId } from "../types";
import styles from "../studio.module.css";
import { FigureLookControls, SubjectControls } from "./BackdropSubject";
import { FigureControls } from "./ThemeExtras";

const BACKDROP_KINDS: readonly { value: BackdropKind; label: string }[] = [
  { value: "game", label: "Game" },
  { value: "map", label: "Map" },
  { value: "agent", label: "Agent" },
  { value: "shader", label: "Shader" },
  { value: "aurora", label: "Glow" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "color", label: "Flat" },
];

const backdrop = () => doc.theme.backdrop;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const pixels = (value: number) => `${value}px`;

function KindPicker() {
  return (
    <div class={styles.kindGrid} role="radiogroup">
      <For each={BACKDROP_KINDS}>
        {(option) => (
          <button
            role="radio"
            aria-checked={backdrop().kind === option.value}
            class={styles.kind}
            data-active={backdrop().kind === option.value ? "" : undefined}
            onClick={() => {
              playCue("tab");
              updateTheme((draft) => void (draft.backdrop.kind = option.value));
            }}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}

/** The game's own home-screen videos, found in the VALORANT install. */
function GameVideoStrip() {
  const missing = () => (areGameVideosSearched() ? "VALORANT install not found, so the glow is shown instead." : "Looking for the game's videos…");
  return (
    <Show when={gameVideos().length > 0} fallback={<p class={styles.muted}>{missing()}</p>}>
      <div class={styles.mapStrip}>
        <For each={gameVideos()}>
          {(video) => (
            <button
              class={styles.mapChip}
              title={video.path}
              data-active={pickGameVideo(backdrop().gameVideo)?.path === video.path ? "" : undefined}
              onClick={() => updateTheme((draft) => void (draft.backdrop.gameVideo = video.path))}
            >
              {video.label}
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}

function MapStrip() {
  return (
    <div class={styles.mapStrip}>
      <For each={catalog().maps.filter((map) => !map.is_team_deathmatch)}>
        {(map) => (
          <button
            class={styles.mapChip}
            data-active={backdrop().mapId === map.internal_id ? "" : undefined}
            onClick={() => updateTheme((draft) => void (draft.backdrop.mapId = map.internal_id))}
          >
            {map.display_name}
          </button>
        )}
      </For>
    </div>
  );
}

function AgentStrip() {
  return (
    <div class={styles.agentStrip}>
      <For each={catalog().agents}>
        {(agent) => (
          <button
            class={styles.agentChip}
            data-active={backdrop().agentUuid === agent.uuid ? "" : undefined}
            title={agent.display_name}
            onClick={() => updateTheme((draft) => void (draft.backdrop.agentUuid = agent.uuid))}
          >
            <Art src={agent.icon} fallback={agent.display_name.slice(0, 2)} />
          </button>
        )}
      </For>
    </div>
  );
}

/** Each source's own picker, under the kind buttons. */
function SourcePicker() {
  const isLink = () => backdrop().kind === "image" || backdrop().kind === "video";
  return (
    <>
      <Show when={backdrop().kind === "game"}>
        <GameVideoStrip />
      </Show>
      <Show when={backdrop().kind === "map"}>
        <SubjectControls what="map" />
        <MapStrip />
      </Show>
      <Show when={backdrop().kind === "shader"}>
        <Segmented<ShaderId> value={backdrop().shader} options={SHADER_OPTIONS} onChange={(value) => updateTheme((draft) => void (draft.backdrop.shader = value))} />
      </Show>
      <Show when={isLink()}>
        <TextField
          label={backdrop().kind === "video" ? "Video link (.mp4 / .webm)" : "Image link"}
          value={backdrop().url}
          placeholder="https://…"
          onInput={(value) => updateTheme((draft) => void (draft.backdrop.url = value.trim()), "theme.backdrop.url")}
        />
      </Show>
      <Show when={backdrop().kind === "agent"}>
        <SubjectControls what="agent" />
        <AgentStrip />
        <FigureControls />
        <FigureLookControls />
      </Show>
    </>
  );
}

/** Glow and flat colour are drawn, not pictures, so there is nothing to redraw as characters. */
function AsciiControls() {
  return (
    <Show when={backdrop().kind !== "aurora" && backdrop().kind !== "color"}>
      <Switch
        title="ASCII"
        hint="Redraw the background as characters"
        isOn={backdrop().isAscii}
        onChange={(value) => updateTheme((draft) => void (draft.backdrop.isAscii = value))}
      />
      <Show when={backdrop().isAscii}>
        <Range
          label="Character size"
          value={backdrop().asciiSize}
          min={6}
          max={24}
          step={1}
          format={pixels}
          onInput={(value) => updateTheme((draft) => void (draft.backdrop.asciiSize = value), "theme.asciiSize")}
        />
      </Show>
    </Show>
  );
}

/** How the picture sits behind the menu. */
function SurfaceControls() {
  const theme = () => doc.theme;
  return (
    <>
      <Range label="Dim" value={backdrop().dim} min={0} max={0.9} step={0.01} format={percent} onInput={(value) => updateTheme((draft) => void (draft.backdrop.dim = value), "theme.dim")} />
      <Range label="Blur" value={backdrop().blur} min={0} max={24} step={1} format={pixels} onInput={(value) => updateTheme((draft) => void (draft.backdrop.blur = value), "theme.blur")} />
      <Range label="Vignette" value={theme().vignette} min={0} max={1} step={0.01} format={percent} onInput={(value) => updateTheme((draft) => void (draft.vignette = value), "theme.vignette")} />
      <Range
        label="Parallax"
        value={theme().parallax}
        min={0}
        max={40}
        step={1}
        format={(value) => (value === 0 ? "Off" : pixels(value))}
        onInput={(value) => updateTheme((draft) => void (draft.parallax = value), "theme.parallax")}
      />
      <Switch title="Film grain" isOn={theme().isGrainy} onChange={(value) => updateTheme((draft) => void (draft.isGrainy = value))} />
    </>
  );
}

export function BackdropSection() {
  return (
    <section class={styles.section}>
      <span class="overline">Backdrop</span>
      <KindPicker />
      <SourcePicker />
      <AsciiControls />
      <SurfaceControls />
    </section>
  );
}
