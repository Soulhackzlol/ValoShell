// UI sounds per menu style. Each style has a synthesised pack (WebAudio voices: no assets,
// nothing to license) shaped after its game's menu; real files win where the player has them
// (Minecraft's and CS 1.6's own sounds from their installs, or files in the sounds folder).
import { isLookPreview } from "~/ipc/runtime";
import type { SoundPack, Skin } from "~/studio/types";

export type SoundCue = "hover" | "confirm" | "back" | "tab" | "found";

/** One layer of a cue: an oscillator sweep or a filtered noise burst. */
interface Voice {
  wave: OscillatorType | "noise";
  /** Start and end pitch in Hz (for noise: the filter's centre). */
  from: number;
  to: number;
  durationS: number;
  gain: number;
  delayS?: number;
  attackS?: number;
  filter?: BiquadFilterType;
  q?: number;
}

type Pack = Record<SoundCue, Voice[]>;

const tone = (wave: OscillatorType, from: number, to: number, durationS: number, gain: number, delayS = 0, attackS?: number): Voice => ({
  wave,
  from,
  to,
  durationS,
  gain,
  delayS,
  ...(attackS === undefined ? {} : { attackS }),
});
const noise = (filter: BiquadFilterType, hz: number, durationS: number, gain: number, delayS = 0, q = 1): Voice => ({
  wave: "noise",
  from: hz,
  to: hz,
  durationS,
  gain,
  delayS,
  filter,
  q,
});
/** Notes in a row, each `stepS` after the last. */
const arpeggio = (wave: OscillatorType, notes: number[], stepS: number, durationS: number, gain: number): Voice[] =>
  notes.map((hz, index) => tone(wave, hz, hz, durationS, gain, index * stepS));

// VALORANT: crisp digital ticks with a soft air layer; match found is a rising bright chime.
const VALORANT: Pack = {
  hover: [tone("sine", 2400, 2100, 0.035, 0.035), noise("highpass", 6000, 0.014, 0.012)],
  tab: [tone("triangle", 900, 1300, 0.07, 0.055), tone("sine", 1800, 1800, 0.04, 0.02, 0.02)],
  confirm: [tone("triangle", 520, 1040, 0.12, 0.085), tone("sine", 1560, 2080, 0.09, 0.03, 0.04), noise("bandpass", 3200, 0.06, 0.02)],
  back: [tone("triangle", 700, 420, 0.09, 0.06)],
  found: [...arpeggio("sine", [660, 880, 1320, 1760], 0.09, 0.42, 0.06), noise("highpass", 5000, 0.5, 0.012, 0, 0.7)],
};

// The 2020 beta: the same family, drier and lower, more "terminal" than "glass".
const BETA: Pack = {
  hover: [tone("sine", 1800, 1700, 0.03, 0.03)],
  tab: [tone("square", 700, 700, 0.03, 0.018), tone("sine", 1400, 1400, 0.05, 0.03, 0.015)],
  confirm: [tone("sine", 440, 880, 0.1, 0.08), tone("square", 1320, 1320, 0.03, 0.012, 0.05)],
  back: [tone("sine", 600, 380, 0.08, 0.06)],
  found: arpeggio("triangle", [523, 784, 1046], 0.12, 0.4, 0.07),
};

// CS:GO Panorama: soft woody tocks under a low thump; the accept tone is two clean beeps.
const CSGO: Pack = {
  hover: [noise("bandpass", 2600, 0.018, 0.03, 0, 4), tone("sine", 1400, 1400, 0.02, 0.012)],
  tab: [noise("bandpass", 1900, 0.028, 0.06, 0, 3), tone("sine", 240, 190, 0.05, 0.04)],
  confirm: [noise("bandpass", 1600, 0.035, 0.07, 0, 3), tone("sine", 220, 170, 0.07, 0.06), tone("triangle", 880, 880, 0.06, 0.025, 0.03)],
  back: [noise("bandpass", 1200, 0.03, 0.05, 0, 3), tone("sine", 180, 140, 0.06, 0.04)],
  found: [tone("triangle", 988, 988, 0.14, 0.07), tone("triangle", 1318, 1318, 0.2, 0.07, 0.16), tone("triangle", 988, 988, 0.14, 0.05, 0.5), tone("triangle", 1318, 1318, 0.24, 0.05, 0.66)],
};

