// What the VALORANT-style settings screen lists, tab by tab, in the client's own order and
// wording. Game options are kept locally for the menu's look (ValoShell cannot change the
// game's settings); rows marked `app` are ValoShell's real settings.
import { createSignal } from "solid-js";

/** English and Spanish wording, as the style's language picks. */
export type Words = readonly [en: string, es: string];

/** ValoShell's own settings, shown among the client's. */
export type AppSettingKey = "uiVolume" | "motion" | "effects" | "streamer" | "updates" | "uiScale" | "contrast" | "colorVision";

export type Row =
  | { kind: "section"; label: Words }
  | { kind: "toggle"; key: string; label: Words }
  | { kind: "slider"; key: string; label: Words; min: number; max: number; step: number }
  | { kind: "select"; key: string; label: Words; options: readonly Words[] }
  | { kind: "bind"; key: string; label: Words }
  | { kind: "app"; key: AppSettingKey; label: Words };

export interface Tab {
  id: string;
  label: Words;
  rows: readonly Row[];
}

const ON_OFF = "toggle" as const;

const section = (en: string, es: string): Row => ({ kind: "section", label: [en, es] });
const toggle = (key: string, en: string, es: string): Row => ({ kind: ON_OFF, key, label: [en, es] });
const slider = (key: string, en: string, es: string, min: number, max: number, step: number): Row => ({ kind: "slider", key, label: [en, es], min, max, step });
const select = (key: string, en: string, es: string, options: readonly Words[]): Row => ({ kind: "select", key, label: [en, es], options });
const bind = (key: string, en: string, es: string): Row => ({ kind: "bind", key, label: [en, es] });

const QUALITY: readonly Words[] = [
  ["Low", "Baja"],
  ["Med", "Media"],
  ["High", "Alta"],
];

