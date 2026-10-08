import assert from "node:assert/strict";
import { BattleVictoryResolver } from "../src/core/BattleVictoryResolver.js";
import { createInitialGameState } from "../src/core/GameState.js";
import { MapNodeManager } from "../src/core/MapNodeManager.js";
import { QuestManager } from "../src/core/QuestManager.js";
import { RewardResolver } from "../src/core/RewardResolver.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { validateContent } from "../src/data/contentValidation.js";
import { ENCOUNTERS } from "../src/data/encounters.js";
import { MAP_NODE_REGISTRY, getMapNode } from "../src/data/maps/mapNodeRegistry.js";

const inactiveState = createInitialGameState();
const inactiveQuests = new QuestManager(inactiveState);
assert.equal(inactiveQuests.handleEvent({
    type: "monster-defeated", eventId: "inactive-wolves", encounterId: "road-wolves",
    monsterId: "grey-wolf", count: 3, mapId: "old-forest-road"
}).changed, false, "an available quest does not respond before acceptance");
assert.equal(inactiveState.quests["wolves-southern-road"].objectives.defeatWolves, false);

const eventState = createInitialGameState();
const eventQuests = new QuestManager(eventState);
assert.equal(eventQuests.start("wolves-southern-road"), true);
assert.equal(eventQuests.handleEvent({
    type: "monster-defeated", eventId: "wrong-target", encounterId: "road-wolves",
    monsterId: "wild-boar", count: 1, mapId: "old-forest-road"
}).changed, false, "unrelated events do not progress the active quest");
eventQuests.handleEvent({
    type: "monster-defeated", eventId: "wolf-wave-1", encounterId: "road-wolves",
    monsterId: "grey-wolf", count: 1, mapId: "old-forest-road"
});
assert.equal(eventState.quests["wolves-southern-road"].objectiveProgress.defeatWolves, 1);
eventQuests.handleEvent({
    type: "monster-defeated", eventId: "wolf-wave-2", encounterId: "road-wolves",
    monsterId: "grey-wolf", count: 2, mapId: "old-forest-road"
});
assert.equal(eventState.quests["wolves-southern-road"].objectives.defeatWolves, true, "counted objectives accumulate");
assert.equal(eventQuests.handleEvent({
    type: "monster-defeated", eventId: "wolf-wave-2", encounterId: "road-wolves",
    monsterId: "grey-wolf", count: 2, mapId: "old-forest-road"
}).changed, false, "a resolved encounter event cannot count twice");

eventState.quests["missing-supplies"].state = "active";
assert.equal(eventQuests.handleEvent({
    type: "interaction-completed", eventId: "farm-search", interactionId: "farmhouse-supplies",
    mapId: "abandoned-farmstead"
}).changed, true, "investigation events use the same bridge");
eventState.quests["herbal-remedy"].state = "active";
assert.equal(eventQuests.handleEvent({
    type: "item-acquired", eventId: "herb-pickup", itemId: "medicinal-herb", quantity: 1,
    mapId: "woodcutter-camp"
}).changed, true, "item acquisition events use the same bridge");

const eventStorage = new Map();
const eventSaves = new SaveManager({
    setItem: (key, value) => eventStorage.set(key, value),
    getItem: key => eventStorage.get(key) || null
});
assert.equal(eventSaves.save("events", eventState), true);
const loadedEvents = eventSaves.load("events");
assert.equal(loadedEvents.quests["wolves-southern-road"].objectiveProgress.defeatWolves, 3);
assert.ok(loadedEvents.quests["wolves-southern-road"].processedEventIds.includes("wolf-wave-2"));

const wolfState = createInitialGameState();
const wolfLevel = wolfState.story.level;
const wolfCurrency = wolfState.story.currency;
const wolfQuests = new QuestManager(wolfState);
assert.equal(wolfQuests.start("wolves-southern-road"), true, "Mara can offer the playable wolf contract");

const travel = new MapNodeManager({ initialMapId: "town-south" });
travel.releaseArrivalGuard("warp-to-front-forest");
assert.equal(await travel.transitionThrough("warp-to-front-forest"), true);
assert.equal(await travel.transitionThrough("warp-to-old-forest-road"), true);
assert.equal(travel.currentMapId, "old-forest-road", "the contract map is reachable through live warps");

const victory = new BattleVictoryResolver(wolfState).resolve({
    encounterId: "road-wolves", enemyId: "grey-wolf", enemyCount: 3, mapId: travel.currentMapId
});
assert.equal(victory.applied, true);
assert.deepEqual(victory.loot.items, [{ id: "wolf-pelt", quantity: 3 }]);
assert.equal(wolfState.inventory.find(item => item.id === "wolf-pelt").quantity, 3);
assert.equal(wolfState.quests["wolves-southern-road"].objectives.defeatWolves, true);
assert.equal(wolfState.quests["wolves-southern-road"].state, "active", "objectives do not auto-complete the quest");
assert.equal(wolfState.quests["wolves-southern-road"].rewarded, false, "objectives do not auto-apply quest rewards");
assert.equal(wolfState.story.level, wolfLevel, "normal combat grants no Level EXP");
assert.equal(new BattleVictoryResolver(wolfState).resolve({
    encounterId: "road-wolves", enemyId: "grey-wolf", enemyCount: 3, mapId: "old-forest-road"
}).applied, false, "battle result replay cannot duplicate authored loot");
assert.equal(wolfState.inventory.find(item => item.id === "wolf-pelt").quantity, 3);

