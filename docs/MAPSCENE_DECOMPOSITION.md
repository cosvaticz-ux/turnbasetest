# MapScene decomposition review

Base: `bb7689f` on `main`, verified against fetched `origin/main` before editing. No commit was created.

The original scene combined lifecycle/input, player movement and collision, warp and battle transitions, encounter actors, NPC/interactable creation, dialogue, inventory/equipment/shop interfaces, progression/campaign HUDs, environment rendering, culling, autosave hooks and UI cleanup.

The extraction plan prioritized state that could be owned locally without changing frame order or gameplay transitions: environment/culling, shared field menus, dialogue, encounter actors, and player/camera presentation. Each system is a plain factory with explicit dependencies. Live getters resolve the current scene DOM/state; callbacks preserve scene-level ordering. There are no imports back into MapScene and no new framework or shared mutable state container.

| Added file under `src/scenes/map/` | Responsibility moved |
| --- | --- |
| `MapEnvironment.js` | Ground, vegetation, forest and town props; debug grid/blockout; dormant editor-layout presentation; pooled culling and its cache/reset |
| `MapFieldMenu.js` | Inventory categories/targets/item use, equipment transfer and stats presentation, shop purchases, shared item icons, progression display and selection state |
| `MapDialogue.js` | Lines, portraits, choices, completion callbacks, skip/advance and dialogue reset |
| `MapEncounterActors.js` | Existing encounter definitions unchanged, visibility, chase/home positions, actor DOM, animations and stabilization caches |
| `MapPlayerPresentation.js` | Player sprite animation, world/coordinate presentation, camera calculation through the existing core system, and presentation cache reset |
| `mapGeometry.js` | Existing grid/world conversion, cull-bound encoding/decoding and clamp helpers shared by scene systems |

Modified production file: `src/scenes/MapScene.js`. It now wires systems and retains lifecycle/listener registration, input priority, frame ordering, authoritative position/movement/collision, warp guards and transitions, encounter triggering/battle handoff, world interaction dispatch, campaign HUD, autosave order and overall cleanup. NPC/interactable DOM and transition overlays remain with those flows for this pass.

Modified test: `tests/map-scene-nodes.test.mjs`, adapting source-location assertions for the extracted renderer and asserting the scene API and obstacle-array identity. Added `tests/map-scene-systems.test.mjs` to exercise modal guards, healing, equipment transfer, shop save counts, live session replacement, dialogue reset/completion/attack ordering, pursuit suspension and actor reset.

Coupling preserved for review:

- `OBSTACLES` is a public mutable array. Environment rebuilding still mutates it in place; collision and exports keep the same object.
- Dialogue must close before starting a battle or running its completion callback. Lifecycle reset discards callbacks without completing them. Input priority remains in the scene.
- Defeated encounters belong to the scene/session, while chase runtime belongs to the actor system. Entry resets runtime; battle return retains the original defeat-history rules.
- Sprite-profile and dormant layout promises consult live lifecycle/map state. Their original guards and cache lifetimes remain unchanged; this pass does not redesign asynchronous cancellation.
- Field-item effect timers retain their original delayed DOM cleanup. Scene listener identities and removal order remain unchanged.
- Equipment and inventory share ownership/transfer rules through PartyManager and StatResolver. Purchases and field use invoke the same autosave hook at the same points.
- Warp fade/load/fade-in sequencing and campaign arrival/autosave ordering remain together in MapScene.

Validation: all 21 original test files passed before editing. The five requested groups (exploration integration, map scene nodes, viewport culling, campaign vertical slice and demo runtime) passed after each of the five extraction steps. The final full suite passes 22/22 files, including the new behavioral tests. `git diff --check` passes. These are Node/mock-DOM regressions; no manual browser playthrough was performed.

MapScene decreased from 3,273 to 1,297 lines (about 60%). The refactor adds six production modules, one test and this review note; it modifies MapScene and its existing node test. Gameplay values, map schemas/data, assets, CSS and public scene exports are unchanged. The two banner PNG modifications visible in git status predate this task and were left untouched.
