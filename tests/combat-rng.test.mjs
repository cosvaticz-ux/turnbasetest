import assert from "node:assert/strict";
import {
    COMBAT_HIT_CONFIG,
    normalizeDamageRange,
    randomInt,
    resolveDamageRoll,
    resolveHitType,
    rollDamage
} from "../src/utils/RNG.js";

const samples = [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54, 0.63, 0.72, 0.99];
const attackResults = samples.map(value => resolveDamageRoll({
    damageRange: [10, 20],
    defense: 0,
    randomSource: () => value
}));
const rolls = attackResults.map(result => result.finalDamage);

assert.equal(rolls.length, 10, "ten representative attack rolls are executed");
assert.ok(rolls.every(value => value >= 10 && value <= 20), "10-20 damage range is inclusive and bounded");
assert.ok(new Set(rolls).size > 1, "damage results vary across the configured range");
assert.equal(randomInt(10, 20, () => 0), 10, "minimum is inclusive");
assert.equal(randomInt(10, 20, () => 1), 20, "maximum is inclusive");
assert.deepEqual(normalizeDamageRange([20, 10]), { min: 10, max: 20 }, "reversed ranges normalize safely");

const pipeline = resolveDamageRoll({
    damageRange: [20, 20],
    defense: 5,
    criticalMultiplier: 1.5,
    fatalMultiplier: 2,
    statusMultiplier: 0.5,
    randomSource: () => 0
});
assert.deepEqual(
    {
        roll: pipeline.rolledDamage,
        afterDefense: pipeline.defenseAdjustedDamage,
        afterCritical: pipeline.criticalAdjustedDamage,
        afterFatal: pipeline.fatalAdjustedDamage,
        final: pipeline.finalDamage
    },
    { roll: 20, afterDefense: 15, afterCritical: 22, afterFatal: 44, final: 22 },
    "shared damage pipeline preserves modifier order"
);

const forcedCritical = resolveHitType({ criticalChance: 1, targetHp: 100, targetMaxHp: 100, randomSource: () => 0.75 });
assert.equal(forcedCritical.hitType, "critical", "100% Critical Chance can force a normal Critical band");
assert.equal(forcedCritical.criticalMultiplier, 1.5, "Critical damage uses the established 150% multiplier");
assert.equal(forcedCritical.armorPiercing, true, "Critical hits are armor-piercing");

const forcedFatal = resolveHitType({ criticalChance: 1, targetHp: 100, targetMaxHp: 100, randomSource: () => 0.25 });
assert.equal(forcedFatal.hitType, "fatal", "Fatal occupies half of the configured Critical Chance");
assert.equal(forcedFatal.fatalMultiplier, 2, "Fatal damage uses the established 200% multiplier");

const normalHpRoll = resolveHitType({ criticalChance: 0.1, targetHp: 100, targetMaxHp: 100, randomSource: () => 0.075 });
const lowHpRoll = resolveHitType({ criticalChance: 0.1, targetHp: 20, targetMaxHp: 100, randomSource: () => 0.075 });
assert.equal(normalHpRoll.hitType, "critical", "the representative roll is outside normal-HP Fatal Chance");
assert.equal(lowHpRoll.hitType, "fatal", "low target HP increases Fatal Chance through centralized tuning");
assert.equal(lowHpRoll.fatalChance, COMBAT_HIT_CONFIG.defaultCriticalChance, "low-HP Fatal Chance remains bounded by Critical Chance");

const armorPiercingCritical = resolveDamageRoll({
    damageRange: [20, 20],
    defense: 5,
    armorPiercing: true,
    criticalMultiplier: 1.5,
    randomSource: () => 0
});
assert.deepEqual(
    { appliedDefense: armorPiercingCritical.appliedDefense, finalDamage: armorPiercingCritical.finalDamage },
    { appliedDefense: 0, finalDamage: 30 },
    "Critical armor piercing bypasses defense inside the shared damage pipeline"
);

console.log("Combat RNG, Critical, and Fatal assertions passed.");
