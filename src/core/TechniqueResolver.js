import { TECHNIQUE_DEFINITIONS } from "../data/techniques.js";
import { getEquippedWeapon } from "../data/weapons.js";

export const TECHNIQUE_STATE = Object.freeze({
    UNKNOWN: "unknown",
    KNOWN: "known",
    AVAILABLE: "available"
});

export class TechniqueResolver {
    constructor({ definitions = TECHNIQUE_DEFINITIONS, masteryManager = null } = {}) {
        this.definitions = definitions;
        this.masteryManager = masteryManager;
    }

    isKnown(member, techniqueId) {
        return Array.isArray(member?.knownTechniques) && member.knownTechniques.includes(techniqueId);
    }

    resolve(member, techniqueId, context = {}) {
        const definition = this.definitions[techniqueId];
        if (!definition || !this.isKnown(member, techniqueId)) {
            return { state: TECHNIQUE_STATE.UNKNOWN, known: false, available: false, reasons: ["Technique not learned"], definition };
        }

        const reasons = [];
        const weapon = getEquippedWeapon(member.equipment);
        if (definition.battleUsable === false && context.mode === "battle") reasons.push("Not usable in battle");
        if (definition.weaponTypes?.length && !definition.weaponTypes.includes(weapon.type)) {
            reasons.push(`Requires ${definition.weaponTypes.join(" / ")}`);
        }
        if (definition.damageRange && (!definition.element || definition.element === "physical")
            && weapon.requiresReload && member.classCombat?.loaded === false) reasons.push("Weapon must be loaded");
        if (weapon.allowedTechniques?.length && definition.weaponTypes?.length
            && !weapon.allowedTechniques.includes(techniqueId)) reasons.push(`${weapon.name} cannot use this technique`);
        for (const [discipline, level] of Object.entries(definition.masteryRequirements || {})) {
            const actual = this.masteryManager?.getLevel(member.id, discipline)
                ?? Math.max(1, Number(member.mastery?.[discipline]) || 1);
            if (actual < level) reasons.push(`Requires ${discipline} mastery ${level}`);
        }
        const activeStatuses = new Set((member.statusEffects || []).map(status => status?.id));
        for (const statusId of definition.blockedByStatuses || []) {
            if (activeStatuses.has(statusId)) reasons.push(`Blocked by ${statusId}`);
        }
        if (definition.contextRequirements?.storyOnly && context.mode !== "story") reasons.push("Story use only");
        if (definition.contextRequirements?.woundedAlly && context.party
            && !context.party.some(ally => Number(ally?.hp) > 0 && Number(ally.hp) < Number(ally.maxHp))) {
            reasons.push("No wounded ally");
        }
        if (!context.ignoreResourceCosts && Number(member.ap) < Number(definition.apCost || 0)) {
            reasons.push(`Requires ${definition.apCost} AP`);
        }

        return {
            state: reasons.length ? TECHNIQUE_STATE.KNOWN : TECHNIQUE_STATE.AVAILABLE,
            known: true,
            available: reasons.length === 0,
            reasons,
            definition,
            weapon
        };
    }

    getKnown(member) {
        return (member?.knownTechniques || []).map(id => this.definitions[id]).filter(Boolean);
    }

    getAvailable(member, context = {}) {
        return this.getKnown(member).filter(definition => this.resolve(member, definition.id, context).available);
    }
}
