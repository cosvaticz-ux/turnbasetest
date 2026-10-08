import assert from "node:assert/strict";
import { ITEM_DATABASE, getItemDefinition } from "../src/data/items.js";
import { MONSTER_DEFINITIONS, getMonsterDefinition } from "../src/data/monsters.js";
import { QUEST_DEFINITIONS, getQuestDefinition } from "../src/data/quests.js";
import { ENCOUNTERS, ENCOUNTER_DEFINITIONS, getEncounterDefinition } from "../src/data/encounters.js";
import { getShopDefinition } from "../src/data/shops.js";
import { ITEM_ATLAS_IDS } from "../src/data/uiIcons.js";
import { createContentRegistry } from "../src/data/contentRegistry.js";
import { validateContent, assertValidContent } from "../src/data/contentValidation.js";
import * as legacy from "../src/data/battleContent.js";
import { QUEST_DEFINITIONS as legacyQuests } from "../src/data/storyContent.js";
import { createInitialGameState, normalizeGameState, SAVE_SCHEMA_VERSION } from "../src/core/GameState.js";
import { QuestManager } from "../src/core/QuestManager.js";
import { RewardResolver } from "../src/core/RewardResolver.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { resolveCombatDamage, applyResolvedDamage } from "../src/battle/CombatResolver.js";

assert.deepEqual([ITEM_DATABASE, MONSTER_DEFINITIONS, QUEST_DEFINITIONS, ENCOUNTER_DEFINITIONS].map(db => Object.keys(db).length), [27, 12, 8, 19]);
assert.equal(assertValidContent(), true);
assert.throws(() => createContentRegistry([{id:"duplicate"}, {id:"duplicate"}], "test"), /duplicate id/);
assert.throws(() => createContentRegistry([{id:""}], "test"), /nonempty id/);
for (const db of [ITEM_DATABASE, MONSTER_DEFINITIONS, QUEST_DEFINITIONS, ENCOUNTER_DEFINITIONS]) {
    assert.ok(Object.isFrozen(db));
    for (const record of Object.values(db)) assert.ok(Object.isFrozen(record));
}
for (const id of ["healing-draught", "greater-healing-draught", "antidote", "coarse-salt", "plain-shirt", "plain-cloth", "traveler-sword", "iron-greatsword", "ash-spear", "woodsman-axe", "yew-bow", "prototype-firearm"]) {
    assert.equal(getItemDefinition(id), legacy.ITEM_DEFINITIONS[id] || legacy.EQUIPMENT_DEFINITIONS[id]);
}
for (const id of ["highwayman", "highland-man", "ghoul"]) assert.equal(getMonsterDefinition(id), legacy.ENEMY_DEFINITIONS[id]);
for (const id of ["kalin-livestock", "safer-road"]) assert.equal(getQuestDefinition(id), legacyQuests[id]);
assert.equal(ENCOUNTERS.length, 16);
for (const entry of ENCOUNTERS) assert.equal(getEncounterDefinition(entry.id), entry);
for (const get of [getItemDefinition, getMonsterDefinition, getQuestDefinition, getEncounterDefinition, getShopDefinition]) {
    assert.throws(() => get("missing-content-id"), RangeError);
    assert.throws(() => get("toString"), RangeError);
}
assert.throws(() => legacy.createEncounterEnemies("misspelled-enemy", 1), RangeError);
assert.equal(getMonsterDefinition("death-archmage"), getMonsterDefinition("highwayman"));
assert.deepEqual(ITEM_ATLAS_IDS, ["healing-draught", "greater-healing-draught", "antidote", "coarse-salt"]);
assert.ok(getShopDefinition("iven").itemIds.includes("bandage"));
for (const entry of Object.values(ENCOUNTER_DEFINITIONS)) {
    const enemies = legacy.createEncounterEnemies(entry.enemyId, entry.maxEnemies || 1);
    assert.equal(enemies.length, entry.maxEnemies || 1);
    assert.equal(enemies[0].maxHp, getMonsterDefinition(entry.enemyId).maxHp);
}
const lucy = legacy.createPrototypeBattleContent().dummy;
assert.equal(lucy.battleVisual, legacy.CHARACTER_DEFINITIONS.dummy.battleVisual);
assert.equal(lucy.animations.idle.frameAspectRatio, 342 / 518);
assert.equal(lucy.animations.attack.frameAspectRatio, 480 / 526);
assert.equal(lucy.animations.cast.frameAspectRatio, 372 / 530);
const luke = legacy.createPrototypeBattleContent().player;
assert.equal(luke.battleVisual, legacy.CHARACTER_DEFINITIONS.luke.battleVisual);
assert.equal(luke.animations.idle.frames, 28);
assert.equal(luke.animations.idle.frameAspectRatio, 298 / 678);
assert.equal(luke.animations.attack.frameAspectRatio, 416 / 636);
assert.equal(luke.animations.cast.frameAspectRatio, 302 / 638);
assert.equal(luke.animations.attack.fileName, "luke-puch.png");

