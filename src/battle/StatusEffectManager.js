export class StatusEffectManager {
    apply(entity, status) {
        if (!entity || !status?.id) return false;
        if (!Array.isArray(entity.statusEffects)) entity.statusEffects = [];
        const existingIndex = entity.statusEffects.findIndex(activeStatus => activeStatus.id === status.id);
        const nextStatus = { ...status };
        if (existingIndex >= 0) entity.statusEffects[existingIndex] = nextStatus;
        else entity.statusEffects.push(nextStatus);
        return true;
    }

    remove(entity, statusId) {
        if (!Array.isArray(entity?.statusEffects)) return false;
        const previousLength = entity.statusEffects.length;
        entity.statusEffects = entity.statusEffects.filter(status => status.id !== statusId);
        return entity.statusEffects.length !== previousLength;
    }

    getStatuses(entity) {
        const statuses = Array.isArray(entity?.statusEffects)
            ? entity.statusEffects.filter(Boolean).map(status => ({ ...status }))
            : [];
        if (entity?.isGuarding) {
            statuses.push({
                id: "guard",
                name: "Guard",
                modifierText: "Damage received reduced by 50%",
                remainingTurns: 1
            });
        }
        if (entity?.poisonTurns > 0) {
            statuses.push({
                id: "poison",
                name: "Poison",
                damagePerTurn: entity.poisonDamage,
                remainingTurns: entity.poisonTurns,
                description: "Takes poison damage at the end of each enemy-side turn."
            });
        }
        return statuses;
    }

    applyPoison(entity, { damage, duration }) {
        if (!entity?.isAlive?.()) return false;
        entity.poisonDamage = damage;
        entity.poisonTurns = duration;
        return true;
    }

    tickDamageOverTime(entities) {
        const events = [];
        for (const entity of entities.filter(candidate => candidate?.isAlive?.())) {
            for (const status of entity.statusEffects || []) {
                if (!status.damagePerTurn || entity.hp <= 0) continue;
                const damage = Math.min(entity.hp, status.damagePerTurn);
                entity.hp -= damage;
                events.push({ entity, statusId: status.id, damage, remainingTurns: status.remainingTurns });
            }
            if (entity.poisonTurns <= 0) continue;
            const damage = Math.min(entity.hp, entity.poisonDamage);
            entity.hp = Math.max(0, entity.hp - damage);
            entity.poisonTurns = Math.max(0, entity.poisonTurns - 1);
            events.push({ entity, statusId: "poison", damage, remainingTurns: entity.poisonTurns });
        }
        return events;
    }

    tickDurations(entities) {
        const expired = [];
        for (const entity of entities.filter(Boolean)) {
            if (!Array.isArray(entity.statusEffects)) continue;
            for (const status of entity.statusEffects) {
                if (status.pending) continue;
                if (!Number.isFinite(status.remainingTurns)) continue;
                status.remainingTurns = Math.max(0, status.remainingTurns - 1);
                if (status.remainingTurns === 0) expired.push({ entity, statusId: status.id });
            }
            entity.statusEffects = entity.statusEffects.filter(status => status.remainingTurns !== 0);
        }
        return expired;
    }
}
