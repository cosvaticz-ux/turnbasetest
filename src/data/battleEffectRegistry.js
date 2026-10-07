import { getBattleVfx } from "./battleVfx.js";

const effect = (vfx, sfx = "punchImpact", extra = {}) => Object.freeze({
    vfx,
    sfx,
    sfxTiming: "impact",
    ...extra
});
// Weapon-specific audio can be supplied here when those assets exist.
export const BATTLE_EFFECTS = Object.freeze({
    impact: effect("impact"),
    slash: effect("impact"),
    "slash-heavy": effect("impact-heavy"),
    pierce: effect("impact"),
    blunt: effect("impact-heavy"),
    unarmed: effect("impact"),
    bow: effect("impact"),
    crossbow: effect("impact"),
    firearm: effect("impact-heavy"),
    magic: effect("impact"),
    fire: effect("fire", "skillFireball", { sfxTiming: "start" }),
    "fire-heavy": effect("fire-heavy", "skillFireball", { sfxTiming: "start" }),
    ice: effect("ice", "skillIcePike", { sfxTiming: "start" }),
    poison: effect("poison-hit", "skillPoison", { sfxTiming: "start" }),
    "poison-tick": effect("poison", "skillPoisonTick"),
    heal: effect("heal", "menuConfirm"),
    buff: effect("heal", "guard"),
    debuff: effect(null, "guard"),
    bleed: effect("impact"),
    burn: effect("fire", "skillFireball"),
    stun: effect("impact-heavy", "guard"),
    slow: effect("ice", "skillIcePike"),
    curse: effect(null, "guard"),
    cleanse: effect("heal", "menuConfirm"),
    guard: effect(null, "guard"),
    counter: effect("impact-heavy"),
    miss: effect(null, "punchWhoosh")
});

const WEAPON_EFFECTS = Object.freeze({ sword: "slash", greatsword: "slash-heavy", axe: "slash-heavy", mace: "blunt", spear: "pierce", bow: "bow", crossbow: "crossbow", firearm: "firearm", unarmed: "unarmed", staff: "magic" });
const SKILL_EFFECTS = Object.freeze({ fireball: "fire", "ice-pike": "ice", poison: "poison" });

export function resolveBattleEffect(event = {}) {
    const id = event.hitType === "miss" ? "miss" :
        event.effectId || event.skill?.effectId || SKILL_EFFECTS[event.skillId] ||
        (BATTLE_EFFECTS[event.element] ? event.element : null) ||
        (event.type !== "damage" && BATTLE_EFFECTS[event.type] ? event.type : null) ||
        WEAPON_EFFECTS[event.weapon?.type] || event.damageType || "impact";
    const base = BATTLE_EFFECTS[id] || BATTLE_EFFECTS.impact;
    const heavy = event.hitType === "critical" || event.hitType === "fatal";
    return {
        id: BATTLE_EFFECTS[id] ? id : "impact",
        ...base,
        vfx: heavy && base.vfx === "impact" ? "impact-heavy" : base.vfx,
        volume: heavy ? (event.hitType === "fatal" ? 0.52 : 0.44) : undefined,
        shake: heavy ? { intensity: event.hitType === "fatal" ? 7 : 4, durationMs: 160 } : null,
        suppressGenericImpact: event.suppressGenericImpact ?? base.vfx !== "impact"
    };
}

export function getEffectTiming(definition = {}, layout = {}, overrides = {}) {
    const frames = Math.max(1, Math.floor(layout.frames || definition.atlas?.frames || 1));
    const config = { ...definition, ...overrides };
    const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
    const frameDurationMs = positive(config.frameDurationMs) ? Number(config.frameDurationMs)
        : positive(config.fps) ? 1000 / Number(config.fps)
        : (positive(config.durationMs) ? Number(config.durationMs) : 300) / frames;
    const durationMs = frames * frameDurationMs;
    // impactFrame is one-based, matching authored sprite-sheet frame numbers.
    const impactTimeMs = Number.isFinite(config.impactTimeMs) ? config.impactTimeMs
        : (Math.max(1, Number(config.impactFrame) || 1) - 1) * frameDurationMs;
    return { frameDurationMs, durationMs, impactTimeMs: Math.max(0, Math.min(durationMs, impactTimeMs)) };
}

export function getEffectVfxDefinition(event) {
    return getBattleVfx(resolveBattleEffect(event).vfx);
}