const replace = (db, id, patch) => ({...db, [id]: {...db[id], ...patch}});
const invalidCases = [
    [{items:[...Object.values(ITEM_DATABASE), ITEM_DATABASE.bandage]}, /duplicate id/],
    [{items:replace(ITEM_DATABASE, "plain-shirt", {slot:"missing-slot"})}, /slot: unknown reference/],
    [{items:replace(ITEM_DATABASE, "bandage", {name:""})}, /name: required/],
    [{monsters:replace(MONSTER_DEFINITIONS, "grey-wolf", {maxHp:-1})}, /maxHp/],
    [{monsters:replace(MONSTER_DEFINITIONS, "grey-wolf", {drops:[{itemId:"missing",chance:-1,min:2,max:1}]})}, /drops\[0\].itemId: unknown/],
    [{monsters:replace(MONSTER_DEFINITIONS, "grey-wolf", {drops:[{itemId:"wolf-pelt",chance:2,min:2,max:1}]})}, /chance/],
    [{monsters:replace(MONSTER_DEFINITIONS, "grey-wolf", {drops:[{itemId:"wolf-pelt",chance:0.5,min:2,max:1}]})}, /minimum exceeds maximum/],
    [{quests:replace(QUEST_DEFINITIONS, "safer-road", {rewards:{items:[{id:"missing",quantity:1}]}})}, /rewards.items\[0\].id: unknown/],
    [{quests:replace(QUEST_DEFINITIONS, "safer-road", {nextQuestId:"missing"})}, /nextQuestId: unknown/],
    [{quests:replace(QUEST_DEFINITIONS, "safer-road", {prerequisites:["missing"]})}, /prerequisites: unknown/],
    [{quests:replace(QUEST_DEFINITIONS, "safer-road", {metadata:{objectiveTargets:[{objectiveId:"defeatHighwayman",monsterId:"missing"}]}})}, /monsterId: unknown/],
    [{encounters:replace(ENCOUNTER_DEFINITIONS, "road-wolves", {enemyId:"missing"})}, /enemyId: unknown/],
    [{encounters:replace(ENCOUNTER_DEFINITIONS, "road-wolves", {maxEnemies:99})}, /maxEnemies/]
];
for (const [content, message] of invalidCases) {
    assert.match(validateContent(content).join("\n"), message);
    assert.throws(() => assertValidContent(content), /Content validation failed/);
}

const state = createInitialGameState();
const quests = new QuestManager(state);
const rewards = new RewardResolver(state);
const before = structuredClone(state);
assert.throws(() => rewards.apply({currency:99,items:[{id:"bandage",quantity:1},{id:"missing",quantity:1}]}), RangeError);
assert.deepEqual(state, before, "invalid rewards must not partially mutate state");
for (const quest of Object.values(QUEST_DEFINITIONS).filter(q => q.contentStatus === "catalog")) assert.equal(quests.start(quest.id), false);
assert.throws(() => quests.setObjective("safer-road", "typo"), RangeError);
assert.equal(quests.start("safer-road"), true);
assert.equal(quests.canComplete("safer-road"), false);
// Systems smoke path: the existing scene-specific victory bridge is represented
// explicitly here. This does not claim generic contract event routing exists.
const encounter = ENCOUNTERS.find(e => e.enemyId === "highwayman");
state.mapPosition.mapNodeId = encounter.mapNodeId;
const enemy = legacy.createEncounterEnemies(encounter.enemyId, 1)[0];
for (let turn = 0; enemy.isAlive() && turn < 100; turn++) {
    applyResolvedDamage(enemy, resolveCombatDamage({attacker:{attack:20},target:enemy,profile:legacy.ATTACK_DEFINITIONS.luke,randomSource:()=>0.5}));
}
assert.equal(enemy.isAlive(), false);
quests.setObjective("safer-road", "defeatHighwayman");
state.mapPosition.mapNodeId = "town-south";
assert.equal(quests.completeAndReward("safer-road", rewards), true);
assert.equal(state.story.currency, before.story.currency + 25);
assert.equal(state.reputation.adventurerGuild, (before.reputation.adventurerGuild || 0) + 3);
assert.equal(state.story.level, before.story.level);
const storage = new Map();
const saves = new SaveManager({setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)});
assert.equal(saves.save("content-smoke", state), true);
const restored = saves.load("content-smoke");
assert.equal(restored.quests["safer-road"].state, "completed");
assert.equal(restored.quests["safer-road"].rewarded, true);
assert.equal(new QuestManager(restored).completeAndReward("safer-road", new RewardResolver(restored)), false);
assert.equal(restored.story.currency, state.story.currency);
assert.deepEqual(restored.inventory, state.inventory);
const oldSave = structuredClone(state);
oldSave.schemaVersion = 4;
for (const id of Object.keys(oldSave.quests)) if (!["safer-road", "kalin-livestock"].includes(id)) delete oldSave.quests[id];
const migrated = normalizeGameState(oldSave);
assert.equal(migrated.schemaVersion, SAVE_SCHEMA_VERSION);
assert.equal(migrated.quests["safer-road"].rewarded, true);
assert.equal(migrated.quests["wolves-southern-road"].state, "available");
assert.deepEqual(migrated.inventory, state.inventory);
// Authored fixed loot remains directly compatible with RewardResolver.
rewards.apply(getMonsterDefinition("grey-wolf").rewards);
assert.equal(state.inventory.find(item => item.id === "wolf-pelt").quantity, 1);
console.log("Content database: canonical references, validation failures, encounters, contract rewards and save compatibility passed.");
