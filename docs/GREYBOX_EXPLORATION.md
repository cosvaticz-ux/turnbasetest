# Exploration greybox

The active `MapScene` uses a reusable, data-driven polygon traversal system across Front Forest, Forest (`deep-forest`), Town Part 1 (`town-south`), and Town Part 2 (`town-north`). This replaces the playable lane presentation; the older lane report is retained only as historical context.

## Presentation

- Black is non-walkable space.
- Purple polygons are the authoritative walkable surface.
- Red lines show the projected debug grid and polygon/wire boundaries.
- Blue areas and raised prisms identify transitions and temporary structure.
- Existing player, party, NPC, and enemy units remain upright and are positioned from their feet.

`EXPLORATION_DEBUG_GEOMETRY` in `src/data/explorationMaps.js` controls the default presentation. F2, G, or L toggles it at runtime. No environment background, terrain, tree, building, shop, prop, weather, or lighting artwork is loaded by the exploration map groups.

## Runtime architecture

- `src/data/explorationMaps.js` owns walkable polygons, spawn points, fixed camera configuration, exits, debug structure, interactions, encounter zones, and enemy positions.
- `src/core/WalkableGeometry.js` owns polygon containment, region checks, nearest-boundary constraints, and collision sliding.
- `src/core/ExplorationProjection.js` owns ground projection, inverse vector projection, normalized screen-relative input, and projected bounds.
- `src/scenes/MapScene.js` preserves UI/modal guards, interactions, transition fades, encounter/battle handoff, audio, and save persistence.
- The map controller, fixed camera, encounter controller, and greybox renderer live under `src/scenes/map/`. Compatibility export names remain temporarily available for older tests/importers, but no lane renderer is active.

Movement is continuous rather than grid-stepped. WASD/arrow input is normalized in screen space, inverse-projected to world space, and subdivided for reliable polygon-boundary collision. The red grid never affects movement.

## Validation

`node --test tests/*.test.mjs` covers all eight directions, diagonal normalization, 30/60/144 Hz travel, polygon containment, black-space rejection, map graph and arrival guards, encounters, save migration, fixed camera fitting, preloading boundaries, and the existing battle/progression/UI systems.

The production page was also checked in-browser for Front Forest movement, diagonal movement, visible-boundary collision, Front Forest → Town Part 1 transition, the debug toggle, fixed framing, raised structure rendering, foot anchoring, and console errors.
