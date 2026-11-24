# Contributing to ValoShell

Thanks for helping. ValoShell is young, so bug reports are as valuable as code.
Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and ideas

Use the [issue forms](https://github.com/Soulhackzlol/ValoShell/issues/new/choose). A screenshot
and the steps to reproduce make a bug far easier to fix. Report security problems privately
through [a security advisory](https://github.com/Soulhackzlol/ValoShell/security/advisories/new).

## Setting up

You need Windows 10/11, [Rust](https://rustup.rs) 1.96+ and [Node.js](https://nodejs.org) 22+.

```sh
npm install
npm run ui:dev    # the menu in a browser with demo data; no VALORANT needed
npm run dev       # the full app, talking to your running Riot Client
```

Most UI work, including new styles, can be done entirely in `npm run ui:dev`.

## Before opening a pull request

```sh
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace    # also regenerates ui/src/bindings; commit any changes
npm run ui:check
npm run ui:test
```

CI runs the same checks on every pull request.

If you changed how anything looks, also run the layout sweep with `npm run ui:dev` open:
`npm run ui:layout`. It checks every style at eight window sizes (1100x680 up to ultrawide) for
buttons pushed off screen, text spilling out of its panel, text drawn over text and tiny text,
and fails only on findings not already reviewed in `ui/scripts/layout-baseline.json`. Add
`--shots <folder>` to see screenshots of what it found.

The layout sweep sees only the looks the default layouts place. `npm run ui:looks` checks every
style's own looks (its Play, Agent select, Results and the rest) the same way, each alone at its
default size at 1100x680, 1080p and ultrawide; its reviewed findings live in
`ui/scripts/look-baseline.json`, and `--raw` prints each finding with its pixels.

## Code style

- Small functions (40 lines at most) with clear, unabbreviated names.
- Comments explain why, not what.
- `crates/domain` stays free of I/O; network calls live in `crates/riot`.
- Keep pull requests focused on one change.

## Adding a menu style

Styles live entirely in the UI; no Rust changes are needed.

1. Add its id to `SKIN_IDS` in `ui/src/studio/types.ts`. `npm run ui:check` then lists every
   per-style table that needs an entry (sounds, cursor, click effect, transition, collection,
   store and career looks).
2. Add its bundle (colours, font, corners, backdrop) to `ui/src/studio/skins/bundles.ts`, and
   its tab names and piece prefix in `ui/src/studio/skins/index.ts`.
3. Add its pieces and CSS modules in `ui/src/pieces/styled/`, register them in
   `ui/src/studio/registry/styles/<style>.tsx` (one line in `registry/index.ts`), and lay out its
   screens in `ui/src/studio/skins/layouts.ts`. A piece that is the style's look of something
   the menu already has (its party, PLAY button, agents page, friends list...) goes under that
   job in `ui/src/studio/registry/jobs.ts`: Studio then offers the job once and lets players
   switch looks, instead of listing one copy per style. Your look also gets the job's shared
   layouts (the standard piece's Cards, Portraits, Strip...) drawn in your style's theme tokens,
   so look and layout stay separate choices; check them in your style too.
4. Give it a nav in `ui/src/menu/` (shared parts in `navParts.tsx`), its theme sheet in
   `ui/src/theme/`, and its recolourable roles in `ui/src/theme/palettes.ts`.
5. Check every page in `npm run ui:dev`, run `npm run ui:layout -- --styles <id>` and
   `npm run ui:looks -- --styles <id>`, and add screenshots to the pull request.
6. Give it its own entrance in `ui/src/studio/motion.ts` (how pieces arrive under "Style's
   own") and its "Style's own" widget box in `ui/src/pieces/widgetLooks.module.css`. Keep it
   calm: nothing leans or drifts after the pointer.

## Pieces that adapt

Every piece is told where it is and what is happening, so it can change form instead of just
shrinking:

- On the piece body: `data-size` (`tiny`, `small`, `medium`, `large`), `data-shape` (`wide`,
  `tall`, `square`) and `data-anchor` (the screen region it sits in). Style a piece's compact
  form with `:global([data-size="tiny"]) .yourClass`.
- On the root: `data-skin` (the menu style) and `data-moment` (`idle`, `party`, `queueing`,
  `match-found`, `agent-select`, `in-game`, `post-match`, `offline`).
- In components: `usePieceContext()` from `ui/src/studio/pieceFrame.tsx` for the same facts.
- A piece with layouts can list `autoLayouts` in its registry entry (the layout each size
  suits); it then switches on its own while the player has not picked one.

## What ValoShell won't accept

ValoShell only does what the official client can do through the Riot Client's local API.
Changes that automate gameplay or agent select, read game memory, or touch the game process
won't be merged. `crates/services/tests/red_lines.rs` fails the build if store purchase
endpoints, memory-access or input-synthesis APIs, or automation crates ever appear.

## License

By contributing you agree that your work is released under the [GPL-3.0-or-later](LICENSE).
