import { COMBAT_HIT_CONFIG, resolveDamageRoll, resolveHitType } from "../utils/RNG.js";

export { COMBAT_HIT_CONFIG } from "../utils/RNG.js";

export function resolvePropertyMultiplier(target, profile = {}) {
    const element = profile.element || "physical";
    const attackType = profile.attackType || null;
    const resistances = target?.properties?.resistances || {};
    let multiplier = Math.max(0, Number(resistances[element]) || 1);
    if (attackType && Number.isFinite(Number(resistances[attackType]))) {
        multiplier *= Math.max(0, Number(resistances[attackType]));
    }
    const statuses = Array.isArray(target?.statusEffects) ? target.statusEffects : [];
    for (const status of statuses) {
        const interaction = target?.properties?.statusInteractions?.[status?.id];
        if (interaction && Number.isFinite(Number(interaction[element]))) {
            multiplier *= Math.max(0, Number(interaction[element]));
        }
    }
    return multiplier;
}

export function resolveCombatDamage({ attacker, target, profile, statusMultiplier = 1, randomSource = Math.random } = {}) {
    if (!target?.isAlive?.() || !profile?.damageRange) {
        return { rolledDamage: 0, finalDamage: 0, appliedDamage: 0, hitType: "normal" };
    }
    // Legacy attacks retain their RNG sequence. Accuracy is opt-in for class
    // attacks and reload weapons, including independent rolls for each hit.
    if (Number.isFinite(profile.accuracy) && profile.accuracy < 1 && randomSource() >= Math.max(0, profile.accuracy)) {
        return { rolledDamage: 0, finalDamage: 0, appliedDamage: 0, hitType: "miss" };
    }
    const hitResult = resolveHitType({
        criticalChance: Math.max(0, Math.min(1,
            Number(attacker?.criticalChance ?? COMBAT_HIT_CONFIG.defaultCriticalChance)
            + (Number(profile.critModifier) || 0)
        )),
        targetHp: target.hp,
        targetMaxHp: target.maxHp,
        randomSource
    });
    const damageResult = resolveDamageRoll({
        damageRange: profile.damageRange,
        attackModifier: Number.isFinite(Number(profile.attackModifier))
            ? Number(profile.attackModifier)
            : Math.max(0, Math.floor(((Number(attacker?.attack) || 20) - 20) * 0.5)),
        attackMultiplier: profile.attackMultiplier || 1,
        defense: profile.ignoresDefense ? 0 : Math.floor((
            profile.armorInteraction === "piercing"
                ? Math.floor((Number(target.defense) || 0) * 0.5)
                : target.defense
        ) * (Number(profile.targetDefenseMultiplier) || 1) * (1 - Math.min(1, Math.max(0, Number(profile.armorPenetration) || 0)))),
        armorPiercing: profile.ignoresDefense || hitResult.armorPiercing,
        criticalMultiplier: hitResult.criticalMultiplier * (hitResult.hitType === "critical" ? 1 + (profile.criticalDamageBonus || 0) : 1),
        fatalMultiplier: hitResult.fatalMultiplier,
        statusMultiplier,
        randomSource
    });
    return {
        ...damageResult,
        ...hitResult,
        appliedDamage: Math.min(target.hp, damageResult.finalDamage)
    };
}

export function applyResolvedDamage(target, result) {
    let damage = Math.min(target?.hp || 0, Math.max(0, result?.appliedDamage || 0));
    if (target?.classCombat?.survival && damage >= target.hp && target.hp > 0 && !result.overkill && !result.isOverkill) {
        damage = Math.max(0, target.hp - 1);
        delete target.classCombat.survival;
    }
    if (target) target.hp = Math.max(0, target.hp - damage);
    return { ...result, finalDamage: damage, appliedDamage: damage };
}

export function hitFeedbackSuffix(hitType) {
    if (hitType === "fatal") return " FATAL!";
    if (hitType === "critical") return " CRITICAL!";
    return "";
}
