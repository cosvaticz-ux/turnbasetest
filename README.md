# Litania X — discontinued web RPG prototype

An old dark-fantasy RPG prototype built with plain HTML, CSS and JavaScript.
Development has moved on, and this project is no longer actively maintained.
It is being prepared for public release primarily for learning, experimentation
and modification. It is unfinished, with draft content and placeholder art.

The playable demo includes four exploration maps, turn-based battles, dialogue,
a shop, inventory/equipment and skill menus, settings, and local save/Continue.
The active route is Deep Forest ↔ Front Forest ↔ Town South ↔ Town North.
New Game starts in Front Forest. The larger story/campaign data is experimental;
its full quest route is not verified in the current demo UI.

Background music and all continuous background ambience loops have intentionally
been removed from this public-release version. Gameplay sound effects remain.

## Open and run

There is no game engine or framework dependency and no build step. Use a current
desktop browser. The development scripts and checks require Node.js 22 or newer.

From the repository root, run:

```sh
node scripts/preview-exploration.mjs
```

Open [the local game](http://127.0.0.1:8080/) and select **New Game**.
Use an HTTP server rather than opening `index.html` directly, because the game
loads JavaScript modules. Any equivalent static server can also serve the project.
Stop the included server with Ctrl+C.

Saves are stored in the browser for the current origin. Changing browser, port or
hostname uses a different save location. Google Fonts supplies optional typography;
the game uses system-font fallbacks without network access.

## Basic controls

| Context | Controls |
| --- | --- |
| Title | Arrow keys/WASD to navigate; Enter/Space to select; mouse buttons also work |
| Exploration | WASD/arrow keys to move; E/Space to interact |
| Field menus | B: combined inventory/equipment; K: skills; Escape: close |
| Battle | Use command buttons or keyboard navigation and confirmation |
| Geometry inspector | F2 toggles calibrated map references and collision/warp overlays |

The standalone map editor is available at
[map-editor.html](http://127.0.0.1:8080/map-editor.html).
The blockout inspector is available at
[index.html?scene=map-blockout](http://127.0.0.1:8080/index.html?scene=map-blockout).

## Checks

```sh
node scripts/run-checks.mjs
```

This checks JavaScript syntax and runs all 36 regression test files in separate
processes. Any failed check makes the command exit nonzero. Use `--syntax-only`
to check syntax without running tests.

With the local server running and Playwright available, the optional browser check is:

```sh
node scripts/browser-smoke.cjs
```

It uses installed Edge on Windows, or Playwright Chromium elsewhere.
`BROWSER_CHANNEL` and `EXPLORATION_URL` can override those defaults. It blocks
external font requests to exercise system-font fallbacks. See the
[release audit](docs/PUBLIC_RELEASE_AUDIT.md) for validation results and limits.

## Project notes

`game.js` starts the application; `src/` contains scenes, combat, state and content;
`assets/` contains game art and SFX; `tests/` contains regression checks.
The [asset guide](ASSET_GUIDE.md), [game flow](GAME_FLOW.md),
[battle flow](BATTLE_FLOW.md), and remaining `docs/` explain the prototype.
Some development notes describe earlier implementations.

Map blueprints are generated locally with `node scripts/export-map-blueprint.mjs`;
the generated images are excluded from version control. Optional `sharp` support
adds PNG exports; SVG generation has no package dependency.

## License and publication status

No project license has been selected. The intended learning/modification use above
does not grant a license. Before publication, the owner must choose a source-code
license, verify [asset redistribution rights](docs/THIRD_PARTY_ASSETS.md), and
resolve the [Git history items](docs/PUBLIC_RELEASE_AUDIT.md#git-history).
No publication or push is performed by the cleanup.
