# Starter Content Pack 01 — review report

Implemented from main `156244f` (verified equal to fetched origin/main). No commit made.

## Architecture found and chosen

`battleContent.js` combined battle factories with four consumables, two clothing items and three enemies. Six weapons already had a canonical home in `weapons.js`. `storyContent.js` held two quest definitions; `MapEncounterActors.js` held six placed encounters. Iven's inventory was a local array in `MapFieldMenu.js`. Status effects, techniques, progression, NPCs and world content already had separate data modules and remain there.

The implied schemas are flat battle stats/weighted attack or defend AI; inventory IDs and quantities; boolean quest objectives; fixed RewardResolver item/currency/reputation rewards; single-species encounter groups. This pass preserves these schemas. No framework, combat EXP, new objective engine, random-drop engine, asset or CSS changes were introduced.

Canonical lookup modules now live alongside the existing modules in `src/data`. `items.js` owns consumables/materials/keys/clothing and indexes the existing weapon objects from `weapons.js`; weapon definitions are not copied. Compatibility exports in `battleContent.js` and `storyContent.js` reference the same records. Registries are immutable and reject duplicate IDs before indexing. Small strict accessors throw for unknown IDs.

## Content inventory

| Registry | Total | Preserved | New |
|---|---:|---:|---:|
| Items, including equipment | 25 | 12 | 13 |
| Monsters | 12 | 3 | 9 |
| Quests | 8 | 2 | 6 |
| Encounters | 16 | 6 placed | 10 unplaced |
| Shops | 1 | Iven | Two medicines added to inventory |

Items: existing Healing Draught, Greater Healing Draught, Antidote, Coarse Salt, Plain Shirt, Plain Cloth and six weapons; new Linen Bandage, Bitter Tonic, Wolf Pelt, Boar Hide, Beast Fang, Slime Residue, Grave Dust, Corrupted Shard, Iron Scrap, Medicinal Herb, Guild Contract Token, Stolen Ledger and Bloodstained Pendant. Existing equipment was reused instead of inventing unsupported shield/accessory slots.

Monsters: existing Highwayman, Highland Man and Ghoul; new Ditch Slime, Grey Wolf, Wild Boar, Deserting Soldier, Corrupted Adventurer, Graveyard Laborer, Restless Ghost, Willow Wood and Possessed Knight. New stat tiers distinguish common, dangerous and elite threats. Supported resistance multipliers distinguish ghost/willow encounters. All monsters retain zero combat Level EXP and zero direct Rank rewards.

Quests: existing `kalin-livestock` and `safer-road`; new `wolves-southern-road`, `boar-thicket`, `missing-supplies`, `graveyard-unease`, `herbal-remedy`, `corruption-woods`. These six are local contracts with target metadata, boolean objectives and fixed item/currency/guild reputation rewards. The existing campaign quest remains unchanged and is included in the total of eight.

New encounters: `road-wolves`, `thicket-boar`, `ditch-slime`, `supply-raiders`, `graveyard-laborers`, `unmarked-grave`, `lost-delver`, `wandering-willow`, `dead-rider`, `deserter-camp`. Map references distribute them across Front Forest, Deep Forest and Town North. Existing placements and triggering are unchanged.

## Files added

- `src/data/contentRegistry.js`: shared immutable registry construction and strict lookup.
- `src/data/monsters.js`: canonical monster definitions and historical alias.
- `src/data/quests.js`: canonical quest definitions.
- `src/data/encounters.js`: placed encounter records and catalog compositions.
- `src/data/shops.js`: Iven's stock definition.
- `src/data/uiIcons.js`: existing UI asset paths and fixed item atlas layout.
- `src/data/contentValidation.js`: cross-content validation.
- `tests/content-database.test.mjs`: content, invalid-reference and compatibility checks.
- `docs/STARTER_CONTENT_PACK_01.md`: this report.

## Files modified and integration

- `src/data/items.js`: replaces its old reexport with canonical item records and compatibility views.
- `src/data/battleContent.js`: reexports moved data; enemy factory resolves strict monster IDs.
- `src/data/storyContent.js`: reexports canonical quests; milestones/debug content unchanged.
- `src/core/GameState.js`: imports canonical quests; existing normalization adds new defaults.
- `src/core/QuestManager.js`: consumes definitions, initializes missing quest states, checks declared objectives/prerequisites, blocks unwired catalog contracts. Completion checks required definition objectives rather than arbitrary saved objective fields.
- `src/core/RewardResolver.js`: validates item references before applying any reward mutation.
- `src/scenes/map/MapEncounterActors.js`: imports/reexports existing placements from encounter data; actor behavior unchanged.
- `src/scenes/map/MapFieldMenu.js`: reads Iven's inventory from shop data, including the two new supported healing items.
- `src/ui/EquipmentMenuPolish.js` and `src/ui/StandaloneItemCrop.js`: use explicit atlas layout metadata instead of database size. No images or styles changed.

