# Litania X — Repository Audit

Audit date: 2026-08-31

## Baseline

The repository is a framework-free browser game with ES modules, a scene manager, a
data-oriented battle core, four connected exploration nodes, a central asset resolver,
staged asset preloading, audio routing, and Node-based regression tests.

The existing flow already supports Title → Front Forest → fixed Highwayman encounter →
Battle → victory summary/defeat → return to the originating map. Movement, normalized
diagonals, collision, reciprocal-warp guarding, battle target selection, AP restoration,
critical/fatal hits, guard, skills, poison, terminal-state input locking, and battle
camera reset are implemented.

## Gaps against the vertical-slice blueprint

- Save data had no schema version, validation, migration, or complete slice state.
- Continue loaded global state but exploration did not consume the saved map position.
- Settings was a placeholder and audio/effect preferences were not persisted.
- Exploration content had no reusable NPC, dialogue, shop, quest, interaction prompt,
  encounter-zone, or vertical-slice completion implementation.
- Fixed encounter completion lived only in module memory and was not persisted.
- Map definitions retained blockout geometry but lacked environment/content metadata.
- Battle had skills and status effects, but shipped with no consumable item and no
  prepare-turn phase.
- Exploration presentation intentionally rendered a grass-only reset despite available
  environment assets and CSS atmosphere support.
- Documentation still described the maps and settings as placeholders.

## Regression baseline

The initial suite contained 13 test files: 11 passed and 2 failed.

1. `MapViewportCulling` used a `2.3` default zoom while the tests and UI contract expected
   `1.35`.
2. `MapScene` cleanup called `style.removeProperty` unconditionally, which failed in the
   repository's minimal DOM harness.

Both baseline regressions are corrected before feature implementation.

## Implementation order

1. Versioned global state, save validation, persistent settings, and lifecycle safety.
2. Data-driven map environment/content metadata plus reusable dialogue, quest, shop,
   interaction, and encounter-zone foundations.
3. Persisted fixed encounters, autosave, Continue restoration, and end-to-end town flow.
4. Prepare turn, a consumable, battle persistence hooks, and battle-summary content.
5. Responsive UI/environment polish, updated flow/schema documentation, automated tests,
   and browser console/scene-transition QA.

## 2026-09-15: Polygon greybox exploration

Playable MapScene now uses connected walkable polygons with continuous eight-direction screen-relative movement, visible-boundary collision, fixed elevated 3/4 cameras, foot-anchored characters, and data-defined transition triggers on all four exploration maps. The temporary renderer intentionally displays only black void, purple ground, red grid/boundaries, raised blue structural/transition geometry, and gameplay-required units. Existing battle, encounter, interaction, audio, progression, and save handoffs remain active. See [GREYBOX_EXPLORATION.md](docs/GREYBOX_EXPLORATION.md).

## 2026-09-14: Lane exploration replacement (superseded)

Playable MapScene now uses the four-map continuous lane prototype, replacing the grid/isometric and experimental Three.js actor runtime. See [LANE_EXPLORATION.md](docs/LANE_EXPLORATION.md) for controls, data, temporary visuals and validation. Save schema is 8. Existing Battle Scene behavior remains intact.
