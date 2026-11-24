// Every style's own Agent select, Lobby, News, Progress, Chat and Results: three markups
// (styledMatch.tsx, styledScreens.tsx, styledResults.tsx) dressed by each style's sheet and named in its own words, so a CS 1.6 lobby
// reads "Terrorist Force" and Terminal's lock button is a `lock-in` command, while the rules
// stay the standard pieces'.
import { type MatchWords, VALORANT_WORDS, matchLooks } from "./styledMatch";
import { type ResultWords, resultsLook } from "./styledResults";
import { type ScreenWords, VALORANT_SCREEN_WORDS, screenLooks } from "./styledScreens";
import glassNews from "./glassNews.module.css";
import valMatch from "./valMatch.module.css";
import betaMatch from "./betaMatch.module.css";
import v22Match from "./v22Match.module.css";
import csgoMatch from "./csgoMatch.module.css";
import cs2Match from "./cs2Match.module.css";
import cs16Match from "./cs16Match.module.css";
import terminalMatch from "./terminalMatch.module.css";
import fortniteMatch from "./fortniteMatch.module.css";
import minecraftMatch from "./minecraftMatch.module.css";
import haloMatch from "./haloMatch.module.css";
import pipboyMatch from "./pipboyMatch.module.css";
import leagueMatch from "./leagueMatch.module.css";
import phantomMatch from "./phantomMatch.module.css";
import nightcityMatch from "./nightcityMatch.module.css";

const word = (lock: string, locked: string, dodge: string, allies: string, enemies: string): MatchWords => ({
  ...VALORANT_WORDS,
  lock,
  locked,
  dodge,
  allies,
  enemies,
});

const BETA = word("Lock in", "Locked", "Dodge", "Your team", "Enemy team");
const CSGO = word("Accept", "Accepted", "Leave", "Counter-Terrorists", "Terrorists");
const CS2 = word("Accept", "Accepted", "Leave", "Your team", "Enemy team");
const CS16 = word("OK", "Joined", "Cancel", "Counter-Terrorist Force", "Terrorist Force");
const TERMINAL = { ...word("lock-in", "locked", "dodge", "allies", "enemies"), dodgeArmed: "dodge --confirm" };
const FORTNITE = word("Ready up", "Ready!", "Leave", "Your squad", "Other squad");
const MINECRAFT = word("Done", "Waiting...", "Cancel", "Your Team", "Other Team");
const HALO = word("Ready", "Ready", "Quit", "Red Team", "Blue Team");
const PIPBOY = word("Accept", "Accepted", "Leave", "Allies", "Hostiles");
const LEAGUE = word("Lock in", "Locked in", "Dodge", "Your team", "Enemy team");
const PHANTOM = word("Take your heart", "Calling card sent", "Retreat", "Phantom Thieves", "Shadows");
const NIGHTCITY = word("Jack in", "Jacked in", "Bail", "Your crew", "Opposition");

export const ValMatch = matchLooks(valMatch, VALORANT_WORDS);
export const BetaMatch = matchLooks(betaMatch, BETA);
export const V22Match = matchLooks(v22Match, VALORANT_WORDS);
export const CsgoMatch = matchLooks(csgoMatch, CSGO);
export const Cs2Match = matchLooks(cs2Match, CS2);
export const Cs16Match = matchLooks(cs16Match, CS16);
export const TerminalMatch = matchLooks(terminalMatch, TERMINAL);
export const FnMatch = matchLooks(fortniteMatch, FORTNITE);
export const McMatch = matchLooks(minecraftMatch, MINECRAFT);
export const HaloMatch = matchLooks(haloMatch, HALO);
export const PipMatch = matchLooks(pipboyMatch, PIPBOY);
export const LolMatch = matchLooks(leagueMatch, LEAGUE);
export const PhMatch = matchLooks(phantomMatch, PHANTOM);
export const NcMatch = matchLooks(nightcityMatch, NIGHTCITY);

/** News title, patch link, pass, daily, weekly, chat label, chat placeholder. */
type ScreenWordList = [string, string, string, string, string, string, string];

function screenWords(list: ScreenWordList): ScreenWords {
  const [news, patch, pass, daily, weekly, chat, placeholder] = list;
  return { news, patch, pass, daily, weekly, chat, placeholder };
}

