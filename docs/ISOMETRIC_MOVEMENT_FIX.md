# Isometric movement and camera fix

System-only follow-up, completed 2026-09-13. Base Git commit: `8584000`. Changes remain uncommitted; no PR was created. The working tree already contained the earlier isometric renderer migration.

## Root cause of awkward movement

The renderer projected positions, but MapScene still interpreted keyboard axes as world axes. Up changed only world Y, so it appeared to move northeast. Right changed only world X, so it appeared to move southeast. Existing diagonal normalization applied before projection and did not account for the 2:1 projection's unequal horizontal/vertical scale.

Simply remapping Up to world (-1,-1) and normalizing its world length is insufficient: for the current projection, a normalized horizontal-screen direction projects to twice the speed of a normalized vertical-screen direction. The new mapping compensates for that projection gain, preserving equal visible speed in all eight directions.

Facing also used the old axis interpretation, and repeated keydown events could change diagonal-facing priority. A separate camera-adjacent bug passed a ResizeEvent into animation time while moving, potentially producing NaN frame numbers. The actual camera already followed the current projected position with no interpolation or stacked smoothing; it did not require a replacement.

## Files modified or created by this follow-up

- `src/core/IsometricMovement.js` (new): combined screen input, normalized world velocity, visual facing, bounded world collision steps.
- `src/core/IsometricProjection.js`: origin-independent vector projection/inverse helpers.
- `src/scenes/MapScene.js`: screen-relative input integration, repeat-stable facing, world-space collision substeps, facing from actual motion when sliding.
- `src/scenes/map/MapPlayerPresentation.js`: correct screen-facing metadata and safe resize-event handling.
- `tests/isometric-movement.test.mjs` (new): focused movement, collision, camera, resize and save tests.
- `tests/map-scene-nodes.test.mjs`: additional real-scene regressions for all eight directions on four maps, collision categories, repeat/release behavior and the production save action.
- `tests/isometric-browser.js`: repeatable held-key browser checks, frame measurements and corrected save-flow verification.
- `docs/ISOMETRIC_MOVEMENT_FIX.md` (new): this report.
- `docs/ISOMETRIC_MIGRATION.md`: notice linking to the updated controls.

Other dirty renderer/style/map-data/preloader files belong to the earlier migration and were not changed by this follow-up. No asset path/reference changes were required.

## Input mapping before and after

| Input | Before: world direction | Before: visual direction | After: visual direction |
| --- | --- | --- | --- |
| Up / W | (0,-1) | NE | Up |
| Down / S | (0,+1) | SW | Down |
| Left / A | (-1,0) | NW | Left |
| Right / D | (+1,0) | SE | Right |

The combined screen input is normalized first, then inverse-projected as a vector without origin or camera translation. Cardinal world direction signs are Up (-,-), Down (+,+), Left (-,+), Right (+,-). Opposing keys cancel; WASD/arrow aliases do not accumulate extra speed. Two-key input produces the intended 45-degree screen diagonal.

Only world positions are updated. The player is never moved by changing projected coordinates directly.

## Movement normalization

The inverse-projected world vector is normalized. Its projected length is then measured, and the world velocity magnitude is scaled by `speed / projectedLength`. This corrects isometric foreshortening while preserving normalized input. At the current dimensions, speed remains numerically 235 and means projected map pixels/second before camera zoom.

At default dimensions, resulting cardinal world velocities are:

- Up: (-235,-235)
- Down: (+235,+235)
- Left: (-117.5,+117.5)
- Right: (+117.5,-117.5)

Each projects to exactly 235 map pixels/second. World-distance speeds intentionally differ by direction because constant world distance and constant visible distance cannot both hold under an anisotropic 2:1 projection. Multi-key input has the same visible speed, with no acceleration or diagonal boost. Existing simulation delta capping remains in place for long stalls.

## Collision changes

All collision predicates remain unchanged and operate on logical world pixels. Existing obstacles, buildings, trees' blocked terrain, map edges and fixed encounter blockers still participate in the same checks. Gates marked nonblocking remain passable.

X-then-Y resolution now subdivides displacement into steps no larger than the smaller player collision radius (7 world pixels). This prevents larger remapped steps from skipping thin barriers and preserves sliding along an unblocked axis. Facing follows the dominant direction of the actual projected displacement when sliding. A completely blocked input still turns toward the intended direction.

