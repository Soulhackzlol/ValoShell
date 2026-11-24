// Words the VALORANT (current client) style prints, in the client's own wording. The style
// copies the real menu, so it speaks the player's client language: auto follows the system.
import { doc } from "~/studio/store";

type Lang = "en" | "es";

const TEXT = {
  play: { en: "Play", es: "Jugar" },
  progress: { en: "Battlepass", es: "Progreso" },
  agents: { en: "Agents", es: "Agentes" },
  owned: { en: "Show owned agents only", es: "Mostrar solo agentes obtenidos" },
  career: { en: "Career", es: "Carrera" },
  sidearms: { en: "Sidearms", es: "Armas de mano" },
  smgs: { en: "SMGs", es: "Subfusiles" },
  shotguns: { en: "Shotguns", es: "Escopetas" },
  rifles: { en: "Rifles", es: "Rifles" },
  snipers: { en: "Sniper rifles", es: "Fusiles de francotirador" },
  heavies: { en: "Machine guns", es: "Ametralladoras" },
  melee: { en: "Melee", es: "Cuerpo a cuerpo" },
  playerCards: { en: "Player cards", es: "Tarjetas de jugador" },
  expression: { en: "Expression", es: "Expresión" },
  premier: { en: "Premier", es: "Premier" },
  premierNone: { en: "No team", es: "Sin equipo" },
  modes: { en: "Open selections", es: "Selecciones abiertas" },
  pickMode: { en: "Select mode", es: "Selecciona un modo" },
  collection: { en: "Collection", es: "Colección" },
  store: { en: "Store", es: "Tienda" },
  live: { en: "Match", es: "Partida" },
  dailyBonuses: { en: "Daily bonuses", es: "Bonificaciones diarias" },
  missions: { en: "Missions", es: "Misiones" },
  leaderboard: { en: "Leaderboards", es: "Tabla de clasificación" },
  range: { en: "Enter the Range", es: "Entrar al campo de tiro" },
  partyCode: { en: "Party code", es: "Código de grupo" },
  partyClosed: { en: "Party closed", es: "Grupo cerrado" },
  partyOpen: { en: "Party open", es: "Grupo abierto" },
  leaveParty: { en: "Leave party", es: "Abandonar grupo" },
  findMatch: { en: "Find match", es: "Buscar partida" },
  cancel: { en: "Cancel", es: "Cancelar" },
  inQueue: { en: "In queue", es: "En cola" },
  ready: { en: "Ready", es: "Listo" },
  notReady: { en: "Not ready", es: "No listo" },
  partyChat: { en: "Party:", es: "Grupo:" },
  chatClosed: { en: "Party chat opens with VALORANT", es: "El chat de grupo se abre con VALORANT" },
  saySomething: { en: "Say something", es: "Escribe algo" },
  openChat: { en: "Open chat", es: "Abrir chat" },
  searchFriends: { en: "Name#Tag", es: "Nombre#Tag" },
  inVal: { en: "In VAL", es: "En VAL" },
  otherGame: { en: "Other game", es: "Otro juego" },
  offline: { en: "Offline", es: "Desconectado" },
  available: { en: "Available", es: "Disponible" },
  away: { en: "Away", es: "Ausente" },
  online: { en: "Online", es: "En línea" },
  inGame: { en: "In game", es: "En partida" },
  agentSelect: { en: "Agent select", es: "Selección de agente" },
  otherPlayers: { en: "other players", es: "otros jugadores" },
  invite: { en: "Invite", es: "Invitar" },
  message: { en: "Message", es: "Mensaje" },
  featured: { en: "Featured", es: "Destacados" },
  collectionSub: { en: "Collection", es: "Colección" },
  capsule: { en: "Capsule", es: "Cápsula" },
  capsuleNote: { en: "Teams receive a share of the proceeds from their capsules.", es: "Los equipos recibirán una parte de los beneficios de sus respectivas cápsulas." },
  patchNotes: { en: "Patch notes", es: "Notas de la versión" },
  dailyMissions: { en: "Daily missions", es: "Misiones diarias" },
  weeklyMissions: { en: "Weekly missions", es: "Misiones semanales" },
  refreshesIn: { en: "Refreshes in", es: "Se recarga en" },
  dailyReward: { en: "+1000 XP | +150 KC per checkpoint", es: "+1000 DE EXP | +150 CK por punto de control" },
  battlepass: { en: "Battlepass", es: "Pase de batalla" },
  season: { en: "Season 2026 // Act VI", es: "Temporada 2026 // Acto VI" },
  endsIn: { en: "Ends in", es: "Termina en" },
  days: { en: "days", es: "días" },
  tier: { en: "Tier", es: "Rango" },
  xpLeft: { en: "XP remaining", es: "EXP restante" },
  premiumNeeded: { en: "Premium upgrade required", es: "Se necesita mejora prémium" },
  upgradePass: { en: "Upgrade battlepass", es: "Mejorar pase de batalla" },
  objectives: { en: "Objectives", es: "Objetivos" },
  free: { en: "Free", es: "Gratis" },
  unlockWith: { en: "Unlock with", es: "Desbloquear con" },
  rewards: { en: "rewards", es: "Recompensas de" },
  useAbilities: { en: "Use your abilities.", es: "Usa tus habilidades." },
  dealDamage: { en: "Deal damage.", es: "Inflige daño." },
  useUltimate: { en: "Use your ultimate.", es: "Usa tu definitiva." },
  xp: { en: "XP", es: "DE EXP" },
  rangeNote: { en: "Open the Range from the game itself.", es: "Abre el campo de tiro desde el juego." },
  codeCopied: { en: "Party code copied", es: "Código de grupo copiado" },
  attackers: { en: "Attackers", es: "Atacantes" },
  defenders: { en: "Defenders", es: "Defensores" },
  spectators: { en: "Spectators", es: "Espectadores" },
  modeRow: { en: "Mode", es: "Modo" },
  mapRow: { en: "Map", es: "Mapa" },
  options: { en: "Options", es: "Opciones" },
  server: { en: "Server", es: "Servidor" },
  start: { en: "Start", es: "Comenzar" },
  autobalance: { en: "Autobalance", es: "Autoequilibrio" },
  joinTeam: { en: "Join this team", es: "Unirse a este equipo" },
  settingsInClient: { en: "Change the lobby settings in VALORANT for now.", es: "Por ahora, cambia los ajustes de la sala en VALORANT." },
  recruitment: { en: "Recruitment", es: "Reclutamiento" },
  noRecruitment: { en: "No event right now", es: "Ningún evento ahora" },
  recruit: { en: "Recruit", es: "Recluta a" },
  agentContracts: { en: "Agent contracts", es: "Contratos de agente" },
  noContracts: { en: "None started yet", es: "Ninguno empezado" },
} as const satisfies Record<string, Record<Lang, string>>;

