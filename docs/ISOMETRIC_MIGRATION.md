# Isometric exploration migration

> Follow-up: screen-relative controls and movement normalization now supersede the original controls described below. See [Isometric movement and camera fix](ISOMETRIC_MOVEMENT_FIX.md).

Implementation date: 2026-09-09. Working tree based on commit `8584000`; changes are not committed or published as a PR.

## Architecture before

The actual playable renderer is `src/scenes/MapScene.js`, not MapBlockoutScene or MapEditorScene. It delegates player/camera presentation to MapPlayerPresentation, environment creation/culling to MapEnvironment, and encounter animation/chase simulation to MapEncounterActors. All maps share a 24 × 20 grid with 64-pixel logical cells (1536 × 1280 world pixels). Orthogonal DOM positions previously doubled as visual positions.

Map geometry comes from frontForest.js, deepForest.js, townSouth.js, townNorth.js and the registry; worldContent.js supplies NPCs, interactives, and encounter zones. MapNodeManager owns spawns, warp destinations and arrival guards. MapScene owns free movement, obstacle collision, interaction distance, timed encounter-zone checks and battle handoff. EncounterActors owns world-space pursuit. SaveManager normalizes GameState; MapScene persists mapPosition. AssetPreloader and assetPreloadGroups partition common, map, battle and audio dependencies.

The baseline enabled ground patches but disabled trees, forest masses, and town props. Editor JSON rendering functions existed but were not activated by the playable scene.

## Architecture after

A focused IsometricProjection module owns projection/inverse math, configurable dimensions, elevation, map origin/bounds, depth keys and viewport hit-test conversion. IsometricRenderer adapts the existing pixel/grid fields to upright foot-anchored objects, projected flat surfaces, dedicated diamond tiles and short axis-aligned barrier segments.

MapScene, MapPlayerPresentation, MapEnvironment and MapEncounterActors share this renderer. The original simulation remains authoritative. Trees and buildings are enabled; tree roots are seated within existing blocked zones, and building bases are derived from authoritative building footprints. No gameplay map coordinates or collision rectangles were rewritten.

The world container only translates/scales for the camera. Flat terrain textures receive an individual affine surface transform. Characters and building images remain upright; HUD, dialogue, menus, and battle scenes are outside projection.

## Files created

- `src/core/IsometricProjection.js`: reusable projection, inverse, camera hit testing, bounds and facing compatibility.
- `src/scenes/map/IsometricRenderer.js`: common object/surface/tile placement, bounds and barrier rendering.
- `tests/isometric-projection.test.mjs`: mathematical, adapter and legacy-coordinate regressions.
- `tests/isometric-browser.html`, `tests/isometric-browser-loader.js`, `tests/isometric-browser.js`: repeatable browser harness using the actual page markup, scenes and movement handlers; isolated `isometric-smoke` save namespace.
- `scripts/preview-isometric.mjs`: dependency-free localhost preview server.
- `docs/ISOMETRIC_MIGRATION.md`: this report.

## Files modified

- `src/scenes/MapScene.js`: NPC/interactable placement and visual world size.
- `src/scenes/map/MapPlayerPresentation.js`: projected player/camera, diagonal-facing metadata and debug coordinates.
- `src/scenes/map/MapEncounterActors.js`: projected enemy placement, keeping simulation positions intact.
- `src/scenes/map/MapEnvironment.js`: surface/object projection, projected culling, occlusion fade, debug zones, scene cleanup.
- `src/data/maps/mapDressing.js`: activate scenery and derive visual anchors from existing geometry.
- `src/data/assetPreloadGroups.js`: preload active scenery in its own map group.
- `style.css`: shared depth context, projected ground/debug layers and temporary barrier/mass styling.
- `tests/asset-preloader.test.mjs`, `tests/map-dressing.test.mjs`: replace obsolete dormant-art expectations.
- `tests/map-scene-nodes.test.mjs`: update active-art expectations and add real-scene save, return, NPC and cleanup checks.
- `README.md`: current rendering description and test/report links.

## Isometric formula and coordinate models

Default tile width = 128, tile height = 64, cell size = 64, elevation height = 32.

For logical pixel coordinates x/y, tile coordinates u=x/64 and v=y/64:

```
screenX = originX + (u - v) * tileWidth / 2
screenY = originY + (u + v) * tileHeight / 2 - elevation * elevationHeight
```

The inverse removes origin/elevation, divides by each half-tile dimension, then recovers u/v from the sum/difference. `viewportToWorld` first removes camera zoom/translation. `tileToScreen` projects tile vertices; `getTileCenter` projects centers. `placeDiamondTile` accepts future dedicated artwork without skewing it.

The current maps project to a 2816 × 1408 diamond. A centralized 320-pixel sprite margin produces a 3456 × 2048 visual container, with origin (1600, 320). Logical world bounds remain 1536 × 1280. Camera clamp uses visual bounds; collision uses logical bounds.

Map groups and NPC content retain grid coordinates; player state, encounters, saved positions and editor JSON retain legacy logical pixel coordinates. Adapter multiplication by the existing cell size is explicit. No projected value is saved. No save-schema bump or migration was needed.

## Depth, anchors and occlusion

Depth is `1000 + round((worldX + worldY + depthOffset) * 10)`. Equal keys retain stable DOM order. Player, NPC, enemy, tree and building layers share the same stacking context. Buildings use bottom-center footprint anchors; character feet remain their anchor. Barrier sections sort individually along either world axis. Elevation changes projected height and optional depthOffset remains available.

Foreground trees/buildings whose cached bounds cover the player's upper body fade to 42% opacity. This is a conservative rectangular test, not a per-pixel alpha test. Broad building bounds prevent the gate from disappearing early or completely hiding the player. Small barriers retain normal occlusion.