export const TABS: readonly Tab[] = [
  {
    id: "general",
    label: ["General", "General"],
    rows: [
      section("Accessibility", "Accesibilidad"),
      { kind: "app", key: "uiScale", label: ["Interface size (ValoShell)", "Tamaño de la interfaz (ValoShell)"] },
      { kind: "app", key: "contrast", label: ["High contrast (ValoShell)", "Alto contraste (ValoShell)"] },
      { kind: "app", key: "colorVision", label: ["Menu colours for colour blindness", "Colores del menú para daltonismo"] },
      select("enemyHighlight", "Enemy highlight color", "Color de resaltado de enemigos", [
        ["Red (default)", "Rojo (predeterminado)"],
        ["Yellow (deuteranopia)", "Amarillo (deuteranopía)"],
        ["Yellow (tritanopia)", "Amarillo (tritanopía)"],
        ["Purple", "Morado"],
      ]),
      toggle("subtitles", "Subtitles", "Subtítulos"),
      section("Mouse", "Ratón"),
      slider("sensitivity", "Sensitivity: aim", "Sensibilidad: apuntado", 0.01, 10, 0.001),
      slider("scoped", "Scoped sensitivity multiplier", "Multiplicador de sensibilidad con mira", 0.01, 10, 0.001),
      toggle("invertMouse", "Invert mouse", "Invertir ratón"),
      section("Other", "Otros"),
      toggle("blood", "Show blood", "Mostrar sangre"),
      toggle("corpses", "Show corpses", "Mostrar cadáveres"),
      toggle("bulletTracers", "Show bullet tracers", "Mostrar trazadoras de balas"),
      { kind: "app", key: "streamer", label: ["Streamer mode (hide names)", "Modo streamer (ocultar nombres)"] },
      { kind: "app", key: "updates", label: ["Check for ValoShell updates", "Buscar actualizaciones de ValoShell"] },
    ],
  },
  {
    id: "controls",
    label: ["Controls", "Controles"],
    rows: [
      section("Movement", "Movimiento"),
      bind("forward", "Move forward", "Avanzar"),
      bind("left", "Strafe left", "Moverse a la izquierda"),
      bind("back", "Move backward", "Retroceder"),
      bind("right", "Strafe right", "Moverse a la derecha"),
      bind("walk", "Walk", "Caminar"),
      bind("crouch", "Crouch", "Agacharse"),
      bind("jump", "Jump", "Saltar"),
      section("Equipment", "Equipo"),
      bind("primary", "Equip primary weapon", "Equipar arma principal"),
      bind("secondary", "Equip secondary weapon", "Equipar arma secundaria"),
      bind("melee", "Equip melee weapon", "Equipar arma cuerpo a cuerpo"),
      bind("spike", "Equip spike", "Equipar Spike"),
      bind("ability1", "Use/equip ability: 1", "Usar/equipar habilidad: 1"),
      bind("ability2", "Use/equip ability: 2", "Usar/equipar habilidad: 2"),
      bind("signature", "Use/equip ability: signature", "Usar/equipar habilidad: distintiva"),
      bind("ultimate", "Use/equip ability: ultimate", "Usar/equipar habilidad: definitiva"),
    ],
  },
  {
    id: "crosshair",
    label: ["Crosshair", "Mira"],
    rows: [
      section("Crosshair", "Mira"),
      select("xColor", "Crosshair color", "Color de la mira", [
        ["White", "Blanco"],
        ["Green", "Verde"],
        ["Yellow green", "Verde amarillento"],
        ["Green yellow", "Amarillo verdoso"],
        ["Yellow", "Amarillo"],
        ["Cyan", "Cian"],
        ["Pink", "Rosa"],
        ["Red", "Rojo"],
      ]),
      toggle("xOutlines", "Outlines", "Contornos"),
      slider("xOutlineOpacity", "Outline opacity", "Opacidad del contorno", 0, 1, 0.01),
      slider("xOutlineThickness", "Outline thickness", "Grosor del contorno", 1, 6, 1),
      toggle("xDot", "Center dot", "Punto central"),
      slider("xDotOpacity", "Center dot opacity", "Opacidad del punto central", 0, 1, 0.01),
      slider("xDotThickness", "Center dot thickness", "Grosor del punto central", 1, 6, 1),
      section("Inner lines", "Líneas interiores"),
      toggle("xInner", "Show inner lines", "Mostrar líneas interiores"),
      slider("xInnerOpacity", "Inner line opacity", "Opacidad de las líneas interiores", 0, 1, 0.01),
      slider("xInnerLength", "Inner line length", "Longitud de las líneas interiores", 0, 20, 1),
      slider("xInnerThickness", "Inner line thickness", "Grosor de las líneas interiores", 0, 10, 1),
      slider("xInnerOffset", "Inner line offset", "Desplazamiento de las líneas interiores", 0, 20, 1),
      section("Outer lines", "Líneas exteriores"),
      toggle("xOuter", "Show outer lines", "Mostrar líneas exteriores"),
      slider("xOuterLength", "Outer line length", "Longitud de las líneas exteriores", 0, 10, 1),
      slider("xOuterOffset", "Outer line offset", "Desplazamiento de las líneas exteriores", 0, 40, 1),
    ],
  },
  {
    id: "map",
    label: ["Map", "Mapa"],
    rows: [
      section("Minimap", "Minimapa"),
      select("rotate", "Rotate", "Rotar", [
        ["Rotate", "Rotar"],
        ["Fixed", "Fijo"],
      ]),
      select("orientation", "Fixed orientation", "Orientación fija", [
        ["Based on side", "Según el bando"],
        ["Always the same", "Siempre la misma"],
      ]),
      toggle("centered", "Keep player centered", "Mantener al jugador centrado"),
      slider("minimapSize", "Minimap size", "Tamaño del minimapa", 0.9, 1.2, 0.01),
      slider("minimapZoom", "Minimap zoom", "Zoom del minimapa", 0.6, 1.4, 0.01),
      toggle("visionCones", "Minimap vision cones", "Conos de visión en el minimapa"),
      select("regionNames", "Show map region names", "Mostrar nombres de zonas del mapa", [
        ["Always", "Siempre"],
        ["Never", "Nunca"],
      ]),
    ],
  },
  {
    id: "video",
    label: ["Video", "Vídeo"],
    rows: [
      section("General", "General"),
      select("displayMode", "Display mode", "Modo de pantalla", [
        ["Fullscreen", "Pantalla completa"],
        ["Windowed fullscreen", "Ventana a pantalla completa"],
        ["Windowed", "En ventana"],
      ]),
      select("resolution", "Resolution", "Resolución", [
        ["1920x1080 16:9 (144Hz)", "1920x1080 16:9 (144 Hz)"],
        ["2560x1440 16:9 (165Hz)", "2560x1440 16:9 (165 Hz)"],
        ["1280x960 4:3 (144Hz)", "1280x960 4:3 (144 Hz)"],
      ]),
      toggle("limitFps", "Limit FPS always", "Limitar FPS siempre"),
      slider("maxFps", "Max FPS always", "FPS máximos siempre", 30, 300, 1),
      section("Graphics quality", "Calidad de los gráficos"),
      select("material", "Material quality", "Calidad de los materiales", QUALITY),
      select("texture", "Texture quality", "Calidad de las texturas", QUALITY),
      select("detail", "Detail quality", "Calidad de los detalles", QUALITY),
      select("ui", "UI quality", "Calidad de la interfaz", QUALITY),
      toggle("vignette", "Vignette", "Viñeta"),
      toggle("vsync", "VSync", "Sincronización vertical"),
      select("antiAliasing", "Anti-aliasing", "Suavizado de bordes", [
        ["None", "Ninguno"],
        ["MSAA 2x", "MSAA 2x"],
        ["MSAA 4x", "MSAA 4x"],
        ["FXAA", "FXAA"],
      ]),
      toggle("bloom", "Bloom", "Resplandor"),
      { kind: "app", key: "motion", label: ["Menu motion", "Animaciones del menú"] },
      { kind: "app", key: "effects", label: ["Menu effects", "Efectos del menú"] },
    ],
  },
  {
    id: "audio",
    label: ["Audio", "Audio"],
    rows: [
      section("Sounds", "Sonidos"),
      slider("overall", "Overall volume", "Volumen general", 0, 100, 1),
      slider("effects", "Sound effects volume", "Volumen de los efectos de sonido", 0, 100, 1),
      slider("voiceOver", "Voice-over volume", "Volumen de las voces", 0, 100, 1),
      { kind: "app", key: "uiVolume", label: ["Menu sound effects", "Efectos de sonido del menú"] },
      section("Music", "Música"),
      slider("menuMusic", "Main menu music volume", "Volumen de la música del menú principal", 0, 100, 1),
      slider("selectMusic", "Agent select music volume", "Volumen de la música de selección de agente", 0, 100, 1),
      toggle("instaMusic", "Music while in the menus only", "Música solo en los menús"),
    ],
  },
];

