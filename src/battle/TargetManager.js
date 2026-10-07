import { moveTargetIndex, moveTargetSpatially } from "./BattleFormation.js";

export function selectEnemyActionTarget({
    targets = [],
    action = {},
    forcedTargetId = null,
    randomSource = Math.random
} = {}) {
    const validTargets = targets.filter(target => target?.isAlive?.() && target.targetable !== false);
    if (validTargets.length === 0) return null;

    const explicitSelection = typeof action.selectTarget === "function"
        ? action.selectTarget([...validTargets])
        : action.targetId;
    const explicitTargetId = typeof explicitSelection === "object" ? explicitSelection?.id : explicitSelection;
    const explicitTarget = validTargets.find(target => target.id === explicitTargetId);
    if (explicitTarget) return explicitTarget;

    const forcedTarget = validTargets.find(target => target.id === forcedTargetId);
    if (forcedTarget) return forcedTarget;
    if (validTargets.length === 1) return validTargets[0];

    const roll = Math.max(0, Math.min(0.999999, Number(randomSource?.()) || 0));
    return validTargets[Math.floor(roll * validTargets.length)];
}

export class TargetManager {
    constructor(entities = [], getPosition = entity => entity) {
        this.entities = entities;
        this.getPosition = getPosition;
        this.selectedTargetId = null;
        this.selection = null;
    }

    reset(entities = this.entities) {
        this.entities = entities;
        this.selectedTargetId = entities.find(entity => entity?.isAlive?.())?.id || null;
        this.selection = null;
    }

    getSelected() {
        return this.entities.find(entity => entity.id === this.selectedTargetId && entity.isAlive()) || null;
    }

    begin(action, actorId) {
        const living = this.entities.filter(entity => entity?.isAlive?.());
        if (!action || living.length === 0) return false;
        if (!living.some(entity => entity.id === this.selectedTargetId)) this.selectedTargetId = living[0].id;
        this.selection = { ...action, actorId };
        return true;
    }

    changeLinear(direction) {
        const index = moveTargetIndex(this.entities, this.selectedTargetId, direction);
        if (index < 0) return false;
        this.selectedTargetId = this.entities[index].id;
        return true;
    }

    changeSpatial(direction) {
        const index = moveTargetSpatially(this.entities, this.selectedTargetId, direction, this.getPosition);
        if (index < 0) return false;
        this.selectedTargetId = this.entities[index].id;
        return true;
    }

    select(entityId) {
        const target = this.entities.find(entity => entity.id === entityId && entity.isAlive());
        if (!target) return false;
        this.selectedTargetId = target.id;
        return true;
    }

    cancel() {
        this.selection = null;
    }
}
