function finiteInteger(value, fallback = 0) {
    return Number.isFinite(value) ? Math.floor(value) : fallback;
}

export const COMBAT_HIT_CONFIG = Object.freeze({
    defaultCriticalChance: 0.1,
    criticalMultiplier: 1.5,
    fatalChanceRatio: 0.5,
    fatalMultiplier: 2,
    lowHpThreshold: 0.25,
    lowHpFatalChanceMultiplier: 2
});

function normalizeChance(value) {
    return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function rollChance(chance, randomSource = Math.random) {
    const sourceValue = typeof randomSource === "function" ? randomSource() : Math.random();
    const roll = Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(sourceValue) ? sourceValue : 0));
    return roll < normalizeChance(chance);
}

export function resolveHitType({
    criticalChance = COMBAT_HIT_CONFIG.defaultCriticalChance,
    targetHp,
    targetMaxHp,
    randomSource = Math.random,
    config = COMBAT_HIT_CONFIG
} = {}) {
    const normalizedCriticalChance = normalizeChance(criticalChance);
    const lowHp = Number.isFinite(targetHp) && Number.isFinite(targetMaxHp) && targetMaxHp > 0
        && targetHp / targetMaxHp <= config.lowHpThreshold;
    const baseFatalChance = normalizedCriticalChance * config.fatalChanceRatio;
    const fatalChance = Math.min(
        normalizedCriticalChance,
        baseFatalChance * (lowHp ? config.lowHpFatalChanceMultiplier : 1)
    );
    const sourceValue = typeof randomSource === "function" ? randomSource() : Math.random();
    const hitRoll = Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(sourceValue) ? sourceValue : 0));
    const hitType = hitRoll < fatalChance
        ? "fatal"
        : (hitRoll < normalizedCriticalChance ? "critical" : "normal");

    return {
        hitType,
        hitRoll,
        criticalChance: normalizedCriticalChance,
        fatalChance,
        lowHp,
        armorPiercing: hitType !== "normal",
        criticalMultiplier: hitType === "critical" ? config.criticalMultiplier : 1,
        fatalMultiplier: hitType === "fatal" ? config.fatalMultiplier : 1
    };
}

export function normalizeDamageRange(range) {
    const source = Array.isArray(range)
        ? { min: range[0], max: range[1] }
        : (range || {});
    const first = finiteInteger(source.min ?? source.minDamage, 0);
    const second = finiteInteger(source.max ?? source.maxDamage, first);
    return {
        min: Math.max(0, Math.min(first, second)),
        max: Math.max(0, Math.max(first, second))
    };
}

export function randomInt(minimum, maximum, randomSource = Math.random) {
    const range = normalizeDamageRange({ min: minimum, max: maximum });
    const randomValue = typeof randomSource === "function" ? randomSource() : Math.random();
    const boundedValue = Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(randomValue) ? randomValue : 0));
    return range.min + Math.floor(boundedValue * (range.max - range.min + 1));
}

export function rollDamage(damageRange, randomSource = Math.random) {
    const range = normalizeDamageRange(damageRange);
    return randomInt(range.min, range.max, randomSource);
}

export function resolveDamageRoll({
    damageRange,
    attackModifier = 0,
    attackMultiplier = 1,
    defense = 0,
    armorPiercing = false,
    criticalMultiplier = 1,
    fatalMultiplier = 1,
    statusMultiplier = 1,
    randomSource = Math.random
} = {}) {
    const rolledDamage = rollDamage(damageRange, randomSource);
    const attackAdjustedDamage = Math.max(0, Math.floor(
        (rolledDamage + finiteInteger(attackModifier, 0))
        * (Number.isFinite(attackMultiplier) ? attackMultiplier : 1)
    ));
    const appliedDefense = armorPiercing ? 0 : Math.max(0, finiteInteger(defense, 0));
    const defenseAdjustedDamage = Math.max(0, attackAdjustedDamage - appliedDefense);
    const criticalAdjustedDamage = Math.max(0, Math.floor(
        defenseAdjustedDamage * (Number.isFinite(criticalMultiplier) ? criticalMultiplier : 1)
    ));
    const fatalAdjustedDamage = Math.max(0, Math.floor(
        criticalAdjustedDamage * (Number.isFinite(fatalMultiplier) ? fatalMultiplier : 1)
    ));
    const finalDamage = Math.max(0, Math.floor(
        fatalAdjustedDamage * (Number.isFinite(statusMultiplier) ? statusMultiplier : 1)
    ));

    return {
        rolledDamage,
        attackAdjustedDamage,
        appliedDefense,
        defenseAdjustedDamage,
        criticalAdjustedDamage,
        fatalAdjustedDamage,
        finalDamage
    };
}
