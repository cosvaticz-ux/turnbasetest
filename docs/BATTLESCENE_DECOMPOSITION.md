# BattleScene decomposition review

Base: `57bca95` on `main`, verified against freshly fetched `origin/main`. The workspace was clean and the committed MapScene decomposition was present. No commit was created.

BattleScene decreased from **3,457 to 1,984 lines (42.6%)**. The extraction keeps scene state and gameplay managers in place and moves presentation into five plain ES-module factories with explicit dependencies. No module imports BattleScene back, binds global input, or introduces a second gameplay state store.

## Files and ownership

| Added production file under `src/scenes/battle/` | Ownership |
| --- | --- |
| `BattleActorPresentation.js` | Actor/formation DOM, sprite asset lookup, existing PartyHUD/EnemyHUD construction, HP/AP/status refresh, target highlights, action-menu and enemy-HUD anchoring, bounded camera-follow frames |
| `BattleCommandPresentation.js` | Command DOM, category/row selection, selected-action styling, tab animation; eligibility and execution are supplied by the scene |
| `BattleAnimationDirector.js` | Player idle/attack/guard/cast sequences, enemy idle/attack/hit/death sequences, sprite clocks, animation locks, stabilization caches and persistent corpse presentation |
| `BattleEffectPresentation.js` | Existing shared visual timeout registry, turn/result announcements, damage/healing numbers, skill flashes, screen shake, temporary effect DOM and cancellation |
| `BattleSummaryPresentation.js` | Reward-summary DOM and meter animations from already-resolved rewards, using the scene's existing post-battle scheduler |

Other added files:

- `tests/battle-presentation-lifecycle.test.mjs`: controlled-clock lifecycle and presentation regression coverage.
- `docs/BATTLESCENE_DECOMPOSITION.md`: this review note.

Modified files:

- `src/scenes/BattleScene.js`: constructs systems and delegates presentation through existing public methods.
- `tests/ui-layout.test.mjs`: reads the relocated actor/effect implementation for the existing source-location assertions. Assertions were retained.
- `tests/battle-state.test.mjs`: its mock element now implements DOM `remove()`, so synchronous cancellation cleanup can be exercised. Existing gameplay assertions were retained.

The diff therefore contains **five new production modules, one new test, one review note, and three modified files**. No assets, CSS, map data, battle data or core-manager files changed.

## Retained orchestration and authority

BattleScene retains lifecycle, DOM lookup, system wiring, authoritative input ordering, command definitions/eligibility, battle-state initialization/synchronization, action and enemy-turn sequencing, Prepare gating, target selection, AP spending, calls into combat/status/down-state systems, progression/mastery hooks, battle result decisions, post-battle scheduling, saves and summary/map handoff. Its public exports and the Game method surface are preserved; HUD methods delegate to presentation while keeping their public entry points.

The existing BattleFlowManager, BattleManager, TurnManager, CombatResolver, PreparePhaseManager, StatusEffectManager, TargetManager, DownStateManager, TechniqueResolver and MasteryManager remain authoritative where previously used. BattleFormation and BattleCamera are reused. Party/stat and save/progression authority remains in its existing layers; it was not relocated into these presentation modules.

The highest remaining coupling is intentional:

- Impact/completion callbacks bridge animation timing to scene-owned damage and action resolution. The director never calculates damage or spends AP.
- Command definitions combine current phase, actor, technique and item availability. They remain beside the scene's input gates.
- Multi-hit skills wait for both the attack and enemy reaction/corpse presentation before continuing or declaring victory.
- Game's battle/post-battle queues preserve battle-token checks and remain separate from visual-only timeouts.
- Reward application, persistent party/item synchronization and map-return context remain together in the scene.

## Timer and cleanup review

The original implementation had several lifecycle gaps: HUD-follow frames and the resize listener were not explicitly cancelled/detached on exit; combat effect callbacks could outlive terminal entry; finishing an animation from inside its own impact callback could schedule new work after cancellation; early summary completion could leave meter tasks pending during an asynchronous handoff.

The pass adds narrow cleanup protections without changing animation duration values or normal action ordering:

- Cancel previous HUD-follow work on start, terminal entry and exit. The intentional result-camera reset still starts its normal bounded HUD tracking while the scene is visible; exit cannot restart tracking.
- Detach keyboard, resize and scene-control listeners on exit and reattach without duplicates on entry. Presentation modules do not register global listeners.
- Preserve the existing sprite interval/per-enemy timer ownership and stopping methods. Add a player animation generation guard so reentrant impact cancellation cannot resurrect an interval or completion timer.
- Guard asynchronous sprite-profile DOM updates against retired lifecycle generations and terminal state.
- Cancel old combat visual timeouts and Web Animations at terminal entry/exit, remove temporary number nodes and clear transient effect classes synchronously. Intentional result announcements and summary work are newly scheduled in their existing order.
- Cancel remaining summary tasks before early summary handoff. Normal result, summary and return-to-map timing values remain unchanged.

## Validation

All **22 original test files** passed before editing and after every extraction (actor/HUD, commands, animation, effects, summary, final HUD refresh delegation). The final full suite passes **23/23 files**, including:

- battle-state, prepare-phase, enemy-targeting, formation-core, combat-rng and ui-layout;
- vertical-slice-state, campaign-vertical-slice and demo-runtime;
- the new lifecycle test, which checks the exported API, exit during intro/action, victory/defeat locks, bounded result-camera tracking, listener re-entry, early summary cancellation and map-return context;
- exact player and variable enemy frame/impact/completion timings, reentrant impact cancellation, corpse hold/persistence/cancellation, temporary-number cleanup, screen-shake cancellation and no delayed DOM mutations after exit.

`git diff --check` passes. Validation is Node/mock-DOM based; no manual browser playthrough was performed. Changes are uncommitted and ready for review.
