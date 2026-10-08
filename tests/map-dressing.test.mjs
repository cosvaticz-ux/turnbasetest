import assert from "node:assert/strict";
import {
    getForestDressingMetrics,
    getForestMassRegions,
    getMapGroundStamps,
    getMapTownProps,
    getMapVegetation,
    MAP_GROUND_ASSETS,
} from "../src/data/maps/mapDressing.js";
import { MAP_NODE_IDS, MAP_NODE_REGISTRY } from "../src/data/maps/mapNodeRegistry.js";


for (const mapNodeId of MAP_NODE_IDS) {
    const mapNode = MAP_NODE_REGISTRY[mapNodeId];
    assert.ok(getMapGroundStamps(mapNode).length > 0, `${mapNodeId} has data-derived road dressing`);
    const isForest = ["front-forest", "deep-forest"].includes(mapNodeId);
    const isTown = mapNodeId.startsWith("town-");
    assert.equal(getMapVegetation(mapNodeId).length > 0, isForest, `${mapNodeId} vegetation matches its biome`);
    assert.equal(getForestMassRegions(mapNodeId).length > 0, isForest, `${mapNodeId} forest mass matches its biome`);
    assert.equal(getMapTownProps(mapNodeId).length > 0, isTown, `${mapNodeId} town props match its biome`);
    const metrics = getForestDressingMetrics(mapNodeId);
    assert.equal(metrics.renderedTreeCount, getMapVegetation(mapNodeId).length);
    assert.equal(metrics.regionCount, getForestMassRegions(mapNodeId).length);
}

console.log("Map dressing: minimal active ground retains dormant decorative data without rendering it.");
