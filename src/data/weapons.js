const weapon = definition => Object.freeze({
    slot: "weapon",
    category: "equipment",
    inventoryType: "equipment",
    hands: 1,
    accuracyModifier: 0,
    critModifier: 0,
    armorInteraction: "standard",
    allowedTechniques: Object.freeze([]),
    traits: Object.freeze([]),
    statModifiers: Object.freeze({}),
    ...definition,
    damageRange: Object.freeze([...definition.damageRange]),
    allowedTechniques: Object.freeze([...(definition.allowedTechniques || [])]),
    traits: Object.freeze([...(definition.traits || [])]),
    statModifiers: Object.freeze({ ...(definition.statModifiers || {}) })
});

export const UNARMED_WEAPON = weapon({
    id: "unarmed",
    name: "Unarmed",
    type: "unarmed",
    damageRange: [10, 20],
    attackType: "blunt",
    element: "physical",
    masteryDiscipline: "unarmed",
    allowedTechniques: ["bash", "double-strike"],
    traits: ["natural"],
    description: "A reliable fallback when no weapon is equipped."
});

export const WEAPON_DEFINITIONS = Object.freeze({
    "soldier-crossbow": weapon({
        id: "soldier-crossbow", name: "Soldier Crossbow", type: "crossbow", hands: 2,
        damageRange: [12, 20], attackType: "projectile", element: "physical",
        masteryDiscipline: "crossbow", requiresReload: true, noise: "quiet",
        traits: ["ranged"], icon: "➶", description: "A controlled single-shot crossbow. Reload through Action or Prepare Turn."
    }),
    "traveler-sword": weapon({
        id: "traveler-sword", name: "Traveler Sword", type: "sword", hands: 1,
        damageRange: [10, 20], attackType: "slash", element: "physical",
        masteryDiscipline: "sword", critModifier: 0.02,
        armorInteraction: "standard", allowedTechniques: ["double-strike"],
        traits: ["balanced"], statModifiers: { attack: 1 },
        icon: "⚔", description: "A balanced road sword with a dependable edge."
    }),
    "iron-greatsword": weapon({
        id: "iron-greatsword", name: "Iron Greatsword", type: "greatsword", hands: 2,
        damageRange: [15, 24], attackType: "slash", element: "physical",
        masteryDiscipline: "greatsword", accuracyModifier: -0.05, critModifier: 0.04,
        armorInteraction: "heavy", allowedTechniques: ["bash"], traits: ["heavy"],
        statModifiers: { attack: 3, speed: -1 }, icon: "⚔",
        description: "A heavy two-handed blade that trades speed for force."
    }),
    "ash-spear": weapon({
        id: "ash-spear", name: "Ash Spear", type: "spear", hands: 2,
        damageRange: [11, 19], attackType: "pierce", element: "physical",
        masteryDiscipline: "spear", accuracyModifier: 0.05,
        armorInteraction: "piercing", allowedTechniques: ["double-strike"],
        traits: ["reach"], statModifiers: { speed: 1 }, icon: "⚔",
        description: "A long ash-wood spear built for controlled thrusts."
    }),
    "woodsman-axe": weapon({
        id: "woodsman-axe", name: "Woodsman Axe", type: "axe", hands: 1,
        damageRange: [13, 22], attackType: "slash", element: "physical",
        masteryDiscipline: "axe", accuracyModifier: -0.03, critModifier: 0.03,
        armorInteraction: "cleaving", allowedTechniques: ["bash"], traits: ["cleave"],
        statModifiers: { attack: 2 }, icon: "⚔",
        description: "A practical axe with enough weight to split light armor."
    }),
    "yew-bow": weapon({
        id: "yew-bow", name: "Yew Bow", type: "bow", hands: 2,
        damageRange: [9, 18], attackType: "projectile", element: "physical",
        masteryDiscipline: "bow", accuracyModifier: 0.08,
        armorInteraction: "ranged", allowedTechniques: [], traits: ["ranged"],
        statModifiers: { speed: 1 }, icon: "➶",
        description: "A compact hunting bow for precise ranged pressure."
    }),
    "prototype-firearm": weapon({
        id: "prototype-firearm", name: "Prototype Firearm", type: "firearm", hands: 2,
        damageRange: [18, 28], attackType: "projectile", element: "physical",
        masteryDiscipline: "firearm", accuracyModifier: -0.08, critModifier: 0.06, requiresReload: true, noise: "loud",
        armorInteraction: "ballistic", allowedTechniques: [], traits: ["future-content", "loud"],
        icon: "◇", description: "An early single-shot firearm. Powerful, loud and dependent on reload."
    })
});

export function getEquippedWeapon(equipment = {}) {
    return WEAPON_DEFINITIONS[equipment?.weapon] || UNARMED_WEAPON;
}

export function createWeaponAttackProfile(equipment = {}) {
    const equipped = getEquippedWeapon(equipment);
    return Object.freeze({
        id: `basic:${equipped.id}`,
        name: equipped.type === "unarmed" ? "Attack" : `Attack · ${equipped.name}`,
        apCost: 0,
        damageRange: equipped.damageRange,
        attackType: equipped.attackType,
        element: equipped.element,
        masteryDiscipline: equipped.masteryDiscipline,
        accuracyModifier: equipped.accuracyModifier,
        critModifier: equipped.critModifier,
        armorInteraction: equipped.armorInteraction,
        weaponId: equipped.id,
        weaponType: equipped.type,
        noise: equipped.noise || null
    });
}
