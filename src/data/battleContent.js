import { EQUIPMENT_DEFINITIONS } from "./items.js";
import { MONSTER_DEFINITIONS as ENEMY_DEFINITIONS, getMonsterDefinition } from "./monsters.js";
export { ITEM_DEFINITIONS, EQUIPMENT_DEFINITIONS, EQUIPMENT_SLOT_DEFINITIONS } from "./items.js";
export { MONSTER_DEFINITIONS as ENEMY_DEFINITIONS } from "./monsters.js";
export { UI_ICON_ASSETS } from "./uiIcons.js";
import { Enemy } from "../entities/Enemy.js";
import { Player } from "../entities/Player.js";
import { AssetResolver } from "../core/AssetResolver.js";
import { StatResolver } from "../core/StatResolver.js";
import { TECHNIQUE_DEFINITIONS } from "./techniques.js";
import { SKILL_DEFINITIONS as TREE_SKILLS } from "./skills.js";
import { resolveActorVisual } from "../ui/placeholders/placeholderPresets.js";
import { normalizeClassState, getClassStatModifiers } from "../core/ClassSystem.js";
import { initializeClassCombat } from "../core/ClassCombat.js";
import {
    WEAPON_DEFINITIONS as P0_WEAPON_DEFINITIONS,
    createWeaponAttackProfile
} from "./weapons.js";

export const ATTACK_DEFINITIONS = Object.freeze({
    luke: Object.freeze({ name: "Attack", apCost: 0, damageRange: [10, 20], element: "physical" }),
    dummy: Object.freeze({ name: "Attack", apCost: 0, damageRange: [8, 16], element: "physical" }),
    rafel: Object.freeze({ name: "Attack", apCost: 0, damageRange: [10, 18], element: "physical" }),
    anno: Object.freeze({ name: "Attack", apCost: 0, damageRange: [11, 19], element: "physical" }),
    gram: Object.freeze({ name: "Attack", apCost: 0, damageRange: [8, 16], element: "physical" }),
    highwayman: Object.freeze({ name: "Attack", damageRange: [13, 17], element: "physical" }),
    "highland-man": Object.freeze({ name: "Attack", damageRange: [14, 18], element: "physical" }),
    ghoul: Object.freeze({ name: "Rending Claw", damageRange: [15, 20], element: "physical" })
});

export const BATTLE_BACKGROUNDS = Object.freeze({
    "front-forest": Object.freeze({
        id: "battle-front-forest-background",
        extension: "png"
    }),
    "deep-forest": Object.freeze({
        id: "battle-front-forest-background",
        extension: "png"
    }),
    "town-south": Object.freeze({
        id: "battle-town-background",
        extension: "png"
    }),
    "town-north": Object.freeze({
        id: "battle-town-background",
        extension: "png"
    }),
    "mountain-start": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "mountain-path": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "anno-encounter": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "pursuit-area": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "road-foothill": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "kalin-village": Object.freeze({ id: "battle-town-background", extension: "png" }),
    "kalin-investigation": Object.freeze({ id: "battle-front-forest-background", extension: "png" }),
    "ghoul-nest": Object.freeze({ id: "battle-front-forest-background", extension: "png" })
});

export const BATTLE_DEFINITION = Object.freeze({
    id: "prototype-battle",
    fallbackBackgroundMapId: "front-forest"
});

export function getBattleBackgroundForMap(mapNodeId) {
    return BATTLE_BACKGROUNDS[mapNodeId]
        || BATTLE_BACKGROUNDS[BATTLE_DEFINITION.fallbackBackgroundMapId];
}

export const MAX_ENCOUNTER_ENEMIES = 4;

