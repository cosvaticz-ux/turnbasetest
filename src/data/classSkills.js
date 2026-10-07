// First-pass balance table. Multipliers are ratios; chances are 0..1.
const tiers = values => values.map(value => Object.freeze(value));
const active = (id, name, description, values, options = {}) => ({
    id, name, description, type: "active", maxMastery: 3, targetType: "enemy",
    apCost: 1, icon: "✦", hitCount: 1, element: "physical", effectId: options.magic ? "magic" : null, ...options, tiers: tiers(values)
});
const damage = (id, name, values, options = {}) => active(id, name,
    options.description || `${name}: weapon-scaled damage with technique mastery.`,
    values.map(damageMultiplier => ({ damageMultiplier })), options);
const passive = (id, name, description, values, options = {}) => active(id, name, description, values, { ...options, type: "passive", apCost: 0, targetType: "self" });
const setup = (id, name, description, effect, values, options = {}) => active(id, name, description, values, { targetType: "self", effect, effectId: ({ heal: "heal", prayer: "heal", cleanse: "cleanse" })[effect] || "buff", ...options });
const bow = { weaponTypes: ["bow"] };
const gun = { weaponTypes: ["crossbow", "firearm"], requiresLoaded: true };
const magic = { element: "neutral", magic: true, masteryDiscipline: "structuredMagic" };
const supernatural = ["undead", "demon", "cursed", "corrupted"];