// CS2: cleaner and glassier than Panorama, with a short airy sweep on press.
const CS2: Pack = {
  hover: [tone("sine", 1900, 2200, 0.025, 0.022)],
  tab: [tone("sine", 1200, 1500, 0.045, 0.045), noise("highpass", 7000, 0.02, 0.01)],
  confirm: [tone("sine", 700, 1400, 0.09, 0.07), noise("bandpass", 4000, 0.08, 0.018, 0.01, 2)],
  back: [tone("sine", 1100, 600, 0.08, 0.05)],
  found: [...arpeggio("sine", [784, 988, 1175], 0.07, 0.6, 0.05), tone("triangle", 392, 392, 0.7, 0.04, 0, 0.05)],
};

// CS 1.6 VGUI: harsh little square blips; match found is a radio squelch and a beep.
const CS16: Pack = {
  hover: [tone("square", 1100, 1100, 0.015, 0.014)],
  tab: [tone("square", 650, 650, 0.025, 0.03)],
  confirm: [tone("square", 520, 520, 0.03, 0.04), tone("square", 780, 780, 0.025, 0.03, 0.03)],
  back: [tone("square", 420, 300, 0.05, 0.035)],
  found: [noise("bandpass", 1500, 0.14, 0.08, 0, 1.2), tone("square", 880, 880, 0.12, 0.03, 0.18), noise("bandpass", 1500, 0.08, 0.06, 0.34, 1.2)],
};

// Terminal: keyboard ticks and plain sine beeps.
const TERMINAL: Pack = {
  hover: [noise("highpass", 3000, 0.008, 0.03)],
  tab: [noise("highpass", 2500, 0.012, 0.04), tone("sine", 1320, 1320, 0.03, 0.02)],
  confirm: [noise("highpass", 2500, 0.012, 0.04), tone("sine", 880, 880, 0.07, 0.05, 0.01)],
  back: [tone("sine", 440, 440, 0.09, 0.05)],
  found: [tone("sine", 880, 880, 0.08, 0.06), tone("sine", 880, 880, 0.08, 0.06, 0.14), tone("sine", 1320, 1320, 0.16, 0.06, 0.28)],
};

// Pip-Boy: the wrist unit's dry relay clicks and square-wave beeps through a small speaker.
const PIPBOY: Pack = {
  hover: [noise("bandpass", 1800, 0.012, 0.035, 0, 4)],
  tab: [noise("bandpass", 1400, 0.02, 0.05, 0, 3), tone("square", 180, 140, 0.05, 0.018, 0.005)],
  confirm: [tone("square", 1000, 1000, 0.05, 0.022), tone("square", 1500, 1500, 0.07, 0.022, 0.06)],
  back: [tone("square", 700, 420, 0.08, 0.02)],
  found: [...arpeggio("square", [523, 659, 784, 1046], 0.09, 0.12, 0.022), noise("bandpass", 1200, 0.5, 0.012, 0.36, 0.8)],
};

// Fortnite: bubbly pops and bright major arpeggios with a sparkle on top.
const FORTNITE: Pack = {
  hover: [tone("sine", 600, 1200, 0.04, 0.035)],
  tab: [tone("sine", 700, 1100, 0.05, 0.05), tone("sine", 1400, 2200, 0.04, 0.02, 0.02)],
  confirm: [...arpeggio("triangle", [523, 659, 784], 0.035, 0.12, 0.05), noise("highpass", 8000, 0.08, 0.015, 0.06)],
  back: [tone("sine", 900, 300, 0.08, 0.05)],
  found: [...arpeggio("triangle", [523, 659, 784, 1046, 1318], 0.07, 0.3, 0.06), noise("highpass", 7000, 0.4, 0.02, 0.2)],
};

// Minecraft: the dry "tk" of a stone button and no hover sound; level-up dings for a match.
const MINECRAFT: Pack = {
  hover: [],
  tab: [noise("bandpass", 2500, 0.018, 0.09, 0, 2), tone("square", 180, 180, 0.01, 0.03)],
  confirm: [noise("bandpass", 2500, 0.018, 0.09, 0, 2), tone("square", 180, 180, 0.01, 0.03)],
  back: [noise("bandpass", 2200, 0.018, 0.08, 0, 2), tone("square", 160, 160, 0.01, 0.03)],
  found: arpeggio("triangle", [392, 523, 659, 784, 1046], 0.06, 0.28, 0.06),
};