export const CHARACTER_DEFINITIONS = Object.freeze({
    rafel: Object.freeze({
        id: "rafel", name: "Rafel", maxHp: 100, attack: 20, defense: 5, speed: 10, maxAp: 3,
        formationSlot: "P1", assetId: null, exactVisualAsset: false, todoAssetId: "TODO_ASSET_RAFEL_SPRITES", basicAttackId: "rafel",
        metadata: Object.freeze({ assetStatus: "missing", placeholderRenderer: "humanoid", placeholderVariant: "normal" }),
        animations: Object.freeze({
            idle: Object.freeze({ id: "idle", frames: 24 }),
            attack: Object.freeze({ id: "punch", frames: 24, frameDurationMs: 50, soundFrame: 7, impactFrame: 14 }),
            guard: Object.freeze({ id: "guard", frames: 1, frameDurationMs: 460, folder: "guard", fileName: "guard.png" }),
            cast: Object.freeze({ id: "cast", frames: 17, frameDurationMs: 65, impactFrame: 8 })
        }),
        unlockedSkillIds: ["fireball"], battleItems: []
    }),
    anno: Object.freeze({
        id: "anno", name: "Crescent Anno", maxHp: 92, attack: 21, defense: 4, speed: 12, maxAp: 3,
        formationSlot: "P2", assetId: null, exactVisualAsset: false, todoAssetId: "TODO_ASSET_ANNO_SPRITES", basicAttackId: "anno",
        metadata: Object.freeze({ assetStatus: "missing", placeholderRenderer: "humanoid", placeholderVariant: "thin" }),
        animations: Object.freeze({
            idle: Object.freeze({ id: "idle", frames: 24 }),
            attack: Object.freeze({ id: "punch", frames: 24, frameDurationMs: 50, soundFrame: 7, impactFrame: 14 }),
            guard: Object.freeze({ id: "guard", frames: 1, frameDurationMs: 460, folder: "guard", fileName: "guard.png" }),
            cast: Object.freeze({ id: "cast", frames: 17, frameDurationMs: 65, impactFrame: 8 })
        }),
        unlockedSkillIds: ["ice-pike", "bash"], battleItems: []
    }),
    gram: Object.freeze({
        id: "gram", name: "Gram de Crescent", maxHp: 86, attack: 17, defense: 4, speed: 9, maxAp: 3,
        formationSlot: "P3", assetId: null, exactVisualAsset: false, todoAssetId: "TODO_ASSET_GRAM_SPRITES", basicAttackId: "gram",
        metadata: Object.freeze({ assetStatus: "missing", placeholderRenderer: "humanoid", placeholderVariant: "heavy" }),
        animations: Object.freeze({
            idle: Object.freeze({ id: "idle", frames: 24 }),
            attack: Object.freeze({ id: "punch", frames: 24, frameDurationMs: 50, soundFrame: 7, impactFrame: 14 }),
            guard: Object.freeze({ id: "guard", frames: 1, frameDurationMs: 460, folder: "guard", fileName: "guard.png" }),
            cast: Object.freeze({ id: "cast", frames: 17, frameDurationMs: 65, impactFrame: 8 })
        }),
        unlockedSkillIds: ["poison", "heal"], battleItems: []
    }),
    luke: Object.freeze({
        id: "luke",
        name: "Luke",
        maxHp: 100,
        attack: 20,
        defense: 5,
        speed: 10,
        maxAp: 3,
        formationSlot: "P1",
        assetId: "luke",
        exactVisualAsset: true,
        metadata: Object.freeze({ assetStatus: "exact", placeholderRenderer: "humanoid" }),
        battleVisual: Object.freeze({
            scale: 0.53,
            offsetX: 0,
            offsetY: 0
        }),
        animations: Object.freeze({
            // Preserve native cell geometry first; visual.scale only resizes uniformly.
            idle: Object.freeze({
                id: "idle",
                // Frames 29-36 introduce the visible hair-motion discontinuity.
                // Looping 1-28 gives the cleanest end-to-start transition in this sheet.
                frames: 28,
                spriteSheet: true,
                columns: 6,
                rows: 6,
                folder: "idle",
                fileName: "luke-idle.png",
                frameAspectRatio: 298 / 678,
                visual: Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })
            }),
            attack: Object.freeze({
                id: "punch",
                frames: 36,
                frameDurationMs: 34,
                soundFrame: 2,
                impactFrame: 4,
                spriteSheet: true,
                columns: 6,
                rows: 6,
                folder: "punch",
                fileName: "luke-puch.png",
                frameAspectRatio: 416 / 636,
                visual: Object.freeze({ scale: 1.486, offsetX: 0, offsetY: 0 })
            }),
            guard: Object.freeze({
                id: "guard",
                frames: 1,
                frameDurationMs: 460,
                spriteSheet: true,
                columns: 1,
                rows: 1,
                folder: "guard",
                fileName: "guard.png",
                frameAspectRatio: 869 / 1810,
                visual: Object.freeze({ scale: 1.183, offsetX: 0, offsetY: 0 })
            }),
            cast: Object.freeze({
                id: "cast",
                frames: 36,
                frameDurationMs: 31,
                impactFrame: 17,
                spriteSheet: true,
                columns: 6,
                rows: 6,
                folder: "cast",
                fileName: "luke-cast.png",
                frameAspectRatio: 302 / 638,
                visual: Object.freeze({ scale: 1.077, offsetX: 0, offsetY: 0 })
            })
        }),
        basicAttackId: "luke",
        unlockedSkillIds: ["fireball", "ice-pike", "poison"],
        battleItems: []
    }),
    dummy: Object.freeze({
        id: "dummy",
        name: "Lucy",
        maxHp: 100,
        attack: 18,
        defense: 5,
        speed: 9,
        maxAp: 3,
        formationSlot: "P2",
        assetId: "lucy",
        exactVisualAsset: true,
        metadata: Object.freeze({ assetStatus: "provided" }),
        battleVisual: Object.freeze({
            scale: 1.1,
            offsetX: 0,
            offsetY: 0
        }),
        animations: Object.freeze({
            // Preserve native cell geometry first; visual.scale only resizes uniformly.
            idle: Object.freeze({
                id: "idle",
                frames: 36,
                frameDurationMs: 80,
                folder: "idle",
                fileName: "lucy-idle.png",
                spriteSheet: true,
                columns: 6,
                rows: 6,
                frameAspectRatio: 342 / 518,
                visual: Object.freeze({
                    scale: 0.724,
                    offsetX: 0,
                    offsetY: 0
                })
            }),
            attack: Object.freeze({
                id: "punch",
                frames: 25,
                frameDurationMs: 50,
                soundFrame: 7,
                impactFrame: 11,
                folder: "punch",
                fileName: "lucy-punch.png",
                spriteSheet: true,
                columns: 5,
                rows: 5,
                frameAspectRatio: 480 / 526,
                visual: Object.freeze({
                    scale: 1,
                    offsetX: 0,
                    offsetY: 0
                })
            }),
            guard: Object.freeze({
                id: "guard",
                frames: 1,
                frameDurationMs: 460,
                folder: "idle",
                fileName: "lucy-idle.png",
                spriteSheet: true,
                columns: 6,
                rows: 6,
                sheetStartFrame: 1,
                frameAspectRatio: 342 / 518,
                visual: Object.freeze({
                    scale: 0.724,
                    offsetX: 0,
                    offsetY: 0
                })
            }),
            cast: Object.freeze({
                id: "cast",
                frames: 25,
                frameDurationMs: 100,
                impactFrame: 13,
                folder: "cast",
                fileName: "lucy-cast.png",
                spriteSheet: true,
                columns: 5,
                rows: 5,
                frameAspectRatio: 372 / 530,
                visual: Object.freeze({
                    scale: 0.775,
                    offsetX: 0,
                    offsetY: 0
                })
            })
        }),
        basicAttackId: "dummy",
        unlockedSkillIds: ["double-strike", "bash", "heal"],
        battleItems: []
    })
});

