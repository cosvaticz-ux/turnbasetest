# Class, skill and mastery implementation

## Existing architecture and integration

This is the existing framework-free game, not a separate demo. `BattleScene` coordinates actions and presentation; `CombatResolver` and `RNG` resolve damage and Critical/Fatal rolls. `StatusEffectManager` owns statuses, `TurnManager` owns side/round transitions, and `PreparePhaseManager` owns the existing one-choice preparation actions. `PartyManager` and `GameState` normalize persistent characters. `createPlayer` creates separate battle actors; `StatResolver` derives equipment/passive stats. `MasteryManager` already offers world grants and encounter-limited practice. Versioned saves go through `SaveManager`.

The repository already awards character EXP and has a level-gated starter skill tree, despite the broader milestone progression design. Those existing systems remain intact. This implementation adds no Class EXP or Class Rank grind. Class access does not check character level.

## Data and state

`data/classes.js` defines the 11 requested classes, identities, categories, affinities, skill/passive IDs and composite unlock requirements. `data/classSkills.js` contains 57 class skills (41 active and 16 passive), three tiers each, ammunition and first-pass balance constants. Two distinct Bow Mastery records preserve Archer and Bow Master behavior. These class skills coexist with the original starter tree and learned story techniques.

`ClassSystem` owns normalization, current-class access, tier lookup and unlock evaluation. Persistent `member.classState` stores:

```js
{
  currentClass, unlockedClasses, ownedSkills, skillMastery,
  unlocks, selectedElement, ammoId
}
```

Weapon/discipline practice remains in `member.mastery`. Technique practice uses `technique:<skill-id>` keys in that same ledger; no competing mastery store is introduced. Technique tiers use 0 / 3 / 8 practice thresholds. Weapon mastery retains the existing 0 / 5 / 15 / 30 thresholds. World grants and combat practice both resolve tiers. Combat gains remain capped at one per discipline per non-trivial encounter, granted by the existing victory flow. Active-class passive practice is collected with combat practice. Changing class preserves learned skills, equipment, practice and tiers; only current-class skills/passives are active. Existing story techniques and purchased starter skills remain available.

New and older characters default to Infantry, with Infantry, Archer and Magician selectable. Infantry conditioning now supplies its tier-I HP bonus. Derived stats are rebuilt from base stats, avoiding repeated multiplication. Save schema 7 preserves class state and accepts older saves through defaults. Runtime loaded state, protection, primes, traps and per-battle limits are not saved.

## Combat execution

`ClassCombat` interprets reusable damage, setup, heal, protection, cleanse, ward, mark and trap effects. The scene supplies its existing damage pipeline and battle-log/mastery hooks. Class attacks use independent accuracy and Critical/Fatal rolls per hit. Critical armor bypass and Fatal scaling remain in `RNG`; partial penetration extends the existing defense calculation. Legacy attacks keep their original RNG sequence unless a new condition or reload weapon requires accuracy.

Status records live in the existing `statusEffects` array and refresh by ID instead of stacking. Poison continues to use the existing poison fields. Bleed/Burn tick through the existing DoT manager; durations tick once at the end of the enemy side. Stun, Stagger and Immobilize interrupt one enemy action. Slow reduces accuracy, including enemy attacks. This is an action-based root, not invented grid movement.

Guard Ally and Martyr intercept the next valid attack this round. Hold the Line checks living allies below its configured threshold. Stances counter once; pending Blood Rush/Martyr bonuses become active on the following player side. Hunter marks are source-specific; traps trigger before the next enemy action. Enemy archetypes/tags now reach supernatural, beast and heavy-armor bonuses.

Mend scales the existing 20–30 healing range by 1.5 / 1.8 / 2.2; it does not heal a flat 150–220 HP. Magic uses AP, including fractional costs for Mana Control and Amplify. Focus/Amplify/Chain/Conversion snapshot once per damaging spell and carry across all hits/targets. Old damaging spells also consume these modifiers and Prepared Spell. Elements reuse fire, ice and poison, with neutral magic for Magic Bolt.

Last Prayer is limited to once per battle below 25% HP. Tier III prevents one lethal hit. It explicitly declines to prevent a hit flagged `overkill` or `isOverkill`. The existing game has no implemented Overkill death rule: zero HP normally invokes its down/revive/third-down retreat system. This implementation does not introduce permanent death.

## Reload and Prepare Turn

Crossbows and firearms enter battle loaded. A physical shot consumes that loaded state once per action, including basic attacks. The UI and execution checks reject another shot until reload. Ordinary Reload is one Action-page command costing 1 AP and uses the normal action/turn flow. Quick Reload II adds next-shot accuracy; III allows one free reload per Prepare phase. Professional Soldier II refunds the reload AP; III also primes next-shot damage and penetration.

Ammunition is a persistent build choice, not a consumable inventory stack in this pass. Bodkin, Broadhead, Silver, Incendiary and Scatter use data modifiers, weapon compatibility and Special Ammunition tiers. Basic and class shots both apply ammunition; no per-shot menu is required. Weapons/shot profiles expose noise metadata without a fake encounter-noise system.

Prepare retains its existing timing and completion rule. A standard class reload or Wizard spell preparation consumes the phase's normal preparation choice. Tier-III free reload and ammunition selection leave the phase open. Wizard selects one known damaging spell (including Arcane Break); its first cast is free. Boss phase reopening resets the per-phase free-reload/preparation allowance without advancing the round. Prepare commands enumerate eligible party members, so setup does not require changing the active actor.

## Unlock API and world hooks

