import { PREPARE_ACTION_DEFINITIONS } from "../data/prepareActions.js";
import { STATUS_EFFECT_DEFINITIONS } from "../data/statusEffects.js";

function isLiving(entity) {
    return typeof entity?.isAlive === "function" ? entity.isAlive() : Number(entity?.hp) > 0;
}

function matchesEnemyDefinition(entity, definitionId) {
    return entity?.definitionId === definitionId
        || entity?.id === definitionId
        || entity?.id?.startsWith?.(`${definitionId}-`);
}

export function getPrepareItemEntries(items = []) {
    return items.filter(item => item?.battleUsable === true
        && item.prepareOnly === true
        && (item.quantity ?? 1) > 0);
}

export function getNormalBattleItemEntries(items = []) {
    return items.filter(item => item?.battleUsable === true
        && item.prepareOnly !== true
        && (item.quantity ?? 1) > 0);
}

export class PreparePhaseManager {
    constructor({
        definitions = PREPARE_ACTION_DEFINITIONS,
        statusDefinitions = STATUS_EFFECT_DEFINITIONS,
        statusEffectManager = null
    } = {}) {
        this.definitions = definitions;
        this.statusDefinitions = statusDefinitions;
        this.statusEffectManager = statusEffectManager;
    }

    getCommands({ battleItems = [], enemies = [] } = {}) {
        const prepareItems = getPrepareItemEntries(battleItems);
        return this.definitions.flatMap(definition => {
            if (!definition.itemAction) return [{ ...definition, enabled: true, item: null }];

            const item = prepareItems.find(entry => entry.prepareActionId === definition.id);
            if (!item) return [];
            const hasValidTarget = enemies.some(enemy => (
                isLiving(enemy) && matchesEnemyDefinition(enemy, definition.targetDefinitionId)
            ));
            return [{ ...definition, enabled: hasValidTarget, item }];
        });
    }

    execute(actionId, { party = [], enemies = [], battleItems = [] } = {}) {
        const command = this.getCommands({ battleItems, enemies }).find(entry => entry.id === actionId);
        if (!command || !command.enabled) return { executed: false, actionId };

        switch (command.resolver) {
            case "focus":
                for (const member of party.filter(isLiving)) {
                    member.ap = Math.min(member.maxAp, member.ap + 1);
                }
                break;
            case "scatter-salt": {
                const targets = enemies.filter(enemy => (
                    isLiving(enemy) && matchesEnemyDefinition(enemy, command.targetDefinitionId)
                ));
                if (!command.item || targets.length === 0 || !this.statusEffectManager) {
                    return { executed: false, actionId };
                }
                const status = this.statusDefinitions[command.item.statusEffectId];
                if (!status) return { executed: false, actionId };
                command.item.quantity = Math.max(0, command.item.quantity - 1);
                for (const target of targets) this.statusEffectManager.apply(target, status);
                break;
            }
            case "begin-battle":
                break;
            default:
                return { executed: false, actionId };
        }

        return {
            executed: true,
            actionId,
            logMessage: command.logMessage || ""
        };
    }
}
