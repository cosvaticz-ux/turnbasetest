import { DEEP_FOREST_NODE } from "./deepForest.js";
import { FRONT_FOREST_NODE } from "./frontForest.js";
import { TOWN_NORTH_NODE } from "./townNorth.js";
import { TOWN_SOUTH_NODE } from "./townSouth.js";
import { CAMPAIGN_MAP_NODES } from "./campaignMaps.js";
import { LOCAL_MAP_NODES } from "./localMaps.js";

export const MAP_NODE_IDS = Object.freeze([
    ...Object.keys(CAMPAIGN_MAP_NODES),
    ...Object.keys(LOCAL_MAP_NODES),
    "deep-forest",
    "front-forest",
    "town-south",
    "town-north"
]);

export const MAP_NODE_REGISTRY = Object.freeze({
    ...CAMPAIGN_MAP_NODES,
    ...LOCAL_MAP_NODES,
    "deep-forest": DEEP_FOREST_NODE,
    "front-forest": FRONT_FOREST_NODE,
    "town-south": TOWN_SOUTH_NODE,
    "town-north": TOWN_NORTH_NODE
});

export function getMapNode(mapNodeId) {
    return MAP_NODE_REGISTRY[mapNodeId] || null;
}

export function getMapNodeSpawn(mapNodeId, spawnId) {
    return getMapNode(mapNodeId)?.groups.spawns.find(spawn => spawn.spawnId === spawnId) || null;
}
