# Multi-lane exploration prototype

Playable exploration now uses continuous `{ mapId, laneId, x }` coordinates. New Game starts in Front Forest on the middle lane. Save schema 8 preserves party, inventory, story and encounter completion. Older coordinates retain a recognized map and receive a safe middle-lane spawn; old Y/grid coordinates are discarded.

## Controls

- A/D or Left/Right: walk horizontally at 235 world units/second.
- W/Up and S/Down: intentionally activate an available upper/lower path connector.
- E, Space or Enter: interact (or activate a connector without an up/down direction).
- B: existing unified inventory/equipment menu. K: skills. Escape closes dialogue/menu.
- L: lane debug overlay, initially off. Far orange, middle red, near green, connectors purple, exits blue; additional lanes get automatic colors.

## Playable maps

| ID | Map | Features |
| --- | --- | --- |
| `front-forest` | Front Forest | Three lanes, tutorial sign, fixed highwayman, chest, explicit near-lane encounter zone, left shortcut to town and right exit to forest. |
| `deep-forest` | Deep Forest | Three lanes, paired connectors forming two loops, static and patrolling enemies, shrine, main town exit and far-lane branch to Town Part 2. |
| `town-south` | Town Part 1 / South District | Three street depths, resident, Iven's shop, door, forest and Town Part 2 exits. |
| `town-north` | Town Part 2 | Three lanes with multiple loops, resident and town hall, return to Town Part 1 and far-lane forest branch. |

## Data and modules

`src/data/explorationMaps.js` owns map width, background layers, arbitrary lane arrays, connectors, exits, interactables, enemies and encounter zones. No renderer-specific map ID cases determine movement.

A lane has `id`, `xMin`, `xMax`, `baselineY`, `depth`, optional `actorScale`, `cameraZoom`, and `cameraYOffset`. X is continuous and clamped to its lane; render Y derives exclusively from the lane or its transition tween.

A connector has `fromLane`, `toLane`, an inclusive `xMin/xMax` activation zone, `targetX`, `direction`, and optional `instant`. Each authored reverse connector is explicit. Standard transitions last 650 ms, lock horizontal movement, and blend position, scale and camera framing. Connectors have no normal geometry display, only proximity prompts.

An exit has `laneId`, an inclusive `xMin/xMax` zone, `targetMap`, `targetLane`, and `targetX`. Entering the zone fades out, preloads the destination, loads its lane position and fades in. Arrival positions lie outside exit zones to prevent bounce loops. The graph is arbitrary, including different destinations from different lanes on the same side.

- `LanePlayerController.js`: movement, lane bounds, connector activation and transition pose.
- `LaneCameraController.js`: horizontal dead-zone framing, exponential camera smoothing and lane zoom.
- `LaneMapRenderer.js`: existing Luke walk frames, animated placeholder Lucy follower, scenery and enemy presentation.
- `LaneEncounterController.js`: lane-specific static/patrol collision, return cooldown, distance-based rolls restricted to explicit zones.
- `LaneDebugOverlay.js`: purely visual lane/connector/exit overlay.
- `LaneMapUI.js`: extracted bindings for existing dialogue, inventory, equipment, shop and skill menus.
- `MapScene.js`: input, scene lifecycle, map fades, persistence and existing Battle Scene handoff.

Fixed enemy IDs are stable across map reloads and recorded after victory. Escape retains the enemy and grants a three-second return cooldown. Random encounters use a distinct battle instance ID so repeat victories receive rewards under the existing reward deduplication rules. Battle handoff retains the existing `mapReturnNodeId` API name for the battle background selector, but its position payload is the new lane state. Battle actions, spritesheets, VFX, Prepare Turn and animation director are unchanged.

Interactables use lane and horizontal distance. Dialogue IDs reuse the existing dialogue engine; an optional `rewards` object and `onceFlag` provide persistent one-time rewards through the existing RewardResolver. Lucy's existing party identity is `dummy`; both `dummy` and `lucy` are recognized by follower presentation, without changing party saves.

## Removed systems and retained tooling

Removed the old MapScene movement implementation, IsometricMovement, IsometricProjection, IsometricRenderer, mapGeometry, MapViewportCulling, MapEnvironment, MapPlayerPresentation, MapEncounterActors, Map3DActorRenderer, and overworld3DCharacters configuration. Removed their obsolete tests, playable grid/player DOM, Three.js import map, and isometric rendering overrides. Replaced map asset preload definitions with lane scenery.

Existing map editor/blockout scenes, their layout data, and reusable art catalogs remain development tools. They are not used as a movement compatibility layer. The local preview script is now `scripts/preview-exploration.mjs`.

## Temporary visuals

No new art was generated. Forest and town reuse existing battle backgrounds with overscan, existing tree/grass/building/barrel sprites, and simple text markers for doors, chests and landmarks. The background/scenery composition is temporary rather than final authored panoramic art. Lucy uses the existing animated 2D humanoid placeholder because there is no dedicated Lucy overworld walking set. Layers use horizontal parallax and foreground occlusion; none uses real 3D.

## Verification

Run `node --test tests/*.test.mjs`: 30 test files pass. New lane tests cover 30/60/144 Hz motion, bounds, transitions, camera interpolation, lane-only collision, patrol, explicit encounter zones, all connector/exit destinations, safe arrivals, graph reachability, existing art paths and save migration. Existing battle, VFX, skills, inventory, audio and state tests also pass.

The old lane-specific browser script has been retired because its position and topology assertions predate the current polygon maps. See the root README for the current preview and browser smoke check commands.

The content-database test's pre-existing 36-frame Luke idle assertion was corrected to the branch's existing 28-frame configuration; no battle assets or definitions changed. The title test's mock timer IDs now remain stable as queued timers are removed, so preload changes cannot accidentally cancel an unrelated timer.