// Compatibility export: battle callers retain the existing name while the
// authoritative technique records live in data/techniques.js.
export const SKILL_DEFINITIONS = TECHNIQUE_DEFINITIONS;

export const WEAPON_DEFINITIONS = P0_WEAPON_DEFINITIONS;

export function createPlayer(definition, state = {}) {
    const progression = state.progression || { unlockedSkills: [] };
    const purchasedBattleActions = (progression.unlockedSkills || []).map(id => TREE_SKILLS[id]).filter(skill => skill?.type === "active").map(skill => skill.battleActionId);
    const knownTechniqueIds = [...new Set([...(Array.isArray(state.knownTechniques) ? state.knownTechniques : definition.unlockedSkillIds), ...purchasedBattleActions])].filter(id => SKILL_DEFINITIONS[id]?.battleUsable !== false);
    const resolvedStats = new StatResolver({ equipmentDefinitions: EQUIPMENT_DEFINITIONS }).resolve({
        baseStats: definition,
        equipment: state.equipment,
        masteryModifiers: state.masteryModifiers,
        passiveModifiers: { ...getClassStatModifiers({ ...state, classState: normalizeClassState(state) }, definition), ...(state.passiveModifiers || {}) },
        temporaryModifiers: state.temporaryModifiers,
        statusEffects: state.statusEffects
    });
    const player = new Player(
        definition.name,
        resolvedStats.maxHp,
        resolvedStats.attack,
        resolvedStats.defense,
        resolvedStats.speed,
        resolvedStats.maxAp,
        {
            unlockedSkillIds: knownTechniqueIds,
            battleItems: definition.battleItems
        }
    );
    const visual = resolveActorVisual({ entityId: definition.id, definition, fallbackFamily: "humanoid" });
    Object.assign(player, {
        id: definition.id,
        formationSlot: definition.formationSlot,
        assetId: visual.type === "asset" ? visual.assetId : null,
        visual,
        portraitAssetId: definition.portraitAssetId || null,
        battleVisual: definition.battleVisual || null,
        animations: definition.animations || {},
        baseStats: Object.freeze(Object.fromEntries(["maxHp", "attack", "defense", "speed", "maxAp"].map(key => [key, definition[key]]))),
        derivedStats: resolvedStats,
        equipment: { ...(state.equipment || {}) },
        basicAttack: createWeaponAttackProfile(state.equipment),
        equippedWeaponId: state.equipment?.weapon || null,
        unlockedSkillIds: knownTechniqueIds,
        knownTechniques: knownTechniqueIds,
        unlockedSkills: [...(progression.unlockedSkills || [])],
        progression: { ...progression },
        mastery: { ...(state.mastery || {}) },
        classState: normalizeClassState(state),
        downCount: Math.max(0, Math.floor(Number(state.downCount) || 0)),
        isDown: state.isDown === true,
        retreated: state.retreated === true
    });
    if (Number.isFinite(Number(state.hp))) player.hp = Math.max(0, Math.min(player.maxHp, Number(state.hp)));
    initializeClassCombat(player);
    return player;
}