assert.equal(wolfQuests.handleEvent({
    type: "return-to-npc", eventId: "return-to-npc:guild-warden",
    npcId: "guild-warden", mapId: "town-south"
}).changed, true);
assert.equal(wolfQuests.canComplete("wolves-southern-road"), true);
assert.equal(wolfQuests.completeAndReward("wolves-southern-road", new RewardResolver(wolfState)), true);
assert.equal(wolfState.story.currency, wolfCurrency + 14);
assert.equal(wolfState.reputation.adventurerGuild, 2);
assert.equal(wolfState.story.rankPoints, 2);
assert.equal(wolfState.story.level, wolfLevel);

const wolfStorage = new Map();
const wolfSaves = new SaveManager({
    setItem: (key, value) => wolfStorage.set(key, value),
    getItem: key => wolfStorage.get(key) || null
});
assert.equal(wolfSaves.save("wolf-contract", wolfState), true);
const reloadedWolf = wolfSaves.load("wolf-contract");
assert.equal(reloadedWolf.quests["wolves-southern-road"].state, "completed");
assert.equal(reloadedWolf.quests["wolves-southern-road"].rewarded, true);
assert.equal(new QuestManager(reloadedWolf).completeAndReward(
    "wolves-southern-road", new RewardResolver(reloadedWolf)
), false, "quest rewards cannot repeat after load");
assert.equal(new BattleVictoryResolver(reloadedWolf).resolve({
    encounterId: "road-wolves", enemyId: "grey-wolf", enemyCount: 3, mapId: "old-forest-road"
}).applied, false, "loot resolution persists through save/load");
assert.throws(() => new RewardResolver(createInitialGameState()).apply({
    items: [{ id: "not-an-item", quantity: 1 }]
}), /Unknown item id/, "invalid authored loot fails before inventory mutation");

const legacyContractState = createInitialGameState();
const legacyContractQuests = new QuestManager(legacyContractState);
assert.equal(legacyContractQuests.start("safer-road"), true);
new BattleVictoryResolver(legacyContractState).resolve({
    encounterId: "highwayman-patrol", enemyId: "highwayman", enemyCount: 1, mapId: "front-forest"
});
assert.equal(legacyContractState.quests["safer-road"].objectives.defeatHighwayman, true, "the existing playable contract uses the generic bridge");

const localMapIds = [
    "old-forest-road", "abandoned-farmstead", "old-graveyard", "woodcutter-camp", "northern-crossroads"
];
for (const mapId of localMapIds) assert.equal(getMapNode(mapId)?.id, mapId);
for (const map of Object.values(MAP_NODE_REGISTRY)) {
    for (const warp of map.groups.warps.filter(entry => entry.active !== false && entry.destinationMapId)) {
        const destination = getMapNode(warp.destinationMapId);
        assert.ok(destination, `${map.id}.${warp.id} has a map target`);
        assert.ok(destination.groups.spawns.some(spawn => spawn.spawnId === warp.destinationSpawnId), `${map.id}.${warp.id} has a spawn target`);
    }
}
for (const [mapId, enemyIds] of Object.entries({
    "old-forest-road": ["grey-wolf", "wild-boar", "highwayman"],
    "abandoned-farmstead": ["wild-boar", "highwayman"],
    "old-graveyard": ["male-zombie", "restless-ghost"],
    "woodcutter-camp": ["highwayman"],
    "northern-crossroads": ["deserting-soldier", "corrupted-adventurer"]
})) {
    const placed = ENCOUNTERS.filter(encounter => encounter.mapNodeId === mapId).map(encounter => encounter.enemyId);
    for (const enemyId of enemyIds) assert.ok(placed.includes(enemyId), `${enemyId} is placed on ${mapId}`);
}
assert.deepEqual(validateContent(), []);
assert.match(validateContent({ maps: [getMapNode("old-forest-road"), getMapNode("old-forest-road")] }).join("\n"), /duplicate id/);
assert.match(validateContent({
    maps: { ...MAP_NODE_REGISTRY, "old-forest-road": { ...getMapNode("old-forest-road"), defaultSpawnId: "missing-spawn" } }
}).join("\n"), /defaultSpawnId: unknown spawn/);

console.log("Content activation: quest events, fixed loot, wolf contract, five-map topology, validation, and save compatibility passed.");
