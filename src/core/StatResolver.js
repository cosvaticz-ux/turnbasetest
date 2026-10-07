import { WEAPON_DEFINITIONS } from "../data/weapons.js";

export const CORE_STAT_KEYS = Object.freeze(["maxHp", "attack", "defense", "speed", "maxAp"]);

function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function addModifiers(target, modifiers = {}) {
    for (const key of CORE_STAT_KEYS) target[key] += finite(modifiers?.[key]);
}

function getEquipmentIds(equipment = {}) {
    return Object.values(equipment || {}).filter(id => typeof id === "string" && id);
}

export class StatResolver {
    constructor({ equipmentDefinitions = WEAPON_DEFINITIONS } = {}) {
        this.equipmentDefinitions = equipmentDefinitions;
    }

    resolve({
        baseStats = {},
        equipment = {},
        masteryModifiers = {},
        passiveModifiers = {},
        temporaryModifiers = {},
        statusEffects = []
    } = {}) {
        const stats = Object.fromEntries(CORE_STAT_KEYS.map(key => [key, finite(baseStats[key])]));

        for (const itemId of getEquipmentIds(equipment)) {
            addModifiers(stats, this.equipmentDefinitions[itemId]?.statModifiers);
        }
        addModifiers(stats, masteryModifiers);
        addModifiers(stats, passiveModifiers);
        addModifiers(stats, temporaryModifiers);
        for (const status of statusEffects || []) addModifiers(stats, status?.statModifiers);

        return Object.freeze({
            maxHp: Math.max(1, Math.floor(stats.maxHp)),
            attack: Math.max(0, Math.floor(stats.attack)),
            defense: Math.max(0, Math.floor(stats.defense)),
            speed: Math.max(0, Math.floor(stats.speed)),
            maxAp: Math.max(0, Math.floor(stats.maxAp))
        });
    }
}

export function resolveStats(source, options) {
    return new StatResolver(options).resolve(source);
}