// Halo 3: glassy bells with slow decays and a choir-like swell for the match.
const HALO: Pack = {
  hover: [tone("sine", 2637, 2637, 0.06, 0.018, 0, 0.01)],
  tab: [tone("sine", 1760, 1760, 0.12, 0.035, 0, 0.005), tone("sine", 2637, 2637, 0.1, 0.012, 0.01)],
  confirm: [tone("sine", 1318, 1318, 0.28, 0.05, 0, 0.005), tone("sine", 1975, 1975, 0.24, 0.03, 0.02)],
  back: [tone("sine", 987, 740, 0.18, 0.045)],
  found: [440, 554, 659, 880].map((hz, index) => tone("sine", hz, hz * 1.003, 1.3, 0.035, index * 0.05, 0.25)),
};

// League client: soft hextech chimes, a glassy two-note confirm and a rising arpeggio for a match.
const LEAGUE: Pack = {
  hover: [tone("sine", 1568, 1568, 0.05, 0.014, 0, 0.004)],
  tab: [tone("triangle", 880, 880, 0.08, 0.03), tone("sine", 1760, 1760, 0.07, 0.012, 0.01)],
  confirm: [tone("sine", 1046, 1046, 0.16, 0.04), tone("sine", 1568, 1568, 0.2, 0.03, 0.06)],
  back: [tone("triangle", 784, 523, 0.12, 0.035)],
  found: [...arpeggio("sine", [523, 659, 784, 1046, 1318], 0.08, 0.5, 0.04), noise("highpass", 6000, 0.3, 0.01, 0.3)],
};

// Phantom: jazzy, punchy UI: a snappy slap on tabs, a bright two-note stab to confirm and a
// brassy rising hit for a match.
const PHANTOM: Pack = {
  hover: [noise("highpass", 5200, 0.018, 0.02)],
  tab: [noise("bandpass", 1600, 0.035, 0.07, 0, 1.5), tone("triangle", 660, 990, 0.06, 0.035)],
  confirm: [tone("sawtooth", 523, 523, 0.08, 0.03), tone("sawtooth", 784, 784, 0.12, 0.03, 0.07), noise("bandpass", 2400, 0.04, 0.05)],
  back: [tone("triangle", 784, 392, 0.1, 0.04), noise("bandpass", 1200, 0.03, 0.04)],
  found: [...arpeggio("sawtooth", [392, 494, 587, 784], 0.07, 0.3, 0.03), noise("bandpass", 2000, 0.25, 0.04, 0.28)],
};

// Night City: clipped digital blips, a two-tone handshake to confirm and a data-burst for a match.
const NIGHT_CITY: Pack = {
  hover: [tone("square", 3200, 3200, 0.012, 0.012)],
  tab: [tone("square", 1200, 1800, 0.04, 0.025), noise("highpass", 7000, 0.02, 0.015, 0.02)],
  confirm: [tone("square", 880, 880, 0.04, 0.025), tone("square", 1320, 1320, 0.05, 0.025, 0.05)],
  back: [tone("square", 1320, 660, 0.06, 0.025)],
  found: [...arpeggio("square", [660, 880, 1320, 1760, 2640], 0.045, 0.08, 0.02), noise("highpass", 5000, 0.35, 0.02, 0.24)],
};

const PACKS: Record<Skin, Pack> = {
  modern: VALORANT,
  current: VALORANT,
  glass: VALORANT,
  valnow: VALORANT,
  beta: BETA,
  csgo: CSGO,
  cs2: CS2,
  cs16: CS16,
  terminal: TERMINAL,
  fortnite: FORTNITE,
  minecraft: MINECRAFT,
  halo: HALO,
  pipboy: PIPBOY,
  league: LEAGUE,
  phantom: PHANTOM,
  nightcity: NIGHT_CITY,
};

// Hovering across a row of buttons must not machine-gun the hover cue.
const HOVER_MIN_GAP_MS = 45;
const NOISE_SECONDS = 1;

