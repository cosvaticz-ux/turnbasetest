import assert from "node:assert/strict";
import { CampaignDirector } from "../src/core/CampaignDirector.js";
import { inspectCampaignState, jumpToChapter } from "../src/core/CampaignDebug.js";
import { createInitialGameState, normalizeGameState, SAVE_SCHEMA_VERSION } from "../src/core/GameState.js";
import { MasteryManager } from "../src/core/MasteryManager.js";
import { PartyManager } from "../src/core/PartyManager.js";
import { RewardResolver } from "../src/core/RewardResolver.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { resolvePropertyMultiplier } from "../src/battle/CombatResolver.js";
import { createEncounterEnemies, SKILL_DEFINITIONS } from "../src/data/battleContent.js";
import { getMapNode } from "../src/data/maps/mapNodeRegistry.js";

const state = createInitialGameState();
state.runtimeMode = "campaign";
state.party = [];
new PartyManager(state).add("rafel");
state.mapPosition = { mapNodeId: "mountain-start", spawnId: "player-start", x: null, y: null, facing: "south" };
const campaign = new CampaignDirector(state);
assert.equal(state.mapPosition.mapNodeId, "mountain-start");
assert.equal(state.party[0].id, "rafel");
assert.equal(campaign.onMapArrival("mountain-start").dialogueId, "chapter1Opening");
assert.equal(campaign.handleInteraction({ eventId: "fulitas-lighting" }).changed, true);
assert.equal(new PartyManager(state).knowsTechnique("rafel", "fulitas-lighting"), true);

const mountainExit = getMapNode("mountain-path").groups.warps.find(warp => warp.destinationMapId === "anno-encounter");
assert.equal(campaign.canTraverse(mountainExit), true);
campaign.onTraverse(mountainExit);
campaign.handleInteraction({ eventId: "anno-meeting" });
assert.deepEqual(new PartyManager(state).getActiveMembers().map(member => member.id), ["rafel", "anno"]);

campaign.handleInteraction({ eventId: "death-archmage" });
assert.equal(campaign.threats.isActive("death-archmage"), true);
campaign.threats.recordDetection("death-archmage", { x: 10, y: 20 });
assert.equal(state.storyThreats["death-archmage"].encounters, 1);
campaign.handleInteraction({ eventId: "gram-rescue" });
assert.equal(campaign.threats.isActive("death-archmage"), false);
assert.deepEqual(new PartyManager(state).getActiveMembers().map(member => member.id), ["rafel", "anno", "gram"]);

const pursuitExit = getMapNode("pursuit-area").groups.warps.find(warp => warp.destinationMapId === "road-foothill");
campaign.onTraverse(pursuitExit);
assert.equal(state.story.level, 2, "the designated Chapter 3 milestone grants the only slice Level");
assert.equal(campaign.onMapArrival("kalin-village").changed, true);
campaign.handleInteraction({ eventId: "kalin-elder" });
assert.equal(state.quests["kalin-livestock"].state, "active");
campaign.handleInteraction({ eventId: "kalin-tracks" });
assert.equal(state.inventory.find(item => item.id === "coarse-salt").quantity, 1);
assert.equal(
    campaign.handleInteraction({ eventId: "ghoul-battle" }).battle.preparePhase.enabled,
    true,
    "the Ghoul encounter explicitly enables its Prepare phase"
);
campaign.onBattleVictory("kalin-ghoul");
const completion = campaign.handleInteraction({ eventId: "kalin-elder" });
assert.equal(completion.sliceComplete, true);
assert.equal(state.quests["kalin-livestock"].state, "completed");
assert.equal(state.story.flags.verticalSliceComplete, true);
assert.equal(state.reputation.kalin, 3);

const party = new PartyManager(state);
const annoHpBeforeRemoval = party.get("anno").hp;
party.remove("anno");
assert.deepEqual(party.getActiveMembers().map(member => member.id), ["rafel", "gram"]);
assert.equal(party.add("anno").hp, annoHpBeforeRemoval, "removed member state is preserved when reactivated");

const ghoul = createEncounterEnemies("ghoul", 1)[0];
assert.equal(resolvePropertyMultiplier(ghoul, { element: "physical" }), 0.3);
assert.equal(resolvePropertyMultiplier(ghoul, SKILL_DEFINITIONS.fireball), 0.6);
ghoul.statusEffects.push({ id: "salt-exposed" });
assert.ok(resolvePropertyMultiplier(ghoul, SKILL_DEFINITIONS.fireball) > 1, "salt turns fire into a meaningful advantage");

const mastery = new MasteryManager(state);
assert.equal(mastery.recordMeaningfulUse("rafel", "structuredMagic", { encounterId: "fixed-one" }), 1);
assert.equal(mastery.recordMeaningfulUse("rafel", "structuredMagic", { encounterId: "fixed-one" }), 0, "same encounter cannot be ground repeatedly");
assert.equal(mastery.recordMeaningfulUse("rafel", "structuredMagic", { encounterId: "trivial", trivial: true }), 0);

const rewardState = createInitialGameState();
new RewardResolver(rewardState).apply({ currency: 5, items: [{ id: "coarse-salt", quantity: 2 }], reputation: { kalin: 1 } });
assert.equal(rewardState.story.currency, 17);
assert.equal(rewardState.inventory.find(item => item.id === "coarse-salt").quantity, 2);

const values = new Map();
const saves = new SaveManager({ setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) || null });
assert.equal(saves.save("campaign", state), true);
const loaded = saves.load("campaign");
assert.equal(loaded.schemaVersion, SAVE_SCHEMA_VERSION);
assert.equal(loaded.runtimeMode, "campaign");
assert.deepEqual(loaded.story.milestones, state.story.milestones);
assert.deepEqual(loaded.party.map(member => member.id), ["rafel", "anno", "gram"]);
assert.equal(loaded.quests["kalin-livestock"].state, "completed");

const migrated = normalizeGameState({ schemaVersion: 3, party: [{ id: "luke", hp: 41 }], story: { exp: 999, level: 1 } });
assert.equal(migrated.runtimeMode, "demo");
assert.equal(migrated.party[0].id, "luke");
assert.equal(migrated.party[0].hp, 41);
assert.equal(migrated.story.exp, 0);

const debugState = createInitialGameState();
debugState.runtimeMode = "campaign";
debugState.party = [];
new PartyManager(debugState).add("rafel");
jumpToChapter(debugState, 4);
assert.deepEqual(inspectCampaignState(debugState).party.map(member => member.id), ["rafel", "anno", "gram"]);
assert.equal(debugState.mapPosition.mapNodeId, "kalin-village");
jumpToChapter(debugState, 1);
assert.deepEqual(inspectCampaignState(debugState).party.map(member => member.id), ["rafel"]);
assert.deepEqual(debugState.story.milestones, [], "debug jumps can safely return to an earlier chapter");

console.log("Dormant campaign core: story, party, threat, quest, rewards, Ghoul interaction, mastery, and saves passed when explicitly enabled.");