export type TextKey = keyof typeof TEXT;

/** Queue labels as the Spanish client names them; English uses Riot's own labels. */
const QUEUE_ES: Record<string, string> = {
  unrated: "No competitivo",
  competitive: "Competitivo",
  swiftplay: "Modo rápido",
  spikerush: "Fiebre de la Spike",
  deathmatch: "Combate a muerte",
  hurm: "Combate a muerte por equipos",
  ggteam: "Carrera armamentística",
  onefa: "Copia",
  snowball: "Pelea de bolas de nieve",
  premier: "Premier",
  newmap: "Nuevo mapa",
  fortcollins: "Reconquista",
  abilitydraftarena: "Galería de pruebas: Glitch",
  skirmish2v2: "Escaramuza: 2v2",
  custom: "Personalizada",
};

/** The same, keyed by Riot's English label (friend presence only carries the label). */
const LABEL_ES: Record<string, string> = {
  "Unrated": "No competitivo",
  "Competitive": "Competitivo",
  "Swiftplay": "Modo rápido",
  "Spike Rush": "Fiebre de la Spike",
  "Deathmatch": "Combate a muerte",
  "Team Deathmatch": "Combate a muerte por equipos",
  "Escalation": "Carrera armamentística",
  "Replication": "Copia",
  "Snowball Fight": "Pelea de bolas de nieve",
  "New Map": "Nuevo mapa",
  "Retakes": "Reconquista",
  "Custom": "Personalizada",
  // Custom-game modes (the asset table's English names).
  "Standard": "Estándar",
  "Skirmish": "Escaramuza",
};

export function valLang(): Lang {
  const chosen = doc.theme.language;
  if (chosen === "en" || chosen === "es") return chosen;
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function vt(key: TextKey): string {
  return TEXT[key][valLang()];
}

/** A queue's name from its id (party) or its English label (friends). */
export function queueName(id: string, label: string): string {
  if (valLang() === "en") return label;
  return QUEUE_ES[id.toLowerCase()] ?? LABEL_ES[label] ?? label;
}

/** A custom-game mode's English asset name ("Standard") as the client prints it. */
export function modeLabel(name: string): string {
  return valLang() === "en" ? name : LABEL_ES[name] ?? name;
}

/** Large numbers grouped the way the client does: `18 500` in Spanish, `18,500` in English. */
export function groupNumber(value: number): string {
  const digits = Math.round(value).toString();
  if (digits.length < 5) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, valLang() === "es" ? "\u202f" : ",");
}