interface Options {
  pack: SoundPack;
  skin: Skin;
  volume: number;
  isHoverOn: boolean;
  useFiles: boolean;
}

let context: AudioContext | undefined;
let noiseBuffer: AudioBuffer | undefined;
let interfaceVolume = 1;
let options: Options = { pack: "auto", skin: "modern", volume: 1, isHoverOn: true, useFiles: true };
let lastHoverAt = 0;
/** Real files by `<style>:<cue>`, `all:<cue>` for every style. */
let files = new Map<string, string>();
const elements = new Map<string, HTMLAudioElement>();

export function setUiVolume(value: number): void {
  interfaceVolume = Math.min(1, Math.max(0, value));
}

export function setSoundOptions(next: Options): void {
  options = next;
}

/** Sound files found on disk, as playable urls keyed `<style>:<cue>`. */
export function setSoundFiles(next: Map<string, string>): void {
  files = next;
}

/** The pack a cue plays from right now: the chosen one, or the menu style's. */
function activePack(): Skin | null {
  if (options.pack === "off") return null;
  return options.pack === "auto" ? options.skin : options.pack;
}

export function playCue(cue: SoundCue): void {
  // The gallery's preview frame stays silent: hovering a preview must not click in your ears.
  if (isLookPreview) return;
  const pack = activePack();
  const volume = interfaceVolume * options.volume;
  if (!pack || volume === 0) return;
  if (cue === "hover") {
    if (!options.isHoverOn) return;
    const now = performance.now();
    if (now - lastHoverAt < HOVER_MIN_GAP_MS) return;
    lastHoverAt = now;
  }
  const file = options.useFiles ? (files.get(`${pack}:${cue}`) ?? files.get(`all:${cue}`)) : undefined;
  if (file) {
    playFile(file, volume);
    return;
  }
  playVoices(PACKS[pack][cue], volume);
}

/** Preview one cue of a pack (Studio), ignoring the hover switch and the pacing. */
export function previewCue(pack: Skin, cue: SoundCue): void {
  const volume = Math.max(0.2, interfaceVolume * options.volume);
  const file = options.useFiles ? (files.get(`${pack}:${cue}`) ?? files.get(`all:${cue}`)) : undefined;
  if (file) playFile(file, volume);
  else playVoices(PACKS[pack][cue], volume);
}

function playFile(url: string, volume: number): void {
  let source = elements.get(url);
  if (!source) {
    source = new Audio(url);
    source.preload = "auto";
    elements.set(url, source);
  }
  // A clone per play, so quick repeats overlap instead of restarting each other.
  const voice = source.cloneNode() as HTMLAudioElement;
  voice.volume = Math.min(1, volume);
  void voice.play().catch(() => undefined);
}

function playVoices(voices: Voice[], volume: number): void {
  if (voices.length === 0) return;
  context ??= new AudioContext();
  for (const voice of voices) playVoice(context, voice, volume);
}

function playVoice(audio: AudioContext, voice: Voice, volume: number): void {
  const start = audio.currentTime + (voice.delayS ?? 0);
  const end = start + voice.durationS;
  const attack = Math.min(voice.attackS ?? 0.006, voice.durationS / 2);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, voice.gain * volume), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(audio.destination);

  if (voice.wave === "noise") {
    const source = audio.createBufferSource();
    source.buffer = whiteNoise(audio);
    const filter = audio.createBiquadFilter();
    filter.type = voice.filter ?? "bandpass";
    filter.frequency.value = voice.from;
    filter.Q.value = voice.q ?? 1;
    source.connect(filter).connect(gain);
    source.start(start, Math.random() * Math.max(0, NOISE_SECONDS - voice.durationS - 0.01));
    source.stop(end + 0.01);
    return;
  }
  const oscillator = audio.createOscillator();
  oscillator.type = voice.wave;
  oscillator.frequency.setValueAtTime(voice.from, start);
  if (voice.to !== voice.from) oscillator.frequency.exponentialRampToValueAtTime(voice.to, end);
  oscillator.connect(gain);
  oscillator.start(start);
  oscillator.stop(end + 0.01);
}

function whiteNoise(audio: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buffer = audio.createBuffer(1, audio.sampleRate * NOISE_SECONDS, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}