No collision data, obstacle position, NPC radius, encounter position or map layout was edited.

## Camera changes

The projected target, projected map extent clamp, render origin and immediate tracking remain intact. No camera smoothing was added. No player interpolation or projection interpolation was added. The 3456 × 2048 render bounds, including existing sprite margins, remain separate from the 1536 × 1280 logical world.

MapPlayerPresentation now treats a nonnumeric update argument (such as a ResizeEvent) as zero animation elapsed time. This fixes invalid animation timing during a moving resize without delaying movement or camera response. HUD/dialogue/menu transforms and depth ordering were not changed.

## Facing mapping

Screen up/down/left/right select the existing north/south/west/east sprite sets. East still uses the existing mirrored west frames. Diagonals choose the dominant visual axis; exact ties use the most recently pressed valid component, with a stable fallback. Repeated keydown does not take priority from another held key. Released/opposed keys cannot win facing ties. Idle retains the last facing. No sprite files or transforms were changed.

## Automated test results

`node --test tests/*.test.mjs`: **33 test files passed, zero failed**.

Focused coverage includes all eight directions with different projection dimensions/origins; unit input length; equal projected speeds; opposing/alias keys; dominant/tied facing; thin-wall tunneling prevention; sliding; logical map bounds; 30/60/120 FPS travel equivalence; projected camera bounds at map corners and several viewport sizes; resize events during animation; SaveManager serialization; actual MapScene movement on all four maps; forest/building/wall/fixed-enemy collision; passable gates; repeat/release handling; and saving/reloading a moved world position through the game's Escape handler.

The broader existing battle, encounter, quest, preloader and save regressions also passed. Node mock-image preload warnings are expected fixture output. `git diff --check` passed.

## Browser test results

The browser harness uses the actual MapScene key handlers, scene update loop, projection and camera. Each trial holds real keyboard events for at least 0.4 seconds of simulated movement and samples rendered positions each animation frame. Checks cover Up, Down, Left, Right, Up+Left, Up+Right, Down+Left, Down+Right on Front Forest, Forest, Town Part 1 and Town Part 2.

**32/32 trials passed.** Measured speeds were 234.984–235.007 projected map pixels/second; the target is 235. Maximum per-frame position discrepancy was 0.009481 map pixels; maximum screen-focus error was 0.029305 pixels. Every release had zero additional displacement. Small differences reflect CSSOM/layout position precision. The harness allows 0.05 map pixels/second speed tolerance rather than demanding more precision than CSS serialization provides.

Additional observed checks:

- Forest boundary: holding Left from (333,700) held X at 333 and slid Y along the boundary; the player did not enter blocked terrain.
- Front Forest exit: holding Up from (768,65) transitioned to Town Part 1 at (768,1056).
- Interaction: Space at Townswoman opened and closed the existing dialogue.
- Moving resize: a 480 × 800 viewport retained valid walk frame 3 and then idle frame 1; player focus was approximately (240,399.99). The viewport override was reset.
- Save/load: in a fresh browser tab, walking from (704,864) reached (465.7805000000006,625.7805000000005). The production Escape save action followed by load/continue restored exactly those world coordinates, matching the saved state. An earlier interrupted browser session showed a different map on reload; this was not reproduced in the fresh session, and the automated production-handler save regression passes.
- Encounter entry: the existing Front Forest fixture at (1024,992) displayed ENCOUNTER and transitioned to the battle scene at PREPARE TURN with Highwaymen. Battle code was not modified.
- Final automated rerun on 2026-09-13: all 33 test files passed, with zero failures.

The historical raw movement capture was removed during public-release cleanup. No screenshot/PNG files were created for this task.

## Known limitations

The existing four-direction animation art approximates diagonals. At a collision surface, axis-separated sliding can change the actual travel direction and speed, as expected when part of the desired movement is blocked. Camera corners may show the pre-existing area outside the map diamond; the camera does not apply polygon-shaped viewport clipping. Movement during severe frame stalls remains subject to the existing 40 ms simulation cap.

The smoke tests cover selected routes and collision fixtures, not every quest, doorway or battle outcome. No art, map dressing, battle, encounter tuning, VFX or SFX work was performed.

## Scope confirmation

**NO NEW ASSETS CREATED**  
**NO EXISTING ASSETS MODIFIED**  
**NO BATTLE SYSTEM CHANGES**
