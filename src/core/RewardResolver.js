import { PartyManager } from "./PartyManager.js";
import { MasteryManager } from "./MasteryManager.js";
import { getItemDefinition } from "../data/items.js";
import { applyCharacterExperience, applyRankPoints } from "./Progression.js";
import { ClassSystem } from "./ClassSystem.js";

function addInventoryItem(state, itemId, quantity) {
    if (!itemId || quantity <= 0) return false;
    if (!Array.isArray(state.inventory)) state.inventory = [];
    const existing = state.inventory.find(item => item?.id === itemId);
    if (existing) existing.quantity = Math.max(0, Number(existing.quantity) || 0) + quantity;
    else state.inventory.push({ id: itemId, quantity });
    return true;
}

export class RewardResolver {
    constructor(gameState) {
        if (!gameState || typeof gameState !== "object") throw new TypeError("RewardResolver requires game state.");
        this.gameState = gameState;
    }

    apply(rewards = {}) {
        // Validate all item references before applying any part of the reward.
        for (const item of rewards.items || []) getItemDefinition(Array.isArray(item) ? item[0] : item?.id);
        const state = this.gameState;
        const applied = { currency: 0, rankPoints: 0, items: [], reputation: {}, techniques: [], mastery: {}, flags: [], experience: [] };
        if (!state.story) state.story = {};

        const currency = Math.max(0, Math.floor(Number(rewards.currency) || 0));
        if (currency) {
            state.story.currency = Math.max(0, Number(state.story.currency) || 0) + currency;
            applied.currency = currency;
        }

        for (const item of rewards.items || []) {
            const id = Array.isArray(item) ? item[0] : item?.id;
            const quantity = Math.max(0, Math.floor(Number(Array.isArray(item) ? item[1] : item?.quantity) || 0));
            if (addInventoryItem(state, id, quantity)) applied.items.push({ id, quantity });
        }

        if (!state.reputation) state.reputation = {};
        for (const [factionId, amountValue] of Object.entries(rewards.reputation || {})) {
            const amount = Math.max(0, Math.floor(Number(amountValue) || 0));
            state.reputation[factionId] = Math.max(0, Number(state.reputation[factionId]) || 0) + amount;
            applied.reputation[factionId] = amount;
        }

        const rankPoints = Math.max(0, Math.floor(Number(rewards.rankPoints) || 0));
        if (rankPoints) applied.rankPoints = applyRankPoints(state.story, rankPoints).gained;

        const party = new PartyManager(state);
        for (const reward of rewards.classUnlocks || []) {
            new ClassSystem(state).grantUnlock(party.get(reward.characterId), reward.token);
        }
        const experience = Math.max(0, Math.floor(Number(rewards.experience) || 0));
        if (experience) for (const member of party.getActiveMembers()) {
            applied.experience.push({ characterId: member.id, ...applyCharacterExperience(member, experience) });
        }
        for (const reward of rewards.techniques || []) {
            if (party.learnTechnique(reward.characterId, reward.techniqueId)) applied.techniques.push({ ...reward });
        }
        const mastery = new MasteryManager(state);
        for (const [memberId, disciplines] of Object.entries(rewards.mastery || {})) {
            if (!party.get(memberId)) continue;
            applied.mastery[memberId] = {};
            for (const [discipline, amountValue] of Object.entries(disciplines || {})) {
                const amount = Math.max(0, Number(amountValue) || 0);
                applied.mastery[memberId][discipline] = mastery.grant(memberId, discipline, amount);
            }
        }

        if (!state.story.flags) state.story.flags = {};
        for (const flag of rewards.storyFlags || []) {
            state.story.flags[flag] = true;
            applied.flags.push(flag);
        }
        if (!Array.isArray(state.knowledge)) state.knowledge = [];
        for (const entry of rewards.knowledge || []) {
            if (!state.knowledge.includes(entry)) state.knowledge.push(entry);
        }
        if (!Array.isArray(state.worldAccess)) state.worldAccess = [];
        for (const entry of rewards.access || []) {
            if (!state.worldAccess.includes(entry)) state.worldAccess.push(entry);
        }
        return applied;
    }
}
