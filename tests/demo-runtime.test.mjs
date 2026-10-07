import assert from "node:assert/strict";
import { CampaignDirector } from "../src/core/CampaignDirector.js";
import { createInitialGameState, normalizeGameState } from "../src/core/GameState.js";
import { MapNodeManager } from "../src/core/MapNodeManager.js";

const state = createInitialGameState();
assert.equal(state.runtimeMode, "demo");
assert.equal(state.mapPosition.mapId, "front-forest");
assert.deepEqual(state.party.map(member => member.id), ["luke", "dummy"]);

const campaign = new CampaignDirector(state);
assert.equal(campaign.enabled, false);
assert.deepEqual(campaign.onMapArrival("mountain-start"), { changed: false });
assert.equal(campaign.canTraverse({ prerequisiteMilestone: "chapter_04_complete" }), true);
assert.equal(state.story.milestones.length, 0);

const migratedCampaignSave = normalizeGameState({
    schemaVersion: 4,
    mapPosition: { mapNodeId: "kalin-village", spawnId: "player-start" },
    party: [{ id: "rafel", hp: 80 }]
});
assert.equal(migratedCampaignSave.runtimeMode, "demo");
assert.equal(migratedCampaignSave.mapPosition.mapId, "front-forest");
assert.equal(migratedCampaignSave.party[0].id, "rafel", "known party state can be preserved even when the runtime returns to demo");

globalThis.LITANIA_RUNTIME_MODE = "demo";
const maps = new MapNodeManager();
assert.equal(maps.load("mountain-start", "player-start"), true);
assert.equal(maps.currentMapId, "front-forest", "legacy/campaign New Game route resolves to the demo Front Forest");
delete globalThis.LITANIA_RUNTIME_MODE;

console.log("Demo runtime: front-forest start, campaign dormancy, save fallback, and town-entry map routing passed.");
