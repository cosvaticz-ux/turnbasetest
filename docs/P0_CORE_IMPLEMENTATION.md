# Litania X P0 Core Implementation

## Scope

This pass strengthens the current Demo vertical slice without adding or restoring campaign chapters. The supported player path remains:

`Title -> Front Forest -> Highwayman battle -> Town Part 1 -> Town Part 2`

The dormant campaign code remains isolated behind `runtimeMode: "campaign"`; none of the P0 systems require campaign flags or chapter prerequisites.

## Runtime architecture

### Authoritative stats

`src/core/StatResolver.js` is the one calculation path for the current P0 stats:

- `maxHp`
- `attack`
- `defense`
- `speed`
- `maxAp`

Resolution order is base stats, equipment, mastery modifiers, passive modifiers, temporary modifiers, and status modifiers. Inputs are not mutated and the returned stat object is frozen. Battle combatants are created from this resolver, and the field equipment screen resolves the same values immediately after an equipment change.

Derived values are runtime data. `SaveManager` removes derived stat fields before serialization; loading reconstructs member state from definitions and equipment.

### Weapons and basic attacks

`src/data/weapons.js` owns weapon records and the unarmed fallback. Each weapon includes:

`id`, `name`, `type`, `hands`, `damageRange`, `attackType`, `element`, `masteryDiscipline`, `accuracyModifier`, `critModifier`, `armorInteraction`, `allowedTechniques`, and `traits`.

The P0 catalog covers unarmed, sword, greatsword, spear, axe, bow, and a dormant firearm definition. `createWeaponAttackProfile()` derives the basic Attack command from the equipped weapon. No equipped weapon means Unarmed; there is no character-ID attack lookup for player combatants.

Damage property resolution considers both element and physical attack type (`slash`, `pierce`, `blunt`, or `projectile`). Piercing weapons also expose the first armor-interaction hook by applying half defense. Accuracy metadata is present for later hit-chance work without introducing a new miss mechanic in this pass.

To add a weapon:

1. Add one immutable record to `WEAPON_DEFINITIONS` in `src/data/weapons.js`.
2. Give it a unique item ID and all schema fields.
3. Add the item ID to inventory or a member's `equipment.weapon` through data/reward flow.
4. Add or update tests for its attack type, ownership, compatibility, and technique permissions.

### Mastery v2

`src/core/MasteryManager.js` exposes:

- `getLevel(memberId, discipline)`
- `getProgress(memberId, discipline)`
- `grant(memberId, discipline, amount)`
- `recordUse(memberId, discipline, options)`
- `canGainFromEncounter(memberId, discipline, encounterId, options)`

The centralized progress thresholds are `0 / 5 / 15 / 30`. Mastery is per-character and per-discipline. A character/discipline pair can gain at most once from a given non-trivial encounter; repeated uses during that encounter are collapsed into one meaningful-use award. Basic attacks use the equipped weapon's discipline, while techniques declare a discipline or use the equipped weapon discipline. Quest/data rewards use the same manager through `RewardResolver`.

Mastery does not grant story Level, and enemies still grant no direct Level EXP.

### Techniques

`src/data/techniques.js` defines techniques. `src/core/TechniqueResolver.js` keeps three concepts separate:

- Unknown: the member has not learned the technique.
- Known: learned, but currently blocked by AP, weapon, mastery, status, or context.
- Available: learned and all current requirements pass.

Battle command rendering uses the resolver at command time, so a known technique stays visible when temporarily unavailable and displays its first blocking reason. AP is the only resource cost in P0.

To add a technique:

1. Add its immutable record to `TECHNIQUE_DEFINITIONS` in `src/data/techniques.js`.
2. Define `apCost`, targeting/effect data, and only the requirements the technique needs.
3. Teach it by adding its ID to a member's `knownTechniques` or by using `PartyManager.learnTechnique()` / a technique reward.
4. Add its ID to compatible weapon `allowedTechniques` when it has weapon requirements.
5. Add resolver and battle-effect tests. Do not gate it on story Level.

### Battle phases and preparation

`src/battle/BattleFlowManager.js` defines explicit phases:

- `PREPARE`
- `PLAYER`
- `ENEMY`
- `PHASE_TRANSITION`
- `VICTORY`
- `DEFEAT`

The battle scene mirrors these phases in `data-battle-phase`. Input is accepted only in the appropriate player/prepare phase and terminal phases cannot transition back into combat. Preparation runs once at encounter start with the current minimum actions: scatter eligible salt, focus for AP, or begin battle. `reopenPreparation({ enabled: true })` is an explicit future hook and is disabled by default.

### Down, revive, retreat, and defeat

`src/core/DownStateManager.js` owns the policy. HP zero remains a valid state.

- First down: increment `downCount`; the battle integration rallies the member at the configured HP ratio.
- Second down: same recovery, with the second count retained for the battle.
- Third down: the member retreats and cannot be revived during that battle.
- Party defeat: occurs when no battle member remains alive.

There is no permanent death. The default revive ratio is 30%. The explicit reset policy is `after-battle`: down counters and retreat flags reset when returning to exploration, while HP zero can remain and be recovered with a revive-capable field medicine.

### Party member and equipment UI

The existing `B` Party Loadout screen is the dedicated party/equipment surface. It is roster-driven and supports one to three active members; additional members are reserves. It shows:

- active/reserve status and a toggle that enforces the 1–3 limit;
- all five equipment slots;
- immediately resolved HP, ATK, DEF, SPD, and AP;
- explicit Equip and Unequip controls;
- `Equipped · Character Name` ownership labels in equipment and inventory views.

Selecting an item only selects it. Equipping is a separate action. `PartyManager` enforces slot compatibility and unique ownership. Equipping an item owned by another member performs a safe transfer, and replacing gear returns the previous item to inventory.

## Save schema and migration

The save schema is version 5. Existing versioned and pre-versioned saves still normalize through `normalizeGameState()`.

Persisted member progression includes current HP (including `0`), learned techniques, mastery progress, equipment IDs, active/reserve state, and down-state fields. Derived combat stats are excluded from the serialized envelope. Party normalization guarantees at least one and at most three active members.

## Tests

`tests/p0-core-systems.test.mjs` is DOM-independent and covers:

- resolver ordering, immutability, and derived-stat serialization;
- every weapon family, schema completeness, unarmed fallback, attack type, and combatant derivation;
- mastery thresholds, anti-grind behavior, rewards, and persistence;
- unknown/known/available technique states;
- phase transitions, input gating, terminal behavior, and the future prepare hook;
- first/second down, revive, third-down retreat, and reset policy;
- active party limits, unique ownership, safe transfer, HP-zero migration, and save/load.

The pre-existing suite remains the regression guard for combat timing, targeting, formation, map traversal, title/save flow, audio, assets, and the current Demo runtime.