## Player movement, collision and interactions

Existing free movement and diagonal normalization are retained. Up/W decreases world Y (screen NE), Right/D increases world X (SE), Down/S increases world Y (SW), Left/A decreases world X (NW). The existing cardinal sprite sets approximate these directions; east continues to mirror the existing west art. Facing never depends on camera position.

Obstacle collision, stationary encounter blocking, interaction radii, timed encounter-zone detection, fixed encounter triggers, chase/leash logic, exits, story/quest hooks and battle transitions retain their world-space implementations. New scenery does not add or remove collision. Some existing decorative markers still use their existing placeholder visuals.

## Camera and debug tools

The original camera helper receives projected player coordinates and projected map extents. It retains deterministic tracking and zoom/clamping, with no added smoothing lag. Resizing recomputes camera presentation. Diamond corners can show the dark area outside the logical map.

F2 shows projected authoritative footprints, encounter-zone boundaries, world/screen coordinates, depth and object outlines. G toggles the projected grid independently. F3 retains the existing debug warp behavior. Debug controls are off during normal exploration. All HUD and dialogue remain screen-aligned.

## Maps migrated

Front Forest, Forest (`deep-forest`), Town Part 1 (`town-south`) and Town Part 2 (`town-north`) share the same renderer and were rendered in the browser. Other campaign/local nodes also inherit projection through MapScene but were not individually visually audited. MapBlockoutScene and MapEditorScene remain orthogonal authoring tools; dormant exported editor layouts were not activated.

## Performance and preloading

No dependency, engine, raster asset, atlas, or framework was introduced. Tree DOM nodes remain lazily created when visible and pooled thereafter; camera culling uses cached projected bounds and existing quantization/padding. Static surfaces and small barrier segments are built on map load. Walking does not reconstruct the map DOM. Occlusion uses cached metadata and writes opacity only when it changes. Scene exit clears rendered layers and the vegetation pool.

Only eight Front Forest and nine Forest tree definitions are used. Active town/tree artwork is added to its matching preload group. Battle preload groups retain their existing lifecycle. No quantitative frame-time comparison was performed; browser visibility checks and regression tests are not a performance benchmark.

## Automated test results

Command: `node --test tests/*.test.mjs` — 32 test files passed, zero failures.

New coverage checks known projection points, fractional/negative round trips, determinism, tile centers, configurable units, elevation, depth order/ties, render origins, map extents, dedicated diamond placement, large-object bounds, camera following at multiple viewport sizes, viewport inverse conversion, projected vegetation culling, warp coordinates and legacy normalization. Actual-scene tests check saved world coordinates, restored battle positions, NPC placement across maps and layer cleanup.

Existing suites cover movement/modal guards, collision/warp topology, encounter/pursuit systems, save compatibility, quest/shop behavior, battle state and presentation lifecycles. Mock-image preloader warnings in Node are expected in the existing test harness; they are not browser asset-failure evidence. `git diff --check` passes.

## Browser smoke test results

Testing used the actual game page plus the separate reproducible harness. Harness buttons dispatch real movement key events, invoke actual scene lifecycle methods, and expose map/position status.

| Check | Observed result |
| --- | --- |
| Front Forest boot | Entered from New Game; upright player, angled terrain and trees rendered. |
| Movement/camera | W changed world Y while X stayed 704; camera followed. Hidden-browser frame throttling limits timing measurements. |
| Collision | From (333,700), west input remained at X=333 against the blocked forest edge. |
| Physical exit | From (768,65), north input entered Town Part 1 at (768,1056). |
| NPC interaction | Space near Townswoman opened the existing dialogue and a second Space closed it. |
| Encounter/battle entry | Front Forest encounter entered the existing PREPARE TURN; Begin Battle reached PLAYER TURN — LUKE. |
| Battle return | Harness invoked the actual return lifecycle with (704,864); correct projected location and saved logical values were restored. A full battle victory was not played through. |
| Save/load | Harness saved and reloaded via SaveManager/GameManager; world (704,864) remained unchanged. This is not a real user's historical save fixture. |
| Forest and towns | All four maps rendered; screenshots captured. Scene tests also verify map-change cleanup and NPC projection. |
| Occlusion | Forest foreground tree faded; Town Part 1 gate opacity was 0.42 and player remained visible. |
| Resize | At 480 × 800, player foot remained at screen (240,400); viewport override was reset afterward. |

Random encounter probability, every shop/quest interaction, all map exits, every occlusion crossing and a complete victory-return cycle were not manually exercised. Existing relevant automated regressions passed; these unplayed paths are not claimed as browser-verified.

## Known limitations and next art requirements

Ground uses existing textures projected per flat surface; it is a renderer migration with temporary artwork, not a finished isometric art pass. Grass/dirt/stone routes are active. The generic surface/tile APIs accept mud/wood or other materials once supplied by map data/art. No new mud/wood assets were authored.

Walls/fences/fallen-log blockers use simple projected vertical strips. Dedicated axis-A/axis-B wall faces, gate pieces, fence/log sprites, properly oriented building sprites, road junctions and diagonal character animation sets remain desirable. Placeholder interactables, signs and landmarks retain existing representations. Large building sorting is a bottom-footprint approximation; splitting multi-part buildings would improve complex overlap. Foreground fading is conservative. Elevation has projection support but no terrain-height gameplay was introduced.

## Reproduce

Historical isometric browser harnesses have been retired. For the current game, run `node scripts/preview-exploration.mjs` and open `http://localhost:8080/`. Run the current checks with `node scripts/run-checks.mjs`.
