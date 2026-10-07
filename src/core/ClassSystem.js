import { CLASS_DEFINITIONS } from "../data/classes.js";
import { CLASS_SKILLS, CLASS_BALANCE, AMMUNITION } from "../data/classSkills.js";
import { getEquippedWeapon } from "../data/weapons.js";
import { RANK_ORDER } from "./Progression.js";

const unique = value => [...new Set(Array.isArray(value) ? value.filter(id => typeof id === "string") : [])];
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function normalizeClassState(source = {}) {
    const state = source.classState || {};
    const unlockedClasses = unique(["infantry", "archer", "magician", ...unique(state.unlockedClasses)]).filter(id => Object.hasOwn(CLASS_DEFINITIONS,id));
    const currentClass = unlockedClasses.includes(state.currentClass) ? state.currentClass : "infantry";
    const skillMastery = Object.fromEntries(Object.entries(state.skillMastery || {}).filter(([id]) => Object.hasOwn(CLASS_SKILLS,id)).map(([id, tier]) => [id, Math.max(1, Math.min(3, Math.floor(number(tier))))]));
    const ownedSkills = unique([...unique(state.ownedSkills), ...CLASS_DEFINITIONS[currentClass].skillIds]).filter(id => Object.hasOwn(CLASS_SKILLS,id));
    for (const id of ownedSkills) skillMastery[id] ||= 1;
    return {
        currentClass, unlockedClasses, ownedSkills, skillMastery,
        unlocks: unique(state.unlocks),
        selectedElement: CLASS_BALANCE.elements.includes(state.selectedElement) ? state.selectedElement : "fire",
        ammoId: Object.hasOwn(AMMUNITION,state.ammoId) ? state.ammoId : "standard"
    };
}
export function ensureClassState(member) {
    if (!member.classState) member.classState = normalizeClassState(member);
    return member.classState;
}
export function getSkillTier(member, id) {
    const state = ensureClassState(member);
    const practice = number(member.mastery?.[`technique:${id}`]);
    const earned = CLASS_BALANCE.skillThresholds.filter(threshold => practice >= threshold).length;
    return Math.min(3, Math.max(1, earned, number(state.skillMastery[id])));
}
export function getActiveClassSkills(member) {
    return CLASS_DEFINITIONS[ensureClassState(member).currentClass].skillIds.map(id => CLASS_SKILLS[id]);
}
export function getPassiveValues(member, id) {
    if (!member?.classState || !getActiveClassSkills(member).some(skill => skill.id === id)) return {};
    return CLASS_SKILLS[id].tiers[getSkillTier(member, id) - 1];
}
export function getClassStatModifiers(member, baseStats) {
    const skills = getActiveClassSkills(member).filter(skill => skill.type === "passive");
    return skills.reduce((modifiers, skill) => {
        const tier = skill.tiers[getSkillTier(member, skill.id) - 1];
        modifiers.maxHp += Math.floor((baseStats.maxHp || 0) * (tier.maxHpBonus || 0));
        modifiers.defense += Math.floor((baseStats.defense || 0) * (tier.defenseBonus || 0));
        return modifiers;
    }, { maxHp: 0, defense: 0 });
}

// Requirements consume existing global rank, quests, flags and reputation. World
// sources can also grant a character-specific unlock token without inventing lore.
export class ClassSystem {
    constructor(gameState = {}) { this.gameState = gameState; }
    evaluate(member, requirement) {
        if (requirement.all) return requirement.all.every(entry => this.evaluate(member, entry));
        if (requirement.any) return requirement.any.some(entry => this.evaluate(member, entry));
        const state = ensureClassState(member), world = this.gameState;
        const evaluators = {
            class: () => state.unlockedClasses.includes(requirement.id),
            mastery: () => number(member.mastery?.[requirement.id]) >= requirement.amount,
            technique: () => number(member.mastery?.[`technique:${requirement.id}`]) >= requirement.amount,
            unlock: () => state.unlocks.includes(requirement.id) || world.story?.flags?.[requirement.id] === true,
            flag: () => world.story?.flags?.[requirement.id] === true,
            quest: () => ["complete", "completed", "claimed"].includes(world.quests?.[requirement.id]?.state) || world.quests?.[requirement.id]?.rewarded === true,
            reputation: () => number(world.reputation?.[requirement.id]) >= requirement.amount,
            rank: () => RANK_ORDER.indexOf(world.rank?.current || world.story?.rank || "F") >= RANK_ORDER.indexOf(requirement.id) && RANK_ORDER.includes(requirement.id),
            knowledge: () => world.knowledge?.includes(requirement.id) === true
        };
        return evaluators[requirement.kind]?.() === true;
    }
    describe(requirement) {
        if (requirement.any) return `(${requirement.any.map(entry => this.describe(entry)).join(" OR ")})`;
        if (requirement.all) return requirement.all.map(entry => this.describe(entry)).join(" AND ");
        return requirement.label || `${requirement.kind}: ${CLASS_DEFINITIONS[requirement.id]?.name || requirement.id}${requirement.amount ? ` ${requirement.amount}` : ""}`;
    }
    getClassRequirements(member, classId) {
        return (CLASS_DEFINITIONS[classId]?.unlockRequirements || []).map(requirement => ({ requirement, label: this.describe(requirement), met: this.evaluate(member, requirement) }));
    }
    canChangeClass(member, classId, { inBattle = false } = {}) {
        if (!member || !Object.hasOwn(CLASS_DEFINITIONS,classId)) return { allowed: false, reason: "Unknown class or character" };
        if (inBattle || member.classCombat) return { allowed: false, reason: "Change class outside battle" };
        const requirements = this.getClassRequirements(member, classId);
        const allowed = ensureClassState(member).unlockedClasses.includes(classId) || requirements.every(entry => entry.met);
        return { allowed, requirements, reason: allowed ? "" : requirements.filter(entry => !entry.met).map(entry => entry.label).join("; ") };
    }
    changeClass(member, classId, context) {
        const check = this.canChangeClass(member, classId, context);
        if (!check.allowed) return { changed: false, ...check };
        const state = ensureClassState(member);
        state.currentClass = classId;
        if (!state.unlockedClasses.includes(classId)) state.unlockedClasses.push(classId);
        for (const id of CLASS_DEFINITIONS[classId].skillIds) {
            if (!state.ownedSkills.includes(id)) state.ownedSkills.push(id);
            state.skillMastery[id] ||= 1;
        }
        return { changed: true, ...check };
    }
    grantUnlock(member, token) {
        if (!member || typeof token !== "string") return false;
        const state = ensureClassState(member);
        if (!state.unlocks.includes(token)) state.unlocks.push(token);
        return true;
    }
    selectElement(member, element) {
        if (!CLASS_BALANCE.elements.includes(element)) return false;
        ensureClassState(member).selectedElement = element;
        return true;
    }
    selectAmmo(member, ammoId) {
        const ammo = AMMUNITION[ammoId], weapon = getEquippedWeapon(member.equipment);
        if (!ammo || !ammo.weaponTypes.includes(weapon.type) || (getPassiveValues(member, "special-ammunition").ammoTier || 0) < ammo.tier) return false;
        ensureClassState(member).ammoId = ammoId;
        return true;
    }
}
