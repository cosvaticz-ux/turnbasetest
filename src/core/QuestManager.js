import { QUEST_DEFINITIONS, getQuestDefinition } from "../data/quests.js";

export const QUEST_STATE = Object.freeze({
    LOCKED: "locked",
    AVAILABLE: "available",
    ACTIVE: "active",
    COMPLETED: "completed",
    FAILED: "failed"
});

export class QuestManager {
    constructor(gameState) {
        this.gameState = gameState;
        if (!this.gameState.quests) this.gameState.quests = {};
        for (const definition of Object.values(QUEST_DEFINITIONS)) {
            if (this.gameState.quests[definition.id]) continue;
            this.gameState.quests[definition.id] = {
                id: definition.id, name: definition.name, state: definition.initialState,
                objectives: { ...definition.objectives }, objectiveProgress: {}, processedEventIds: [],
                rewards: definition.rewards, rewarded: false
            };
        }
    }

    getDefinition(questId) { return getQuestDefinition(questId); }

    get(questId) {
        return this.gameState.quests[questId] || null;
    }

    start(questId) {
        const definition = this.getDefinition(questId);
        // Catalog contracts remain locked until their authored objective hooks exist.
        if (definition.contentStatus === "catalog") return false;
        if (!(definition.prerequisites || []).every(id => this.get(id)?.state === QUEST_STATE.COMPLETED)) return false;
        const quest = this.get(questId);
        if (!quest || ![QUEST_STATE.LOCKED, QUEST_STATE.AVAILABLE].includes(quest.state)) return false;
        quest.state = QUEST_STATE.ACTIVE;
        return true;
    }

    setObjective(questId, objectiveId, completed = true) {
        const definition = this.getDefinition(questId);
        if (!Object.hasOwn(definition.objectives, objectiveId)) throw new RangeError(`Unknown objective ${questId}.${objectiveId}`);
        const quest = this.get(questId);
        if (!quest || !objectiveId) return false;
        if (!quest.objectives) quest.objectives = {};
        quest.objectives[objectiveId] = Boolean(completed);
        return true;
    }

    handleEvent(event = {}) {
        if (!event || typeof event.type !== "string") return { changed: false, updates: [] };
        const updates = [];
        for (const definition of Object.values(QUEST_DEFINITIONS)) {
            const quest = this.get(definition.id);
            if (quest?.state !== QUEST_STATE.ACTIVE) continue;
            if (!Array.isArray(quest.processedEventIds)) quest.processedEventIds = [];
            if (event.eventId && quest.processedEventIds.includes(event.eventId)) continue;

            let matched = false;
            for (const target of definition.metadata?.objectiveTargets || []) {
                if (quest.objectives?.[target.objectiveId] === true) continue;
                if (!this.matchesObjectiveEvent(quest, target, event)) continue;
                const requiredCount = Math.max(1, Math.floor(Number(target.requiredCount) || 1));
                const rawIncrement = event.count ?? event.quantity ?? 1;
                const increment = Math.max(0, Math.floor(Number(rawIncrement) || 0));
                if (increment <= 0) continue;
                matched = true;
                if (!quest.objectiveProgress || typeof quest.objectiveProgress !== "object") quest.objectiveProgress = {};
                const previous = Math.max(0, Math.floor(Number(quest.objectiveProgress[target.objectiveId]) || 0));
                const progress = Math.min(requiredCount, previous + increment);
                quest.objectiveProgress[target.objectiveId] = progress;
                if (progress >= requiredCount) quest.objectives[target.objectiveId] = true;
                updates.push({
                    questId: definition.id,
                    objectiveId: target.objectiveId,
                    progress,
                    requiredCount,
                    completed: quest.objectives[target.objectiveId] === true
                });
            }
            if (matched && event.eventId) quest.processedEventIds.push(event.eventId);
        }
        return { changed: updates.length > 0, updates };
    }

    processEvent(event = {}) { return this.handleEvent(event); }

    matchesObjectiveEvent(quest, target, event) {
        const type = target.type
            || (target.monsterId ? "monster-defeated"
                : target.interactionId ? "interaction-completed"
                    : target.npcId ? "return-to-npc"
                        : target.itemId ? "item-acquired" : null);
        if (!type || event.type !== type) return false;
        if (target.monsterId && event.monsterId !== target.monsterId) return false;
        if (target.itemId && type === "item-acquired" && event.itemId !== target.itemId) return false;
        if (target.interactionId && event.interactionId !== target.interactionId) return false;
        if (target.npcId && event.npcId !== target.npcId) return false;
        if (target.encounterId && event.encounterId !== target.encounterId) return false;
        if (target.mapId && event.mapId !== target.mapId) return false;
        if ((target.requiredObjectives || []).some(id => quest.objectives?.[id] !== true)) return false;
        if (target.itemId && type === "return-to-npc") {
            const required = Math.max(1, Math.floor(Number(target.requiredQuantity) || 1));
            const owned = this.gameState.inventory?.find(item => item?.id === target.itemId)?.quantity || 0;
            if (owned < required) return false;
        }
        return true;
    }

    canComplete(questId) {
        const quest = this.get(questId);
        return Boolean(quest
            && [QUEST_STATE.AVAILABLE, QUEST_STATE.ACTIVE].includes(quest.state)
            && Object.keys(this.getDefinition(questId).objectives).every(id => quest.objectives?.[id] === true));
    }

    complete(questId) {
        const quest = this.get(questId);
        if (!this.canComplete(questId)) return false;
        quest.state = QUEST_STATE.COMPLETED;
        return true;
    }

    completeAndReward(questId, rewardResolver) {
        const quest = this.get(questId);
        if (!quest || quest.rewarded || !this.complete(questId)) return false;
        quest.rewarded = true;
        rewardResolver?.apply?.(quest.rewards || {});
        return true;
    }
}
