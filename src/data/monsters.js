import { createContentRegistry, requireContent } from "./contentRegistry.js";
const HIGHWAYMAN_ATTACK_ANIMATION = Object.freeze({
    id: "attack",
    frames: 9,
    frameDurationMs: 70,
    frameDurationsMs: Object.freeze([70, 65, 60, 55, 90, 65, 60, 65, 75]),
    impactFrame: 5,
    folder: "attack",
    filePrefix: "highwayman-attack-v2-",
    framePadding: 2
});

const HIGHWAYMAN_DEATH_ANIMATION = Object.freeze({
    id: "death",
    frames: 1,
    folder: "death",
    fileName: "highwayman-death-pose-v2-aligned.png",
    holdDurationMs: 700
});

const PLACEHOLDER_ANIMATIONS = Object.freeze({
    idle: Object.freeze({ id: "idle", frames: 1, frameDurationMs: 125 }),
    attack: Object.freeze({ id: "attack", frames: 1, frameDurationMs: 360, impactFrame: 1 }),
    hit: Object.freeze({ id: "hit", frames: 1, frameDurationMs: 280 }),
    death: Object.freeze({ id: "death", frames: 1, holdDurationMs: 480 })
});
const MONSTER_EXP_REWARDS = Object.freeze({
    slime: 14, "grey-wolf": 18, "wild-boar": 24, "deserting-soldier": 34,
    "corrupted-adventurer": 42, "male-zombie": 30, "restless-ghost": 38,
    "willow-wood": 65, "possessed-knight": 72
});

const MONSTER_DEFINITIONS_ENTRIES = [
    Object.freeze({
        id: "highwayman",
        name: "Highwayman",
        maxHp: 60,
        attack: 15,
        defense: 3,
        speed: 8,
        reward: 20,
        expReward: 24,
        expRange: Object.freeze([0, 0]),
        rankReward: 0,
        threatTier: "standard",
        formationSlot: "E1",
        assetId: "highwayman",
        exactVisualAsset: true,
        metadata: Object.freeze({ assetStatus: "exact", placeholderRenderer: "humanoid" }),
        animations: Object.freeze({
            idle: Object.freeze({ id: "idle", frames: 9, frameDurationMs: 125 }),
            attack: HIGHWAYMAN_ATTACK_ANIMATION,
            hit: Object.freeze({
                id: "hit",
                frames: 5,
                frameDurationMs: 80,
                frameDurationsMs: Object.freeze([60, 75, 110, 75, 80]),
                folder: "hitted",
                filePrefix: "highwayman-hit-v1-",
                framePadding: 2
            }),
            death: HIGHWAYMAN_DEATH_ANIMATION
        }),
        basicAttackId: "highwayman",
        ai: Object.freeze({ actions: Object.freeze([{ type: "attack", weight: 1 }]) })
    }),
    Object.freeze({
        id: "highland-man",
        name: "Highland Man",
        maxHp: 72,
        attack: 16,
        defense: 4,
        speed: 7,
        reward: 24,
        expReward: 30,
        expRange: Object.freeze([0, 0]),
        rankReward: 0,
        threatTier: "elite",
        formationSlot: "E2",
        assetId: null,
        exactVisualAsset: false,
        metadata: Object.freeze({ assetStatus: "missing", placeholderRenderer: "humanoid", placeholderVariant: "heavy" }),
        animations: PLACEHOLDER_ANIMATIONS,
        basicAttackId: "highland-man",
        ai: Object.freeze({ actions: Object.freeze([{ type: "attack", weight: 0.82 }, { type: "defend", weight: 0.18 }]) })
    }),
    Object.freeze({
        id: "ghoul", name: "Ghoul", maxHp: 150, attack: 18, defense: 5, speed: 7,
        reward: 18, expReward: 90, expRange: Object.freeze([0, 0]), rankReward: 0, threatTier: "story",
        formationSlot: "E1", assetId: null, exactVisualAsset: false, todoAssetId: "TODO_ASSET_GHOUL_SPRITES", basicAttackId: "ghoul",
        metadata: Object.freeze({ assetStatus: "missing", placeholderRenderer: "humanoid", placeholderVariant: "hunched" }),
        properties: Object.freeze({
            tags: Object.freeze(["undead", "monster"]),
            resistances: Object.freeze({ physical: 0.3, fire: 0.6 }),
            statusInteractions: Object.freeze({
                "salt-exposed": Object.freeze({ fire: 3 })
            })
        }),
        animations: PLACEHOLDER_ANIMATIONS,
        ai: Object.freeze({ actions: Object.freeze([{ type: "attack", weight: 1 }]) })
    })
];


