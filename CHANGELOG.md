# Changelog

All notable changes land here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-24

### Removed

- The "Enemy ranks in agent select" setting: Riot only sends your own team during agent select,
  so it could never show anything. Enemy ranks still appear once the match starts.

### Changed

- Tauri 2.12.5 and Vite 8.3.5.
- The window always opens on the monitor VALORANT runs on (the main monitor when the game is
  closed) and can no longer be dragged: fullscreen, or centred at the client's size for the
  League style.
- The VALORANT style's Career page shows your real agent mastery (top three agents and their
  levels) and your Premier team, as the client does.

### Added

- Two new styles: Phantom, after Persona 5's slanted cut-out menus, and Night City, a
  Cyberpunk netrunner interface. Sixteen in all.
- In-app updates: a notice when a new release is out, with its notes. Installing downloads the
  new exe, checks it against the release's SHA-256 sums and restarts into it, only when you
  click, never mid-match. Checking can be turned off.
- Chat: party chat, your team in agent select, and whispers with friends, in a resizable panel
  with unread counts. Names in chat are only ever the ones the menu already shows, so chat never
  reveals a hidden name; whispers are with friends only.
- Community looks: the Studio gallery lists themes other players shared, and you can share
  yours (it copies the look and opens GitHub to propose it). Looks are added to the ValoShell
  repository by pull request and checked before use, so a shared look can only change colours
  and layout. The gallery also has starter looks and a live preview.
- A welcome tour on first run (skippable, and it can be replayed from the Esc menu).
- Loadout presets: save your whole loadout (skins, chromas, buddies, card, title and wheel) under
  a name and equip it again in one click. Anything you no longer own is skipped, never forced.
- Card, title, spray wheel and gun buddies can be changed from the menu, with one picker for all.
- A wishlist: wish for any store skin and see when one is on sale today. It stays in ValoShell;
  nothing is sent to Riot.
- Stats over your recent matches (K/D, ACS, headshot %, ADR, win rate), overall, by agent and by
  map; Deathmatch, arcade modes and customs don't count.
- The competitive leaderboard for your region this act, your own line highlighted.
- A notice for account restrictions (queue bans, queue delays, ranked or chat restrictions) and
  when they lift, so a failed queue says why.
- Interface size, high contrast and colour-vision palettes in the Esc menu, and every style's own
  colours can be changed role by role in Studio.
- Pieces can be given motion of their own (entrance, idle and hover), and backdrops can show
  your last match's map or agent, or a new one each launch.
- Effects quality (Auto, Full, Lite) in Settings: Auto turns blur and moving backdrops off on a
  PC that can't keep the menu smooth. The menu also rests (animations and backdrops stop) while
  it is hidden or another window has been focused for a while.
- Friend requests: see incoming and sent requests, accept, decline or cancel them, and add a
  friend by Riot ID.
- A banner when Riot reports maintenance or an incident for VALORANT.
- The Progress page shows the active agent recruitment event and your agent contract levels.
- The agents page shows a locked agent's store price, view only.
- Skins you starred in the game count as favourites in the skin picker.
- Party sizes everywhere: friends lists say "Duo", "Trio" or "5-stack", the post-match
  scoreboard marks who queued together, and the Career history shows who you queued with.
- More looks: the VALORANT 2022 style has its own party, play, agents and friends pieces;
  Beta has its own agents page; every style now has a Friends look and almost every style a
  Party look; Glass has its own agent select, lobby, post-match, progress and chat.
- Agent select, the lobby, post-match, the collection, progress and chat can switch looks in
  Studio like the other pieces, and the Agents page has Grid, Roster and Spotlight layouts that
  every style's agents look can use.
- Layouts for the Halo, League, Terminal and CS 1.6 pieces.
- Every style has its own Play, Modes, Rank, Profile, Agent select, Lobby, News, Progress, Chat
  and match report: Terminal's `queue start` and `$ news --latest`, Minecraft's XP-bar rank, a
  CS 1.6 lobby that reads "Terrorist Force" and a `say_team :` chat line, Halo's service-record
  nameplate and the rest, all following the standard pieces' rules. The match reports speak each
  game's language: Minecraft's "You Died!", Fortnite's "#1 Victory Royale", CS:GO's MVP stars.
- Switching style now uses the style's own looks everywhere: agent select, the live match and
  the match report switch to that style's pieces (a look you took from another style stays),
  and Home gets the style's own party chat line where the floating chat button sat.
- The chat panel is dressed in each style (a frosted Glass card, an olive CS 1.6 window, Pip-Boy
  phosphor, a Minecraft GUI...), and every chat line has three layouts: the line, a chat box
  with the latest party messages, or just its icon. Its icon opens the full chat, so the
  floating chat button steps aside while a chat line is on screen.
