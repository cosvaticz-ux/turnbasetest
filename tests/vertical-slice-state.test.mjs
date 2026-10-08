import assert from "node:assert/strict";
import { createInitialGameState, normalizeGameState, SAVE_SCHEMA_VERSION } from "../src/core/GameState.js";
import { QuestManager, QUEST_STATE } from "../src/core/QuestManager.js";
import { SaveManager } from "../src/core/SaveManager.js";
import {
    EQUIPMENT_DEFINITIONS,
    EQUIPMENT_SLOT_DEFINITIONS,
    ITEM_DEFINITIONS,
    UI_ICON_ASSETS
} from "../src/data/battleContent.js";
import { DIALOGUE_DEFINITIONS, getMapContent, MAP_CONTENT } from "../src/data/worldContent.js";

const values = new Map();
const storage = {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) { values.delete(key); }
};

const saves = new SaveManager(storage);
const state = createInitialGameState();
assert.equal(state.runtimeMode, "demo");
assert.equal(state.mapPosition.mapId, "front-forest");
state.mapPosition = { mapNodeId: "town-south", spawnId: "spawn-from-front-forest", x: 712, y: 932, facing: -1 };
state.completedEncounters.push("highwayman-patrol");
assert.equal(saves.save("autosave", state), true);
const envelope = JSON.parse(values.get("turn-based-rpg:autosave"));
assert.equal(envelope.schemaVersion, SAVE_SCHEMA_VERSION);
assert.ok(envelope.savedAt);
assert.equal(envelope.state.mapPosition.mapId, "town-south");
assert.deepEqual(saves.load("autosave").completedEncounters, ["highwayman-patrol"]);

values.set("turn-based-rpg:legacy", JSON.stringify({ party: [{ id: "luke", hp: 42 }] }));
assert.equal(saves.load("legacy").party[0].hp, 42, "legacy unversioned saves migrate into current demo defaults");
values.set("turn-based-rpg:future", JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION + 1, state: {} }));
assert.equal(saves.load("future"), null, "future incompatible saves fail closed");
values.set("turn-based-rpg:broken", "not json");
assert.equal(saves.load("broken"), null, "corrupt saves fail closed");

const questState = createInitialGameState();
const quests = new QuestManager(questState);
assert.equal(quests.start("safer-road"), true);
assert.equal(quests.get("safer-road").state, QUEST_STATE.ACTIVE);
assert.equal(quests.setObjective("safer-road", "defeatHighwayman"), true);
assert.equal(quests.canComplete("safer-road"), true);
assert.equal(quests.complete("safer-road"), true);
assert.equal(quests.get("safer-road").state, QUEST_STATE.COMPLETED);

assert.equal(normalizeGameState({ settings: { masterVolume: 9, musicVolume: -2 } }).settings.masterVolume, 1);
assert.equal(normalizeGameState({ settings: { masterVolume: 9, musicVolume: -2 } }).settings.musicVolume, 0);
assert.equal(normalizeGameState({ mapPosition: { mapNodeId: "mountain-start" } }).mapPosition.mapId, "front-forest");
assert.equal(ITEM_DEFINITIONS["healing-draught"].healAmount, 35);
assert.equal(ITEM_DEFINITIONS["greater-healing-draught"].healAmount, 60);
assert.equal(ITEM_DEFINITIONS.antidote.curesStatus, "poison");
assert.equal(ITEM_DEFINITIONS["healing-draught"].iconImage, UI_ICON_ASSETS.itemPotion);
assert.equal(ITEM_DEFINITIONS.antidote.iconImage, UI_ICON_ASSETS.itemAntidote);
assert.match(UI_ICON_ASSETS.skillFireball, /icon-skill-frieball\.png$/);
assert.equal(EQUIPMENT_SLOT_DEFINITIONS.length, 6);
assert.equal(EQUIPMENT_SLOT_DEFINITIONS.at(-1).id, "shield");
assert.ok(EQUIPMENT_SLOT_DEFINITIONS.some(slot => slot.id === "weapon"));
assert.equal(EQUIPMENT_DEFINITIONS["plain-shirt"].slot, "body");
assert.equal(EQUIPMENT_DEFINITIONS["plain-cloth"].slot, "lower");
assert.equal(createInitialGameState().party.length, 2);
assert.deepEqual(createInitialGameState().party.map(member => member.id), ["luke", "dummy"]);
assert.equal(createInitialGameState().party[0].equipment.body, "plain-shirt");
assert.equal(createInitialGameState().party[0].equipment.lower, "plain-cloth");
assert.ok(DIALOGUE_DEFINITIONS.guildComplete.length >= 2);
assert.ok(DIALOGUE_DEFINITIONS.townHighwayman.length >= 1);
assert.equal(Object.keys(MAP_CONTENT).length, 17);
assert.ok(getMapContent("mountain-start").interactives.some(item => item.eventId === "fulitas-lighting"));
assert.ok(getMapContent("ghoul-nest").interactives.some(item => item.type === "story-encounter"));
assert.ok(getMapContent("front-forest").encounterZones.length > 0);
assert.equal(getMapContent("town-south").encounterZones.length, 0);
assert.equal(getMapContent("town-north").encounterZones.length, 0);
assert.ok(getMapContent("town-south").npcs.some(npc => npc.type === "shop"));
assert.ok(getMapContent("town-north").interactives.some(item => item.type === "slice-end"));

console.log("Demo state: schema, migration, quest, item, map content, party defaults, and settings assertions passed.");