export const CLASS_SKILLS = Object.freeze(Object.fromEntries([
    passive("sword-mastery", "Sword Mastery", "Sword damage improves with fundamentals.", [.05,.1,.15].map(weaponDamage => ({ weaponDamage })), { weaponTypes: ["sword", "greatsword"] }),
    damage("twin-strike", "Twin Strike", [1.1,1.3,1.5], { weaponTypes: ["greatsword"], description: "A committed two-hand sword technique." }),
    damage("smash", "Smash", [2.5,2.7,3], { weaponTypes: ["axe"], accuracyModifier: -.2, apCost: 2 }),
    setup("counter-stance", "Counter Stance", "Counter the next physical attack this round.", "stance", [.8,.9,1].map(counter => ({ counter, duration: 1 }))),
    passive("combat-training", "Combat Training", "Fundamental conditioning increases maximum HP.", [.1,.2,.3].map(maxHpBonus => ({ maxHpBonus }))),
    active("heavy-blow", "Heavy Blow", "Heavy strike; tier III deals 25% more below half target HP.", [1.8,2.1,2.4].map((damageMultiplier,i) => ({ damageMultiplier, lowHpThreshold: .5, lowHpBonus: i===2 ? .25 : 0 })), { apCost: 2 }),
    passive("blood-rush", "Blood Rush", "Cumulative damage taken primes two turns of +15% attack and +5% critical chance.", [.3,.25,.2].map(damageThreshold => ({ damageThreshold, attackBonus: .15, critBonus: .05, duration: 2 }))),
    active("cleave", "Cleave", "Strike a target and one secondary foe at half strength; tier III exploits Bleed.", [1.2,1.4,1.6].map((damageMultiplier,i) => ({ damageMultiplier, secondaryMultiplier: .5, bleedBonus: i===2 ? .2 : 0 })), { apCost: 2 }),
    active("execution", "Execution", "Deal 150% damage against targets below the mastery threshold.", [2,2.4,2.8].map((damageMultiplier,i) => ({ damageMultiplier, lowHpThreshold: [.2,.25,.3][i], lowHpBonus: .5 })), { apCost: 2 }),
    passive("battle-hardened", "Battle Hardened", "Improved maximum HP and Bleed resistance.", [.1,.15,.2].map((maxHpBonus,i) => ({ maxHpBonus, bleedResistance: [.1,.2,.3][i] }))),
    setup("guard-ally", "Guard Ally", "Intercept the next attack on one ally this round.", "protect", [.2,.3,.4].map(reduction => ({ reduction, duration: 1 })), { targetType: "ally" }),
    active("shield-bash", "Shield Bash", "Shield required. Bash with a mastery stun chance plus 10% from the shield.", [1,1.2,1.4].map((damageMultiplier,i) => ({ damageMultiplier, status: "stun", chance: [.2,.3,.4][i], shieldChanceBonus: .1, duration: 1 })), { requiresShield: true }),
    setup("defensive-stance", "Defensive Stance", "Reduce damage and counter the next physical attack this round.", "stance", [.2,.3,.4].map((reduction,i) => ({ reduction, counter: [.5,.7,.9][i], duration: 1 }))),
    passive("hold-the-line", "Hold the Line", "Chance to intercept attacks on allies below 30% HP.", [.3,.5,.7].map(interceptChance => ({ interceptChance, allyHpThreshold: .3 }))),
    passive("armor-training", "Armor Training", "Increase defense; affinity for heavy armor.", [.1,.2,.3].map(defenseBonus => ({ defenseBonus }))),
    active("consecrated-strike", "Consecrated Strike", "A grounded martial strike against undead, demons and corruption.", [1.5,1.8,2.1].map((damageMultiplier,i) => ({ damageMultiplier, typeBonus: [.25,.4,.6][i] })), { bonusTags: supernatural }),
    setup("ward-of-faith", "Ward of Faith", "Protect one ally against Curse and Fear for three rounds.", "ward", [.4,.6,.8].map(resistance => ({ resistance, duration: 3 })), { targetType: "ally" }),
    setup("purge", "Purge", "Remove a standard debuff; higher mastery also removes Curse.", "cleanse", [{ cleanseCount: 1 }, { cleanseCount: 1, curse: true }, { cleanseCount: 2, curse: true }], { targetType: "ally" }),
    setup("martyr", "Martyr", "Intercept one ally's next hit; gain +20% attack on the following turn.", "protect", [.1,.2,.3].map(reduction => ({ reduction, duration: 1, martyrBonus: .2 })), { targetType: "ally" }),
    setup("last-prayer", "Last Prayer", "Once per battle below 25% HP. Tier III survives one otherwise fatal hit unless explicitly Overkill.", "prayer", [.15,.2,.3].map((healRatio,i) => ({ healRatio, survival: i===2 })), { hpRequirement: .25, oncePerBattle: true }),
    damage("aimed-shot", "Aimed Shot", [1.3,1.5,1.7], { ...bow, accuracyModifier: .2 }),
    damage("quick-shot", "Quick Shot", [.8,.9,1], { ...bow, hitCount: 2, accuracyModifier: -.1 }),
    active("pinning-shot", "Pinning Shot", "Bow attack with a chance to Slow.", [1,1.2,1.4].map((damageMultiplier,i) => ({ damageMultiplier, status: "slow", chance: [.3,.4,.5][i], duration: 2 })), bow),
    passive("archer-bow-mastery", "Bow Mastery", "Bow damage and accuracy improve.", [.05,.1,.15].map(weaponDamage => ({ weaponDamage, accuracyBonus: weaponDamage })), bow),
    passive("eagle-eye", "Eagle Eye", "Improved critical chance.", [.03,.06,.1].map(critBonus => ({ critBonus }))),
    setup("hunters-mark", "Hunter's Mark", "Mark prey for three rounds; only the marking Hunter gains the bonus.", "mark", [.1,.15,.2].map(markBonus => ({ markBonus, duration: 3 })), { targetType: "enemy" }),
    active("leg-shot", "Leg Shot", "Slow prey; tier III roots an already Slowed target, interrupting its next action.", [1.1,1.3,1.5].map((damageMultiplier,i) => ({ damageMultiplier, status: "slow", chance: [.4,.6,.8][i], duration: 2, root: i===2 })), bow),
    setup("trap", "Trap", "Set one trap that hits the next enemy attacking the party; may inflict Bleed.", "trap", [1.2,1.5,1.8].map((damageMultiplier,i) => ({ damageMultiplier, status: "bleed", chance: [.2,.3,.4][i], duration: 2 }))),
    passive("exploit-weakness", "Exploit Weakness", "Bonus damage against Bleed, Poison, Slow or Armor Break.", [.15,.25,.35].map(conditionBonus => ({ conditionBonus }))),
    passive("beast-knowledge", "Beast Knowledge", "Bonus damage against beasts and monsters.", [.1,.2,.3].map(typeBonus => ({ typeBonus })), { bonusTags: ["beast", "monster"] }),
    active("crossbow-shot", "Crossbow Shot", "A controlled armor-piercing shot; unloads the crossbow.", [1.7,2,2.3].map((damageMultiplier,i) => ({ damageMultiplier, armorPenetration: [.2,.3,.4][i] })), { ...gun, weaponTypes: ["crossbow"], accuracyModifier: .15 }),
    active("arquebus-shot", "Arquebus Shot", "A loud, powerful single shot; unloads the firearm.", [2.2,2.6,3].map((damageMultiplier,i) => ({ damageMultiplier, armorPenetration: [.3,.45,.6][i] })), { ...gun, weaponTypes: ["firearm"], accuracyModifier: -.15, noise: "loud", apCost: 2 }),
    setup("quick-reload", "Quick Reload", "Reload; tier II grants +10% next-shot accuracy, tier III one free Prepare reload.", "reload", [{}, { reloadAccuracy: .1 }, { reloadAccuracy: .1, freePrepare: true }], { weaponTypes: gun.weaponTypes }),
    active("armor-breaker", "Armor Breaker", "A shot that weakens defense for two rounds; +25% against heavy armor.", [1.4,1.6,1.8].map((damageMultiplier,i) => ({ damageMultiplier, status: "armor-broken", chance: 1, defenseMultiplier: [ .85,.75,.65 ][i], duration: 2, typeBonus: .25 })), { ...gun, bonusTags: ["heavyarmor"] }),
    active("point-blank-shot", "Point-Blank Shot", "A pressure shot. Chance to Stagger when the actor was attacked this round.", [1.8,2.1,2.5].map((damageMultiplier,i) => ({ damageMultiplier, status: "stagger", chance: [.2,.3,.4][i], duration: 1, requiresPressure: true })), gun),
    passive("special-ammunition", "Special Ammunition", "Select ammunition in the class view or Prepare Turn. Choice persists between battles.", [{ ammoTier: 1 }, { ammoTier: 2 }, { ammoTier: 3 }]),
    passive("professional-soldier", "Professional Soldier", "Ranged accuracy; tier II reload also grants 1 AP; tier III primes damage and penetration.", [{ accuracyBonus: .05 }, { accuracyBonus: .05, reloadRefund: 1 }, { accuracyBonus: .05, reloadRefund: 1, reloadDamage: .15, reloadPenetration: .1 }], { weaponTypes: gun.weaponTypes }),
    active("power-shot", "Power Shot", "A powerful bow shot that penetrates armor.", [1.7,2.1,2.5].map((damageMultiplier,i) => ({ damageMultiplier, armorPenetration: [.2,.3,.4][i] })), { ...bow, accuracyModifier: -.1, apCost: 2 }),
    damage("triple-shot", "Triple Shot", [.7,.8,.9], { ...bow, hitCount: 3, apCost: 2 }),
    setup("perfect-aim", "Perfect Aim", "The next bow attack always hits and gains critical chance.", "prime", [.2,.3,.4].map(critBonus => ({ critBonus, guaranteedHit: true })), { ...bow, primeKind: "bow" }),
    active("piercing-arrow", "Piercing Arrow", "An expert arrow ignores part of armor.", [1.4,1.7,2].map((damageMultiplier,i) => ({ damageMultiplier, armorPenetration: [.3,.5,.7][i] })), bow),
    passive("expert-bow-mastery", "Bow Mastery", "Expert bow damage and critical damage.", [.1,.2,.3].map(weaponDamage => ({ weaponDamage, criticalDamageBonus: weaponDamage })), bow),
    damage("magic-bolt", "Magic Bolt", [1.2,1.4,1.6], { ...magic, guaranteedHit: true, description: "Reliable neutral magic, scaled from the existing spell damage range." }),
    passive("elemental-study", "Elemental Study", "Specialize in an existing element using the class view.", [.1,.2,.3].map(elementBonus => ({ elementBonus }))),
    setup("focus", "Focus", "Increase the next damaging spell's power.", "prime", [.15,.25,.35].map(spellBonus => ({ spellBonus })), { primeKind: "spell" }),
    passive("mana-control", "Mana Control", "Reduce spell AP cost by 5 / 10 / 15%.", [.05,.1,.15].map(costReduction => ({ costReduction }))),
    setup("arcane-knowledge", "Arcane Knowledge", "Inspect weakness, then resistance, then status resistance; adds a Bestiary knowledge entry.", "reveal", [{ revealTier: 1 }, { revealTier: 2 }, { revealTier: 3 }], { targetType: "enemy" }),
    setup("amplify", "Amplify", "Amplify the next damaging spell, at 25% extra AP cost.", "prime", [.25,.4,.6].map(spellBonus => ({ spellBonus, costIncrease: .25 })), { primeKind: "spell" }),
    setup("chain-spell", "Chain Spell", "Repeat the next damaging spell at reduced strength.", "prime", [.3,.4,.5].map(repeatMultiplier => ({ repeatMultiplier })), { primeKind: "spell" }),
    setup("element-conversion", "Element Conversion", "Convert the next compatible damaging spell to your selected element.", "prime", [{ convert: true }, { convert: true }, { convert: true }], { primeKind: "spell" }),
    active("arcane-break", "Arcane Break", "Damage and reduce magic defense for three rounds.", [1,1.2,1.4].map((damageMultiplier,i) => ({ damageMultiplier, status: "arcane-broken", magicDefenseMultiplier: [.8,.7,.6][i], chance: 1, duration: 3 })), magic),
    passive("prepared-spell", "Prepared Spell", "During Prepare Turn, select one known damaging spell. Its first cast costs zero AP.", [{}, {}, {}]),
    setup("mend", "Mend", "Restore HP using the existing 20–30 healing range, scaled by mastery.", "heal", [1.5,1.8,2.2].map(healingMultiplier => ({ healingMultiplier })), { targetType: "ally", magic: true }),
    setup("blessing", "Blessing", "Grant one ally +10% attack and defense.", "blessing", [2,3,4].map(duration => ({ attackBonus: .1, defenseBonus: .1, duration })), { targetType: "ally", magic: true }),
    setup("cleanse", "Cleanse", "Remove Poison or Bleed; tier II also Curse/Fear; tier III removes two conditions.", "cleanse", [{ cleanseCount: 1, physicalOnly: true }, { cleanseCount: 1, physicalOnly: true, curse: true, fear: true }, { cleanseCount: 2, physicalOnly: true, curse: true, fear: true }], { targetType: "ally", magic: true }),
    setup("sanctuary", "Sanctuary", "Reduce party damage for this round.", "sanctuary", [.1,.15,.2].map(reduction => ({ reduction, duration: 1 })), { targetType: "all-allies", magic: true, apCost: 2 }),
    active("exorcism", "Exorcism", "Magic against supernatural foes, with 50% bonus damage against undead and demons.", [1.2,1.6,2].map(damageMultiplier => ({ damageMultiplier, typeBonus: .5 })), { ...magic, bonusTags: ["undead", "demon"] })
].map(skill => [skill.id, Object.freeze(skill)])));