```js
const classes = new ClassSystem(gameState);
classes.getClassRequirements(member, "knight"); // labeled met/unmet conditions
classes.canChangeClass(member, "knight");      // { allowed, reason, requirements }
classes.changeClass(member, "knight");         // { changed, ... }
classes.grantUnlock(member, "knight");         // character-specific training token

new RewardResolver(gameState).apply({
  classUnlocks: [{ characterId: "luke", token: "professional-soldier" }],
  mastery: { luke: { crossbow: 1, "technique:crossbow-shot": 3 } }
});
```

Runtime battle actors cannot change class. Editable AND/OR conditions support prerequisite classes, weapon/technique proficiency, rank, quest completion, story flags, reputation, knowledge and character unlock tokens. Default advanced requirements:

| Class | Requirements |
| --- | --- |
| Warrior | Infantry + 3 martial weapon practice |
| Knight | Infantry + 3 martial practice + knight training token |
| Crusader | Knight + faith token |
| Hunter | Archer + 3 bow practice + wilderness token |
| Mercenary | 1 crossbow OR firearm practice + professional-soldier token |
| Bow Master | Archer + 15 bow practice |
| Wizard | Magician + 5 structuredMagic practice + advanced-magic token |
| Cleric | Faith token |

Tokens can be awarded by trainers, quests, manuals, discoveries, duels, bosses, dungeons or exploration using these APIs. Authored NPC/quest grants for these new tokens and distribution of the new crossbow/shield are left for content design; no permanent lore was invented. Existing reward inventory grants can distribute the equipment today.

## UI and development

Press **K** in exploration. The original General tree remains; **Classes**, **Class Skills**, and **Mastery** provide class changes, requirements, tiers, equipment reasons, element/ammo choices and retained practice. Battle has a **Class Skills** command page with direct ally choices. Reload and loaded/ammo state appear on the Action page. Keyboard Tab/native controls work in the new views. The Close callback is bound for use as an event listener.

Development helpers are import-only, not production controls:

```js
import { ClassDebug } from "./src/core/ClassDebug.js";
ClassDebug.unlockAll(member);
ClassDebug.setSkillTier(member, "crossbow-shot", 3);
ClassDebug.setWeaponMastery(member, "crossbow", 15);
ClassDebug.reload(battleActor);
ClassDebug.inspect(member);
```

## Limits and follow-up content

- No authored advanced-class trainers/manuals/unlock quests were added. API/reward hooks are implemented and tested.
- No firearm noise/stealth simulation, ammo economy, heavy-armor penalty subsystem, permanent death or Overkill resolver exists to connect. Noise and Overkill compatibility are explicit hooks.
- No separate magic-defense stat exists. Class magic uses the shared defense pipeline; Arcane Break modifies that defense for class magic. Legacy spells that already ignore all defense retain that behavior.
- Arcane Knowledge writes existing `knowledge` entries and displays inspected information in the battle log; there is no standalone Bestiary screen.
- Class skills use existing number/log feedback, without new bespoke sprites or cinematic attack animations.
- Existing character EXP and starter skill-point progression were deliberately preserved. Migrating the entire game to story-only levels is outside this integration.
- First-pass numbers have execution/regression coverage, not encounter-wide balance validation.

## Files

Created: `src/data/classes.js`, `src/data/classSkills.js`, `src/core/ClassSystem.js`, `src/core/ClassCombat.js`, `src/core/ClassDebug.js`, `src/ui/ClassProgressionView.js`, `tests/class-system.test.mjs`, and this document.

Modified runtime/data: `src/core/PartyManager.js`, `src/core/GameState.js`, `src/core/MasteryManager.js`, `src/core/RewardResolver.js`, `src/core/TechniqueResolver.js`, `src/data/battleContent.js`, `src/data/items.js`, `src/data/weapons.js`, `src/data/techniques.js`, `src/data/monsters.js`, `src/battle/CombatResolver.js`, `src/battle/StatusEffectManager.js`.

Modified UI/integration: `src/scenes/BattleScene.js`, `src/scenes/MapScene.js`, `src/scenes/map/MapFieldMenu.js`, `src/scenes/map/MapSkillMenu.js`, `index.html`, `style.css`, `README.md`.

Updated regression tests: `tests/battle-state.test.mjs`, `tests/map-skill-menu.test.mjs`, `tests/campaign-vertical-slice.test.mjs`, `tests/content-database.test.mjs`, `tests/p0-core-systems.test.mjs`, `tests/vertical-slice-state.test.mjs`. Existing fixed HP/catalog-size assertions now reflect class conditioning, crossbow and shield additions; invalid-slot coverage uses an actually unknown slot.

## Validation

Final results: **29 test files passed**, **115 JavaScript files passed `node --check`**, and **`git diff --check` passed**.

Run all test files with Node, plus `node --check` on JavaScript and `git diff --check`. The added suite executes all 41 active skills at all three tiers and asserts class gating/persistence, equipment requirements, reload/AP/free Prepare handling, ammunition, intercept/counter, low-HP damage, marks/traps/root, spell modifiers, preparation, heal/cleanse, status expiry, survival/Overkill compatibility, mastery and save round-trips. Scene tests cover actual command targeting/party progression, reload Prepare, prepared legacy spell cost and battle cleanup. UI mock tests cover real class-change callbacks, save notification and skill/mastery rendering.

Browser verification exercised class selection and persistence through Continue, class skills and mastery views, and layout at both normal and 640px width. No build system or lint command is configured; this is a directly served ES-module application.