MapScene and BattleScene gained no branches and were not modified.

## Compatibility and coupling

All 12 prior item/equipment IDs, three monster IDs, two quest IDs and six placed encounter IDs remain. Compatibility imports share canonical objects. Existing item values, enemy stats, quest rewards and map positions are preserved.

Validation found the existing pursuit zone's `death-archmage` enemy ID previously depended on the factory's broad Highwayman fallback. An explicit documented `death-archmage -> highwayman` alias preserves that one historical behavior. Other invalid enemy IDs now throw.

The item icon crop code treated database length as atlas cell count. Growing the registry would have shifted old icons. The original four-cell mapping is now explicit asset metadata; new items retain existing glyph fallback handling.

Save schema remains version 5. Existing normalization preserves inventory and existing quest state/rewarded flags, merges missing new locked quest defaults, and restores canonical rewards. Tests cover schema-4 normalization and SaveManager round-trip without resetting completion. Unknown objective writes now throw; this intentionally exposes content mistakes. Old extra saved objective fields do not replace required canonical objectives.

## Validation and tests

Validation checks required IDs/names, duplicate IDs and key mismatches; equipment slots and inventory/effect types; health/stat/price/count ranges; supported AI actions; zero combat EXP/direct Rank; monster reward and optional drop references; drop chance/quantity ranges; quest rewards/objective target references; prerequisite/next quest IDs; NPC/interaction/map references; encounter monster/count/map references; shop stock and price references. Registry construction rejects duplicates before they can overwrite each other. Current data validation runs in the test suite, not on every frame.

Added tests cover registry counts/immutability, shared legacy records and IDs, strict unknown-ID handling, the pursuit alias, all encounter compositions through the existing enemy factory, invalid references/ranges, reward preflight without partial mutation, locked catalog contracts, objective validation, contract reward idempotency, schema migration, save/load and fixed atlas metadata. Reserved drop-table input is tested even though authored monster loot uses the existing fixed RewardResolver schema.

Baseline and intermediate runs: all 23 original test files passed. Final command: `node --test tests/*.test.mjs` — **24 passed, 0 failed, 0 skipped**. Includes quest/progression, battle-state, campaign vertical slice, exploration integration, demo runtime, map node/culling and save-related assertions. Existing headless preloader failure-path messages are present; the tests pass. A cleanup accidentally removed the equipment import needed by createPlayer; the full suite caught it, the import was restored, and the full suite passed again.

The systems smoke test accepts `safer-road`, moves state to its map, resolves a Highwayman defeat with CombatResolver, explicitly invokes the existing objective bridge, returns to town, grants currency/item/reputation, saves and reloads. It verifies completion and rewards cannot repeat and Level is unchanged. This is an automated systems smoke, not a manual browser playthrough. It does not claim generic objective events or automatic monster loot are wired.

Final `git diff --check`: passed. Git summary: 10 existing files modified (+170/-358 lines), plus 9 new files. Tracked diff is primarily data extraction; the new files contain the canonical records, catalog additions, validation and report. No commit or staging performed.

## Remaining gaps and next task

Only the two new medicines are newly available through existing shop gameplay. The nine new monsters and ten encounter compositions are catalog content, not additional live map actors. The six new contracts remain locked; no unfinishable quest can be accepted. Metadata for objective targets, rarity, placement and placeholder renderer is authoring information, not new mechanics.

The engine lacks generic kill/collection/investigation/return objective routing and automatic fixed monster-loot handoff. Herb and ledger pickup placement is also absent. Prerequisite IDs are checked, but nextQuestId does not automatically unlock anything. Quest reward reputation uses the existing progression interpretation; no separate Rank-point mechanic was added. Mixed-species encounter compositions are not introduced. New monsters temporarily reference existing Highwayman art; no species-specific rendering or CSS placeholder system was added. Numerical tier values have automated compatibility coverage, not playtest balance approval.

Recommended next task: activate one wolf contract vertical slice by adding the smallest generic event-to-objective bridge and fixed RewardResolver victory-loot handoff, then author its map placement and return interaction. Validate accept → travel → combat → loot → objective → return → reputation → save/reload before unlocking the other catalog contracts. Follow with species art and encounter balance testing.
