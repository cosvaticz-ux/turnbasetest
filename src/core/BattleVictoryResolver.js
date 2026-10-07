import { ENCOUNTER_DEFINITIONS } from "../data/encounters.js";
import { getMonsterDefinition } from "../data/monsters.js";
import { QuestManager } from "./QuestManager.js";
import { RewardResolver } from "./RewardResolver.js";

function scaleMonsterRewards(rewards = {}, count = 1) {
    return {
        ...rewards,
        items: (rewards.items || []).map(item => ({
            id: Array.isArray(item) ? item[0] : item.id,
            quantity: Math.max(1, Math.floor(Number(Array.isArray(item) ? item[1] : item.quantity) || 1)) * count
        }))
    };
}

export class BattleVictoryResolver {
    constructor(gameState) {
        if (!gameState || typeof gameState !== "object") throw new TypeError("BattleVictoryResolver requires game state.");
        this.gameState = gameState;
        if (!Array.isArray(this.gameState.resolvedBattleRewards)) this.gameState.resolvedBattleRewards = [];
    }

    resolve({ encounterId, enemyId = null, enemyCount = 1, mapId = null } = {}) {
        if (!encounterId) return { applied: false, reason: "missing-encounter" };
        const resolutionId = `battle-victory:${encounterId}`;
        if (this.gameState.resolvedBattleRewards.includes(resolutionId)) {
            return { applied: false, reason: "already-resolved", resolutionId };
        }

        const encounter = ENCOUNTER_DEFINITIONS[encounterId]
            || (enemyId ? { id: encounterId, enemyId, mapNodeId: mapId } : null);
        if (!encounter) throw new RangeError(`Unknown encounter id: ${encounterId}`);
        const monsterId = enemyId || encounter.enemyId;
        const monster = getMonsterDefinition(monsterId);
        const count = Math.max(1, Math.floor(Number(enemyCount) || 1));
        const rewards = {
            ...scaleMonsterRewards(monster.rewards || {}, count),
            ...(encounter.rewards || {}),
            experience: Math.max(0, Math.floor(Number(monster.expReward) || 0)) * count
        };
        const loot = new RewardResolver(this.gameState).apply(rewards);
        const quests = new QuestManager(this.gameState);
        const questEvents = [quests.handleEvent({
            type: "monster-defeated",
            eventId: resolutionId,
            encounterId,
            monsterId,
            count,
            mapId: mapId || encounter.mapNodeId
        })];
        for (const item of loot.items) {
            questEvents.push(quests.handleEvent({
                type: "item-acquired",
                eventId: `${resolutionId}:item:${item.id}`,
                encounterId,
                itemId: item.id,
                quantity: item.quantity,
                mapId: mapId || encounter.mapNodeId
            }));
        }
        this.gameState.resolvedBattleRewards.push(resolutionId);
        return { applied: true, resolutionId, loot, questEvents };
    }
}