export const CLASS_BALANCE = Object.freeze({
    skillThresholds: [0, 3, 8], weaponThresholds: [0, 5, 15, 30],
    baseAccuracy: .9, magicDamageRange: [15, 15], healRange: [20, 30],
    dotDamage: 5, slowAccuracyPenalty: .1, reloadAp: 1,
    elements: ["fire", "ice", "poison", "neutral"], supernaturalTags: supernatural
});

export const AMMUNITION = Object.freeze({
    standard: { id: "standard", name: "Standard", weaponTypes: ["crossbow", "firearm"], tier: 1 },
    bodkin: { id: "bodkin", name: "Bodkin Bolt", weaponTypes: ["crossbow"], tier: 1, armorPenetration: .2 },
    broadhead: { id: "broadhead", name: "Broadhead Bolt", weaponTypes: ["crossbow"], tier: 1, status: "bleed", chance: .5, duration: 2 },
    silver: { id: "silver", name: "Silver Bolt / Shot", weaponTypes: ["crossbow", "firearm"], tier: 2, bonusTags: supernatural, typeBonus: .3 },
    incendiary: { id: "incendiary", name: "Incendiary Shot", weaponTypes: ["firearm"], tier: 2, status: "burn", chance: .6, duration: 2 },
    scatter: { id: "scatter", name: "Scatter Shot", weaponTypes: ["firearm"], tier: 3, damageMultiplier: .65, allEnemies: true }
});
