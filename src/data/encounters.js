import { createContentRegistry, requireContent } from "./contentRegistry.js";
import { MAP_NODE_GRID } from "./maps/mapNodeSchema.js";
import { MAX_ENCOUNTER_ENEMIES } from "./battleContent.js";

export const ENCOUNTERS = Object.freeze([
    Object.freeze({
        id: "death-archmage-pursuer", enemyId: "highwayman", name: "Death Arch-mage",
        mapNodeId: "pursuit-area", x: 12 * MAP_NODE_GRID.cellSize, y: 16 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 38, triggerRadiusY: 24, persistCompletion: false,
        chaseZoneId: "death-archmage-hunt-zone", chaseSpeed: 150, returnSpeed: 110,
        leashRadius: 760, facing: -1, storyThreatId: "death-archmage", todoAssetId: "TODO_ASSET_DEATH_ARCHMAGE",
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    Object.freeze({
        id: "highwayman-patrol",
        enemyId: "highwayman",
        mapSpriteId: "highwayman",
        name: "Highwayman",
        mapNodeId: "front-forest",
        x: 16 * MAP_NODE_GRID.cellSize,
        y: 15.5 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34,
        triggerRadiusY: 20,
        minEnemies: 1,
        maxEnemies: MAX_ENCOUNTER_ENEMIES,
        persistCompletion: true,
        chaseZoneId: "front-danger-zone",
        chaseSpeed: 112,
        returnSpeed: 88,
        leashRadius: 360,
        facing: -1,
        preparePhase: Object.freeze({ enabled: true }),
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    Object.freeze({
        id: "deep-forest-highwayman-west",
        enemyId: "highwayman",
        name: "Highwayman",
        mapNodeId: "deep-forest",
        x: 7.5 * MAP_NODE_GRID.cellSize,
        y: 10 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34,
        triggerRadiusY: 20,
        minEnemies: 1,
        maxEnemies: MAX_ENCOUNTER_ENEMIES,
        persistCompletion: false,
        chaseZoneId: "deep-west-danger",
        chaseSpeed: 118,
        returnSpeed: 90,
        leashRadius: 340,
        facing: 1,
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    Object.freeze({
        id: "deep-forest-highwayman-east",
        enemyId: "highwayman",
        name: "Highwayman",
        mapNodeId: "deep-forest",
        x: 16.5 * MAP_NODE_GRID.cellSize,
        y: 14 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34,
        triggerRadiusY: 20,
        minEnemies: 1,
        maxEnemies: MAX_ENCOUNTER_ENEMIES,
        persistCompletion: false,
        chaseZoneId: "deep-east-danger",
        chaseSpeed: 122,
        returnSpeed: 92,
        leashRadius: 360,
        facing: -1,
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    Object.freeze({
        id: "town-south-highwayman",
        enemyId: "highwayman",
        name: "Highwayman",
        mapNodeId: "town-south",
        x: 15.5 * MAP_NODE_GRID.cellSize,
        y: 12.5 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34,
        triggerRadiusY: 20,
        minEnemies: 1,
        maxEnemies: MAX_ENCOUNTER_ENEMIES,
        persistCompletion: false,
        interactionOnly: true,
        interactionRadius: 92,
        dialogueId: "townHighwayman",
        facing: 1,
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    Object.freeze({
        id: "town-north-highwayman",
        enemyId: "highwayman",
        name: "Highwayman",
        mapNodeId: "town-north",
        x: 8.5 * MAP_NODE_GRID.cellSize,
        y: 16.5 * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34,
        triggerRadiusY: 20,
        minEnemies: 1,
        maxEnemies: MAX_ENCOUNTER_ENEMIES,
        persistCompletion: false,
        interactionOnly: true,
        interactionRadius: 92,
        dialogueId: "townHighwayman",
        facing: -1,
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }),
    ...[
        ["road-wolves", "Roadside Wolves", "grey-wolf", "old-forest-road", 9.5, 13.5, 3, 3],
        ["old-road-boar", "Wild Boar", "wild-boar", "old-forest-road", 6.5, 6.5, 1, 1],
        ["old-road-highwaymen", "Road Highwaymen", "highwayman", "old-forest-road", 17, 6.5, 1, 2],
        ["thicket-boar", "Thicket Boar", "wild-boar", "abandoned-farmstead", 17.5, 15, 1, 1],
        ["supply-raiders", "Supply Raiders", "highwayman", "abandoned-farmstead", 15.5, 10.5, 1, 2],
        ["graveyard-laborers", "Graveyard Laborers", "male-zombie", "old-graveyard", 17.5, 15, 2, 2],
        ["unmarked-grave", "Restless Ghost", "restless-ghost", "old-graveyard", 7.5, 15.5, 1, 1],
        ["woodcutter-raiders", "Camp-edge Highwaymen", "highwayman", "woodcutter-camp", 18.5, 16, 1, 2],
        ["deserter-camp", "Deserter Camp", "deserting-soldier", "northern-crossroads", 18.5, 10, 1, 2],
        ["lost-delver", "Lost Delver", "corrupted-adventurer", "northern-crossroads", 12, 5, 1, 1]
    ].map(([id, name, enemyId, mapNodeId, gridX, gridY, minEnemies, maxEnemies]) => Object.freeze({
        id, name, enemyId, mapNodeId,
        x: gridX * MAP_NODE_GRID.cellSize, y: gridY * MAP_NODE_GRID.cellSize,
        triggerRadiusX: 34, triggerRadiusY: 20, minEnemies, maxEnemies,
        persistCompletion: true, facing: -1,
        idleAnimation: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 })
    }))
]);


// Catalog encounters are battle-ready compositions, not extra placed map actors.
// Existing ENCOUNTERS stays the active placement list consumed by exploration.
const catalogEncounter = (id, name, enemyId, mapNodeId, minEnemies = 1, maxEnemies = minEnemies, rarity = "common") => ({
    id, name, enemyId, mapNodeId, minEnemies, maxEnemies, persistCompletion: false,
    contentStatus: "catalog", metadata: { rarity, placementStatus: "unplaced" }
});
export const ENCOUNTER_DEFINITIONS = createContentRegistry([
    ...ENCOUNTERS,
    catalogEncounter("ditch-slime", "Ditch Slime", "slime", "front-forest"),
    catalogEncounter("wandering-willow", "Wandering Willow", "willow-wood", "deep-forest", 1, 1, "rare"),
    catalogEncounter("dead-rider", "Dead Rider", "possessed-knight", "town-north", 1, 1, "rare"),
], "encounter");
export const getEncounterDefinition = id => requireContent(ENCOUNTER_DEFINITIONS, id, "encounter");