- Minecraft trading and statistics have layouts of their own: Villager, Chest and List trades;
  the Statistics screen, two columns or compact numbers.
- New store and career looks: a Pip-Boy barter screen, a Cyberpunk vendor with rarity tiers,
  CS:GO's Panorama profile and CS2's Premier rating with a rating graph.

### Fixed

- Phantom: the main menu no longer replays its entrance every second while searching (the clock
  rebuilt every word); Pip-Boy's key hints no longer drop focus the same way.
- Minecraft trading: "Open store" went nowhere (the piece is the store). The trade now keeps a
  wish instead, the store's shelves (daily, bundle, Night Market, accessories) are tabs, with an
  "Opens on" option, and a discounted trade shows its old price struck through.
- Chat lines: with the chat chip stepped aside, its unread badge (party and whispers) now sits on
  the line's open-chat button, and closing the chat returns focus to that button instead of the
  page.
- Party lists in Phantom, Night City and Pip-Boy refresh rows in place on a party update instead
  of remounting them (no replayed entrance, no lost focus).
- Party codes no longer leak: logs and error messages mask them, the "copied" toast no longer
  prints the code, the command palette shows "Copy" instead of the code, and in streamer mode the
  code is blurred and the join field shows dots.
- The party chat line in every style sends to party chat, shares its draft with the chat dock and
  recalls your last message with Up; before, it cleared what you typed without sending it.
- Deleting a saved loadout and "Restore defaults" in settings also ask for a second click.
- The VALORANT store's daily offers put a skin on your wishlist with a click (a heart marks it),
  instead of buttons that only said "buy in the game"; the bundle price is a label, and the Gift
  button that could never work is gone.
- Calmer motion: toggles, the nav underline, the update bar, the store's corner brackets and the
  social panel move with transforms instead of resizing, and Studio's offset dot follows the
  pointer without lag.
- VALORANT 2022's social panel keeps friends' names readable in a narrow window, and its agent
  roster rows line up.
- Small labels (party tags, MVP badges, League captions) no longer shrink below readable size.
- Switching style while editing no longer draws the moving pieces over Studio's panel, the
  editing bar or the style toast during the animation.
- Dodge asks for a second click within three seconds, so a stray click can't cost RR and a queue
  ban.
- Streamer mode now blurs every player name: party and friend names in the Beta, Minecraft and
  Fortnite styles showed through, and name tooltips are dropped while it is on.
- The CS:GO store look can be picked in Studio's Store piece.
- Moving backdrops no longer drift with the mouse.
- The fullscreen menu no longer flickers when it reopens after a match.

## [0.1.0] - First public release

The first public release, the one from the video. You may still find rough edges;
[reports](https://github.com/Soulhackzlol/ValoShell/issues/new/choose) help a lot.

### Menus

- **Play**: queues, party invites and codes, kicks, ready checks and custom games.
- **Agent select**: your team's picks and the timer, with select and lock in from the menu.
  Agents you haven't unlocked show as locked.
- **Agents**: every agent's abilities and your Agent Mastery level, with a "Show owned
  agents only" toggle.
- **Lobby**: rank, peak rank, RR, win rate and party stacks for every player. Enemy ranks
  during agent select are off by default and only requested when switched on.
- **Post-match**: the full scoreboard, your stats and your RR change.
- **Store**: daily offers, bundles, accessories and the Night Market.
- **Collection**: every skin, chroma and level, equipped straight from the menu.
- **Career**: rank, act history and match history.
- **Social**: friends with their status and mode, and the latest VALORANT news.

### Styles and Studio

- **Fourteen menu styles**: Modern, VALORANT, VALORANT Glass, VALORANT Beta, VALORANT 2022,
  League client, CS2, CS:GO, CS 1.6, Fortnite, Minecraft, Halo 3, Pip-Boy and Terminal.
- **Studio**: drag, resize and restyle every piece of every page, and save it as a layout.
- **Widgets** (stream delay, clock, match score) reflow to any size, with four looks (Panel,
  Glass, Minimal, Broadcast) and four layouts (Auto, Row, Stack, Compact).

### Streaming

- **Streamer mode** hides every name on screen.
- **In-game overlay** that stays click-through.
- **InstantClone widget** to set the stream delay or cut back to live from the menu.

[Unreleased]: https://github.com/Soulhackzlol/ValoShell/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Soulhackzlol/ValoShell/releases/tag/v0.2.0
[0.1.0]: https://github.com/Soulhackzlol/ValoShell/releases/tag/v0.1.0
