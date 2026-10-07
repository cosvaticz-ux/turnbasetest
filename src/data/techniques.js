const technique = definition => Object.freeze({
    masteryRequirements: Object.freeze({}),
    weaponTypes: Object.freeze([]),
    blockedByStatuses: Object.freeze([]),
    contextRequirements: Object.freeze({}),
    ...definition,
    masteryRequirements: Object.freeze({ ...(definition.masteryRequirements || {}) }),
    weaponTypes: Object.freeze([...(definition.weaponTypes || [])]),
    blockedByStatuses: Object.freeze([...(definition.blockedByStatuses || [])]),
    contextRequirements: Object.freeze({ ...(definition.contextRequirements || {}) })
});

export const TECHNIQUE_DEFINITIONS = Object.freeze({
    "quick-strike": technique({ id: "quick-strike", name: "Quick Strike", icon: "›", apCost: 0, targetType: "enemy", damageRange: [7, 11], attackMultiplier: 0.8, animationType: "punch", hitCount: 1, masteryDiscipline: "equipped-weapon" }),
    "guard-stance": technique({ id: "guard-stance", name: "Guard Stance", icon: "◇", apCost: 1, targetType: "self", activeEffect: "guard-stance", animationType: "guard", canUse: ({ player } = {}) => !player?.isGuarding }),
    "power-strike": technique({ id: "power-strike", name: "Power Strike", icon: "◆", apCost: 2, targetType: "enemy", damageRange: [15, 22], attackMultiplier: 1.45, animationType: "punch", hitCount: 1, masteryDiscipline: "equipped-weapon" }),
    "armor-break": technique({ id: "armor-break", name: "Armor Break", icon: "◈", apCost: 2, targetType: "enemy", damageRange: [10, 16], attackMultiplier: 1.05, animationType: "punch", hitCount: 1, onHitEffect: "armor-break", masteryDiscipline: "equipped-weapon" }),
    "second-wind": technique({ id: "second-wind", name: "Second Wind", icon: "+", apCost: 1, targetType: "self", activeEffect: "second-wind", animationType: "cast", canUse: ({ player } = {}) => Boolean(player && player.hp < player.maxHp && !player.secondWindUsed), disabledReason: "Requires missing HP and can be used once per battle" }),
    "precision-strike": technique({ id: "precision-strike", name: "Precision Strike", icon: "◎", apCost: 2, targetType: "enemy", damageRange: [12, 18], attackMultiplier: 1.15, critModifier: 0.2, armorInteraction: "piercing", animationType: "punch", hitCount: 1, masteryDiscipline: "equipped-weapon" }),
    "double-strike": technique({
        id: "double-strike", name: "Double Strike", icon: "✦",
        iconImage: "assets/images/ui/icon/icon-skill-doublestrike.png", apCost: 2,
        targetType: "enemy", damageRange: [8, 16], attackMultiplier: 0.7,
        animationType: "punch", hitCount: 2, animationFrameDurationMs: 18,
        hitGapMs: 15, rapidCombo: true, screenShakeIntensity: 4,
        screenShakeDurationMs: 150, weaponTypes: ["unarmed", "sword", "spear"],
        masteryDiscipline: "equipped-weapon"
    }),
    bash: technique({
        id: "bash", name: "Bash", icon: "◆",
        iconImage: "assets/images/ui/icon/icon-skill-bash.png", apCost: 1,
        targetType: "enemy", damageRange: [8, 16], attackMultiplier: 1.2,
        animationType: "punch", hitCount: 1, screenShakeIntensity: 8,
        screenShakeDurationMs: 230, weaponTypes: ["unarmed", "greatsword", "axe"],
        masteryDiscipline: "equipped-weapon"
    }),
    fireball: technique({
        id: "fireball", name: "Fire Ball", icon: "✦", effectId: "fire-heavy",
        iconImage: "assets/images/ui/icon/icon-skill-frieball.png", apCost: 2,
        targetType: "all-enemies", damageRange: [25, 25], attackMultiplier: 1.5,
        ignoresDefense: true, assetId: "fireball", animationId: "fireball",
        audioId: "fireball", element: "fire", source: "story",
        masteryDiscipline: "structuredMagic"
    }),
    heal: technique({
        id: "heal", name: "Heal", icon: "✚", apCost: 1, effectId: "heal",
        targetType: "all-allies", healRange: [20, 30], animationType: "cast", magic: true,
        contextRequirements: { woundedAlly: true }, masteryDiscipline: "restoration",
        canUse: ({ party = [] } = {}) => party.some(member => member?.isAlive?.() && member.hp < member.maxHp),
        disabledReason: "Party HP is already full"
    }),
    "ice-pike": technique({
        id: "ice-pike", name: "Ice Pike", icon: "❄", effectId: "ice",
        iconImage: "assets/images/ui/icon/icon-skill-ice.png", apCost: 1,
        targetType: "enemy", damageRange: [15, 15], ignoresDefense: true,
        assetId: "ice-pike", animationId: "ice-pike", audioId: "ice-pike",
        element: "ice", source: "character", masteryDiscipline: "structuredMagic"
    }),
    poison: technique({
        id: "poison", name: "Poison", icon: "☠", effectId: "poison",
        iconImage: "assets/images/ui/icon/icon-skill-poision.png", apCost: 1,
        targetType: "enemy", damageRange: [5, 5], ignoresDefense: true,
        assetId: "poison", animationId: "poison", audioId: "poison",
        statusEffectId: "poison", poisonDamage: 5, duration: 3,
        element: "poison", source: "character", masteryDiscipline: "mixedMagic"
    }),
    "fulitas-lighting": technique({
        id: "fulitas-lighting", name: "Fulitas Lighting", icon: "✧", apCost: 0,
        targetType: "story", source: "story", battleUsable: false,
        contextRequirements: { storyOnly: true }, masteryDiscipline: "structuredMagic"
    })
});
