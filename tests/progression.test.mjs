import assert from "node:assert/strict";
import { applyExperience, getLevelExpRequirement } from "../src/core/Progression.js";
import { createInitialGameState } from "../src/core/GameState.js";
import { StoryProgressionManager } from "../src/core/StoryProgressionManager.js";
import { ENEMY_DEFINITIONS } from "../src/data/battleContent.js";

const state = createInitialGameState();
assert.equal(getLevelExpRequirement(1), 40, "starter combat reaches Level 2 after 40 EXP");
const gained = applyExperience(state.party[0], 40);
assert.equal(gained.newLevel, 2);
assert.equal(state.party[0].progression.exp, 0);

const story = new StoryProgressionManager(state);
assert.equal(story.complete("chapter_01_complete").completed, false, "milestone prerequisites are enforced");
assert.equal(story.complete("chapter_01_started").completed, true);
assert.equal(story.complete("chapter_01_started").completed, false, "milestones never apply twice");
assert.equal(story.complete("rafel_used_fulitas_lighting").completed, true);
assert.equal(story.complete("chapter_01_complete").completed, true);
assert.equal(state.story.level, 1, "minor chapter beats do not arbitrarily grant levels");

assert.deepEqual(ENEMY_DEFINITIONS.highwayman.expRange, [0, 0]);
assert.equal(ENEMY_DEFINITIONS.highwayman.rankReward, 0, "normal enemies never grant direct Rank");

console.log("Progression: combat Level, story milestone prerequisites, idempotency, and no enemy Rank passed.");
