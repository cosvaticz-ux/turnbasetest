import { STORY_MILESTONES } from "../data/storyContent.js";
import { RewardResolver } from "./RewardResolver.js";

export class StoryProgressionManager {
    constructor(gameState, definitions = STORY_MILESTONES) {
        if (!gameState || typeof gameState !== "object") throw new TypeError("StoryProgressionManager requires game state.");
        this.gameState = gameState;
        this.definitions = definitions;
        if (!this.gameState.story) this.gameState.story = {};
        if (!this.gameState.story.flags) this.gameState.story.flags = {};
        if (!Array.isArray(this.gameState.story.milestones)) this.gameState.story.milestones = [];
    }

    has(milestoneId) {
        return this.gameState.story.milestones.includes(milestoneId);
    }

    canComplete(milestoneId) {
        const definition = this.definitions[milestoneId];
        return Boolean(definition && !this.has(milestoneId)
            && (definition.prerequisites || []).every(id => this.has(id)));
    }

    complete(milestoneId) {
        const definition = this.definitions[milestoneId];
        if (!this.canComplete(milestoneId)) return { completed: false, milestoneId };
        this.gameState.story.milestones.push(milestoneId);
        this.gameState.story.flags[milestoneId] = true;
        this.gameState.story.chapter = Math.max(1, Number(definition.chapter) || 1);
        const previousLevel = Math.max(1, Number(this.gameState.story.level) || 1);
        if (Number(definition.rewards?.level) > previousLevel) {
            this.gameState.story.level = Math.floor(Number(definition.rewards.level));
        }
        const rewards = new RewardResolver(this.gameState).apply(definition.rewards || {});
        return {
            completed: true,
            milestoneId,
            chapter: this.gameState.story.chapter,
            levelBefore: previousLevel,
            levelAfter: this.gameState.story.level,
            rewards
        };
    }

    completeMany(milestoneIds = []) {
        return milestoneIds.map(id => this.complete(id));
    }
}