// New records use supported stats, AI and resistance multipliers. Their reward plans
// use RewardResolver's fixed-item schema; automatic battle loot is not wired yet.
const starterMonster = (id, name, archetype, tier, stats, itemId, mapTags, description, properties = {}) => ({
    id, name, archetype, description, contentStatus: "catalog", tier,
    maxHp: stats[0], attack: stats[1], defense: stats[2], speed: stats[3],
    reward: 0, expReward: MONSTER_EXP_REWARDS[id], expRange: [0, 0], rankReward: 0,
    threatTier: tier === "elite" ? "elite" : "standard", formationSlot: "E1",
    assetId: null, exactVisualAsset: false,
    animations: PLACEHOLDER_ANIMATIONS,
    basicAttackId: "highwayman", properties: { tags: [archetype], ...properties },
    ai: { actions: [{ type: "attack", weight: 1 }] },
    rewards: { items: [{ id: itemId, quantity: 1 }] },
    metadata: {
        assetStatus: "missing", habitatTags: mapTags,
        placeholderRenderer: archetype === "beast" ? "quadruped" : archetype === "ooze" ? "blob" : archetype === "spirit" ? "spirit" : "humanoid"
    }
});

export const MONSTER_DEFINITIONS = createContentRegistry([
    ...MONSTER_DEFINITIONS_ENTRIES,
    starterMonster("slime", "Ditch Slime", "ooze", "common", [28, 8, 0, 3], "slime-residue", ["front-forest"],
        "A slow scavenger swollen on runoff beside the cart road."),
    starterMonster("grey-wolf", "Grey Wolf", "beast", "common", [42, 11, 1, 12], "wolf-pelt", ["front-forest", "deep-forest"],
        "A hungry wolf drawn to livestock and abandoned camps."),
    starterMonster("wild-boar", "Wild Boar", "beast", "common", [68, 14, 3, 5], "boar-hide", ["front-forest"],
        "An old boar defending a thicket cut through by woodcutters."),
    starterMonster("deserting-soldier", "Deserting Soldier", "human", "dangerous", [76, 16, 4, 7], "iron-scrap", ["town-north"],
        "A hungry deserter who has begun taking supplies at sword point."),
    starterMonster("corrupted-adventurer", "Corrupted Adventurer", "human", "dangerous", [84, 17, 3, 9], "corrupted-shard", ["deep-forest"],
        "An itinerant delver whose wounds have healed around something dark.", { tags: ["human", "corrupted"] }),
    starterMonster("male-zombie", "Graveyard Laborer", "undead", "dangerous", [70, 14, 2, 3], "grave-dust", ["town-north"],
        "A buried laborer still dragging his broken tools through the churchyard."),
    starterMonster("restless-ghost", "Restless Ghost", "spirit", "dangerous", [55, 15, 1, 11], "grave-dust", ["town-north"],
        "A restless presence gathering around an unmarked roadside grave.", { tags: ["spirit", "undead"], resistances: { physical: 0.8, fire: 1.2 } }),
    starterMonster("willow-wood", "Willow Wood", "plant", "elite", [108, 18, 5, 4], "corrupted-shard", ["deep-forest"],
        "An old willow moving across paths that once passed harmlessly beneath it.", { resistances: { fire: 1.25 } }),
    starterMonster("possessed-knight", "Possessed Knight", "undead", "elite", [116, 19, 7, 5], "bloodstained-pendant", ["town-north"],
        "A dead rider in battered harness, held upright by an unwelcome tenant.", { tags: ["undead", "heavyarmor"] })
], "monster");

// The campaign pursuit zone already uses this threat ID with Highwayman combat art/stats.
// Preserve that specific historical mapping, without a catch-all fallback for typos.
export const MONSTER_ALIASES = Object.freeze({ "death-archmage": "highwayman" });
export const getMonsterDefinition = id => requireContent(MONSTER_DEFINITIONS,
    Object.hasOwn(MONSTER_ALIASES, id) ? MONSTER_ALIASES[id] : id, "monster");
export const listMonstersByTag = tag => Object.values(MONSTER_DEFINITIONS).filter(monster =>
    monster.metadata?.habitatTags?.includes(tag));