const DEFAULTS: Record<string, string | number | boolean> = {
  enemyHighlight: 0,
  subtitles: false,
  sensitivity: 0.4,
  scoped: 1,
  invertMouse: false,
  blood: true,
  corpses: true,
  bulletTracers: true,
  forward: "W",
  left: "A",
  back: "S",
  right: "D",
  walk: "L-Shift",
  crouch: "L-Ctrl",
  jump: "Space",
  primary: "1",
  secondary: "2",
  melee: "3",
  spike: "4",
  ability1: "C",
  ability2: "Q",
  signature: "E",
  ultimate: "X",
  xColor: 5,
  xOutlines: true,
  xOutlineOpacity: 0.5,
  xOutlineThickness: 1,
  xDot: false,
  xDotOpacity: 1,
  xDotThickness: 2,
  xInner: true,
  xInnerOpacity: 0.8,
  xInnerLength: 6,
  xInnerThickness: 2,
  xInnerOffset: 3,
  xOuter: false,
  xOuterLength: 2,
  xOuterOffset: 10,
  rotate: 1,
  orientation: 0,
  centered: false,
  minimapSize: 1,
  minimapZoom: 0.9,
  visionCones: true,
  regionNames: 0,
  displayMode: 0,
  resolution: 0,
  limitFps: false,
  maxFps: 144,
  material: 0,
  texture: 0,
  detail: 0,
  ui: 0,
  vignette: false,
  vsync: false,
  antiAliasing: 2,
  bloom: false,
  overall: 70,
  effects: 100,
  voiceOver: 100,
  menuMusic: 30,
  selectMusic: 30,
  instaMusic: false,
};

const STORAGE_KEY = "valoshell.valSettings";

function loadValues(): Record<string, string | number | boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string | number | boolean>;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

const [values, setValues] = createSignal(loadValues());

export { values };

export function setValue(key: string, value: string | number | boolean): void {
  const next = { ...values(), [key]: value };
  setValues(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private windows refuse storage; the change still holds until the app closes.
  }
}

export function resetValues(keys: readonly string[]): void {
  const next = { ...values() };
  for (const key of keys) {
    const fallback = DEFAULTS[key];
    if (fallback !== undefined) next[key] = fallback;
  }
  setValues(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // As above.
  }
}

/** The crosshair colours the select offers, in its order. */
export const CROSSHAIR_COLORS = ["#ffffff", "#00ff00", "#7fff00", "#dfff00", "#ffff00", "#00ffff", "#ff00ff", "#ff0000"];
