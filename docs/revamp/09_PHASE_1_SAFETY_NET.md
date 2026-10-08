# Phase 1 — Actionable safety net

Base: main at `8ad4563fa644b1e250221a5fe53dd7c50c1fec5f`.
Scope: test infrastructure, regression contracts and runtime documentation. Production JavaScript, HTML, CSS, map data, artwork, audio, rules and balance are unchanged. This builds on [Phase 0 audit PR #38](https://github.com/cosvaticz-ux/TurnBasedGame-AI-Test/pull/38); the audit remains a separate draft.

## Run checks

```sh
node scripts/run-checks.mjs
node scripts/run-checks.mjs --syntax-only
```

Use a complete checkout and Node 22 or newer. Validation here used Node 24.19.0. The dependency-free runner resolves the repository from its own location, checks source/test/script syntax, runs every Node test file in isolation, continues after failures, and returns exit 1 for any syntax or test failure. Spawn errors, signals, timeouts and missing assets never become passes. No test is marked skip or TODO to suppress a defect.

The runner's own tests prove that an early failing file cannot be hidden by a later passing file; invalid source syntax is reported; later test files still execute; global mocks do not leak between processes; syntax-only mode does not execute tests; an empty test directory cannot succeed. ES modules are parsed explicitly through `--input-type=module --check`; `.cjs` uses CommonJS. This also avoids ambiguous `.js` syntax detection missing malformed exports.

## Updated contracts

- Fixed the missing closing parenthesis in exploration-presentation. All five previously unreachable warp/shadow/foot-anchor/geometry checks now execute.
- Replaced obsolete individual walk-frame preload expectations with all six current sheet sources, exactly once in each active map group; obsolete frame paths stay forbidden.
- Exploration integration checks all eight walk directions, current frame counts/grids/mirroring, 75 ms timing, clamping, five idle poses, source deduplication and the unchanged catalog audio mapping. Actual PNG presence, dimensions and NPC RGBA checks run as independent subtests, so a missing file cannot conceal source checks.
- Kept `environment-main-geometry.json` unchanged. It predates the intentional sign relocation, Mara replacement, patrol relocation and chibi metadata in current main. Geometry/camera/reference/exit/spawn/encounter-zone comparisons still use that immutable fixture. A separate `phase1-runtime-placements.json`, pinned to the current main commit, freezes every current enemy and interactable including coordinates, roles, rewards and visual metadata.
- Replaced an obsolete minimum-polygon-count assertion with exact authored-contour comparison plus finite, valid vertex checks. One detailed polygon is legitimate. Graph reachability runs independently of arrival checks.
- Split all six directed warp arrivals into independent tests in both exploration suites. A defective edge cannot hide other edges or graph contracts.
- Moved the existing battle DOM/timer mock unchanged into `tests/helpers/battle-dom.mjs`; the original lifecycle tests retain their assertions and pass. New save tests reuse that harness and the real BattleScene, GameManager and SaveManager.
- README now describes the actual four-map illustrated polygon runtime, its owners and dormant content, with the fail-aware commands.

## Observed validation

| Check | Result |
|---|---|
| Source/test/script syntax | 169/169 passed |
| Isolated Node test files | 32/36 passed; 4 failed; aggregate exit 1 |
| Existing battle presentation/lifecycle regression | Passed after harness extraction |
| Preloader, environment, presentation and runner focused checks | Passed |
| Current active-map content references | `validateContent()` still returns no errors |
| Production and asset changes | None |
| Browser smoke/visual validation | Not performed |

Counts above are files, except the syntax count. This is an actionable **red baseline**, not a green release gate. The four failing files have explicit causes:

| File | Source defect | Local asset limitation |
|---|---|---|
| battle-save-checkpoint.test.mjs | Three new desired durability contracts fail at victory result, victory summary and defeat result | None needed for the assertions; media is mocked |
| exploration-integration.test.mjs | Current source/audio/available-image contracts pass | Six PNGs are unavailable locally: Luke idle2/nw/w/s, chibi Woman and Mara |
| greybox-warp-calibration.test.mjs | Deep Forest → Front Forest arrival is off-walkable; other five arrivals pass | Original four greybox reference PNGs unavailable locally |
| lane-exploration.test.mjs | Same bad directed arrival; graph and original geometry checks now execute and pass | Original greybox PNG checks cannot read local files |

The absent PNGs exist in the pinned Git tree. The authenticated content route supplied no bytes for files above its content-size limit, and the blob route rejected binary responses. Available binary downloads were hash-verified against their original Git blobs. No placeholder files were introduced and asset assertions were not disabled. A clean full clone must re-run all checks before claiming image or playable parity.

## Settlement regression and next boundary

The new tests save pre-battle state, enter a fixed Highwayman encounter, consume its real shared healing draught, change combat HP, finish victory/defeat, then reload through SaveManager at the result or summary boundary. They assert one coherent outcome checkpoint with final resources and appropriate reward/completion identity.

Observed victory reload: HP 110 instead of 23, draught quantity 1 instead of 0, rewards resolved, fixed encounter incomplete. Observed defeat reload: HP 110 instead of the existing retreat policy's 33, draught still present. These are ordinary failing assertions with cleanup in `finally`; they should turn green when Phase 2 repairs settlement. No production behavior is changed in this phase.

Next implementation boundary: final HP/items/status/class/down state, rewards, origin and fixed completion must become durable together; retain existing reward values and summary timing and cover duplicate resolution, random encounter identities and storage failure. The separate geometry correction requires a targeted reviewed change to the bad calibrated arrival, preserving map contours.

The old lane browser smoke script described by this historical phase was retired during public-release cleanup. Current validation results and the polygon browser smoke check are documented in the root README and `docs/PUBLIC_RELEASE_AUDIT.md`.