const S_BETA = screenWords(["News // beta", "Patch notes", "Battle pass", "Daily", "Weekly", "Party", "Say something"]);
const S_CSGO = screenWords(["Blog", "Release notes", "Operation", "Daily", "Weekly", "Party", "Say something"]);
const S_CS2 = screenWords(["News", "Release notes", "Armory pass", "Daily", "Weekly", "Party", "Type a message"]);
const S_CS16 = screenWords(["News", "Patch notes", "Progress", "Daily", "Weekly", "say_team :", ""]);
const S_TERMINAL = screenWords(["$ news --latest", "changelog", "$ pass", "daily", "weekly", "say >", ""]);
const S_FORTNITE = screenWords([
  "News",
  "Patch notes",
  "Battle Pass",
  "Daily Quests",
  "Weekly Quests",
  "Party",
  "Chat",
]);
const S_MINECRAFT = screenWords(["Latest News", "Changelog", "Advancements", "Daily", "Weekly", "<you>", ""]);
const S_HALO = screenWords([
  "Waypoint",
  "Patch notes",
  "Battle pass",
  "Daily challenges",
  "Weekly challenges",
  "Fireteam",
  "",
]);
const S_PIPBOY = screenWords(["RADIO", "PATCH NOTES", "PERKS", "DAILY QUESTS", "WEEKLY QUESTS", "COMMS", ""]);
const S_LEAGUE = screenWords([
  "News",
  "Patch notes",
  "Event pass",
  "Missions",
  "Weekly missions",
  "Lobby",
  "Say something",
]);
const S_PHANTOM = screenWords([
  "Phan-Site",
  "Patch notes",
  "Confidants",
  "Today's requests",
  "This week",
  "Thieves",
  "",
]);
const S_NIGHTCITY = screenWords(["N54 News", "Patch notes", "Street cred", "Gigs", "Weekly gigs", "Holo", ""]);

export const GlassNews = screenLooks(glassNews, VALORANT_SCREEN_WORDS).News;
export const BetaScreens = screenLooks(betaMatch, S_BETA);
export const V22Screens = screenLooks(v22Match, VALORANT_SCREEN_WORDS);
export const CsgoScreens = screenLooks(csgoMatch, S_CSGO);
export const Cs2Screens = screenLooks(cs2Match, S_CS2);
export const Cs16Screens = screenLooks(cs16Match, S_CS16);
export const TerminalScreens = screenLooks(terminalMatch, S_TERMINAL);
export const FnScreens = screenLooks(fortniteMatch, S_FORTNITE);
export const McScreens = screenLooks(minecraftMatch, S_MINECRAFT);
export const HaloScreens = screenLooks(haloMatch, S_HALO);
export const PipScreens = screenLooks(pipboyMatch, S_PIPBOY);
export const LolScreens = screenLooks(leagueMatch, S_LEAGUE);
export const PhScreens = screenLooks(phantomMatch, S_PHANTOM);
export const NcScreens = screenLooks(nightcityMatch, S_NIGHTCITY);

/** Victory, defeat, draw; the line over them; Continue; the MVP mark. The teams are the lobby's. */
type ResultWordList = [string, string, string, string, string, string];

function resultWords(match: MatchWords, list: ResultWordList): ResultWords {
  const [victory, defeat, draw, context, next, mvp] = list;
  return {
    result: { victory, defeat, draw },
    context,
    continue: next,
    allies: match.allies,
    enemies: match.enemies,
    mvp,
  };
}

export const BetaResults = resultsLook(
  betaMatch,
  resultWords(BETA, ["Victory", "Defeat", "Draw", "Match summary // beta", "Continue", "MVP"]),
);
export const V22Results = resultsLook(
  v22Match,
  resultWords(VALORANT_WORDS, ["Victory", "Defeat", "Draw", "Match summary", "Continue", "MVP"]),
);
export const CsgoResults = resultsLook(
  csgoMatch,
  resultWords(CSGO, ["Match won", "Match lost", "Match tied", "Competitive results", "Continue", "★"]),
);
export const Cs2Results = resultsLook(
  cs2Match,
  resultWords(CS2, ["You won", "You lost", "Tied", "Match results", "Continue", "★"]),
);
export const Cs16Results = resultsLook(
  cs16Match,
  resultWords(CS16, ["Counter-Terrorists Win!", "Terrorists Win!", "Round Draw!", "Scores", "OK", "Best"]),
);
export const TerminalResults = resultsLook(
  terminalMatch,
  resultWords(TERMINAL, [
    "exit 0  victory",
    "exit 1  defeat",
    "exit 2  draw",
    "$ match --report",
    "continue",
    "[mvp]",
  ]),
);
export const FnResults = resultsLook(
  fortniteMatch,
  resultWords(FORTNITE, ["#1 Victory Royale", "Eliminated", "Draw", "Match stats", "Continue", "MVP"]),
);
export const McResults = resultsLook(
  minecraftMatch,
  resultWords(MINECRAFT, ["Victory!", "You Died!", "Draw", "Game over", "Title Screen", "MVP"]),
);
export const HaloResults = resultsLook(
  haloMatch,
  resultWords(HALO, ["Victory", "Defeat", "Tie", "Carnage report", "Continue", "MVP"]),
);
export const PipResults = resultsLook(
  pipboyMatch,
  resultWords(PIPBOY, ["Quest completed", "Quest failed", "Quest stalled", "Data", "Continue", "★"]),
);
export const LolResults = resultsLook(
  leagueMatch,
  resultWords(LEAGUE, ["Victory", "Defeat", "Draw", "Post-game", "Continue", "MVP"]),
);
export const PhResults = resultsLook(
  phantomMatch,
  resultWords(PHANTOM, ["Mission complete!", "Busted!", "Clean escape", "Results", "Continue", "★"]),
);
export const NcResults = resultsLook(
  nightcityMatch,
  resultWords(NIGHTCITY, ["Gig complete", "Flatlined", "Stalemate", "Debrief", "Continue", "MVP"]),
);