function createEnemy(definition) {
    const enemy = new Enemy(
        definition.name,
        definition.maxHp,
        definition.attack,
        definition.defense,
        definition.speed,
        definition.expReward
    );
    const visual = resolveActorVisual({ entityId: definition.id, definition, fallbackFamily: "humanoid" });
    return Object.assign(enemy, {
        id: definition.id,
        definitionId: definition.id,
        formationSlot: definition.formationSlot,
        assetId: visual.type === "asset" ? visual.assetId : null,
        visual,
        portraitAssetId: definition.portraitAssetId || null,
        threatTier: definition.threatTier || "standard",
        expRange: definition.expRange || [0, 0],
        rankReward: Math.max(0, Math.floor(Number(definition.rankReward) || 0)),
        ai: definition.ai || { actions: [{ type: "attack", weight: 1 }] },
        animations: definition.animations || {},
        properties: definition.properties || {},
        sprite: visual.type === "asset" ? AssetResolver.enemyAnimationFrame(visual.assetId, "idle", 1) : null,
        basicAttack: ATTACK_DEFINITIONS[definition.basicAttackId]
    });
}

export function createPartyCombatants(partyState = []) {
    return partyState
        .filter(member => member?.active !== false && CHARACTER_DEFINITIONS[member?.id])
        .slice(0, 3)
        .map((member, index) => {
            const combatant = createPlayer(CHARACTER_DEFINITIONS[member.id], member);
            combatant.formationSlot = `P${index + 1}`;
            return combatant;
        });
}

export function createEncounterEnemies(enemyId = "highwayman", count = 1) {
    const definition = getMonsterDefinition(enemyId);
    const safeCount = Math.min(
        MAX_ENCOUNTER_ENEMIES,
        Math.max(1, Math.floor(Number(count) || 1))
    );

    return Array.from({ length: safeCount }, (_, index) => {
        const opponent = createEnemy(definition);
        opponent.visualEntityId = enemyId;
        opponent.visual = resolveActorVisual({ entityId: enemyId, definition, fallbackFamily: "humanoid" });
        opponent.assetId = opponent.visual.type === "asset" ? opponent.visual.assetId : null;
        opponent.id = safeCount === 1 ? definition.id : `${definition.id}-${index + 1}`;
        opponent.formationSlot = `E${index + 1}`;
        return opponent;
    });
}

export function createPrototypeBattleContent() {
    const player = createPlayer(CHARACTER_DEFINITIONS.luke);
    const dummy = createPlayer(CHARACTER_DEFINITIONS.dummy);
    const enemy = createEnemy(ENEMY_DEFINITIONS.highwayman);
    const highlandMan = createEnemy(ENEMY_DEFINITIONS["highland-man"]);
    return {
        player,
        dummy,
        enemy,
        highlandMan,
        party: [player, dummy],
        enemies: [enemy, highlandMan],
        skills: SKILL_DEFINITIONS,
        battle: BATTLE_DEFINITION
    };
}
