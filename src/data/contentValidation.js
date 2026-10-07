import { ITEM_DATABASE, EQUIPMENT_SLOT_DEFINITIONS } from "./items.js";
import { MONSTER_DEFINITIONS, MONSTER_ALIASES } from "./monsters.js";
import { QUEST_DEFINITIONS } from "./quests.js";
import { ENCOUNTER_DEFINITIONS } from "./encounters.js";
import { SHOP_DEFINITIONS } from "./shops.js";
import { MAP_NODE_REGISTRY } from "./maps/mapNodeRegistry.js";
import { MAP_CONTENT } from "./worldContent.js";
import { ATTACK_DEFINITIONS, MAX_ENCOUNTER_ENEMIES } from "./battleContent.js";
import { TECHNIQUE_DEFINITIONS } from "./techniques.js";
import { STATUS_EFFECT_DEFINITIONS } from "./statusEffects.js";
import { SKILL_DEFINITIONS, STARTER_SKILL_IDS } from "./skills.js";

// Accept entry arrays as well as registries so tests/tools can detect duplicates
// before indexing. Errors include the database, record and field; nothing falls back.
export function validateContent({
    items = ITEM_DATABASE, monsters = MONSTER_DEFINITIONS, quests = QUEST_DEFINITIONS,
    encounters = ENCOUNTER_DEFINITIONS, shops = SHOP_DEFINITIONS,
    maps = MAP_NODE_REGISTRY, world = MAP_CONTENT, monsterAliases = MONSTER_ALIASES,
    skills = SKILL_DEFINITIONS
} = {}) {
    const errors = [];
    const fail = (path, message) => errors.push(`${path}: ${message}`);
    const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
    const text = (value, path) => {
        if (typeof value !== "string" || !value.trim()) fail(path, "required nonempty string");
    };
    const number = (value, path, min = 0, max = Infinity, integer = false) => {
        if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
            fail(path, `expected ${integer ? "integer" : "number"} in [${min}, ${max}]`);
        }
    };
    const array = (value, path) => {
        if (!Array.isArray(value)) { fail(path, "expected array"); return []; }
        return value;
    };
    function index(source, kind) {
        const result = new Map();
        if (!object(source) && !Array.isArray(source)) { fail(kind, "expected registry or entries"); return result; }
        for (const [key, entry] of Object.entries(source)) {
            const path = `${kind}.${entry?.id || key}`;
            if (!object(entry)) { fail(path, "expected record"); continue; }
            text(entry.id, `${path}.id`);
            text(entry.name, `${path}.name`);
            if (!Array.isArray(source) && key !== entry.id) fail(path, `registry key ${key} does not match id`);
            if (result.has(entry.id)) fail(path, "duplicate id");
            result.set(entry.id, entry);
        }
        return result;
    }
    const itemIndex = index(items, "items");
    const monsterIndex = index(monsters, "monsters");
    const questIndex = index(quests, "quests");
    const encounterIndex = index(encounters, "encounters");
    const shopIndex = index(shops, "shops");
    const mapIndex = index(maps, "maps");
    const mapIds = new Set(mapIndex.keys());
    const slots = new Set(EQUIPMENT_SLOT_DEFINITIONS.map(slot => slot.id));
    const npcIds = new Set(Object.values(world || {}).flatMap(map => (map.npcs || []).map(npc => npc.id)));
    const interactionIds = new Set(Object.values(world || {}).flatMap(map => (map.interactives || []).map(entry => entry.id)));
    const reference = (registry, value, path) => {
        if (!registry.has(value)) fail(path, `unknown reference ${String(value)}`);
    };
    for (const [alias, target] of Object.entries(monsterAliases)) {
        reference(monsterIndex, target, `monsterAliases.${alias}`);
        if (monsterIndex.has(alias)) fail(`monsterAliases.${alias}`, "alias shadows a monster id");
    }
    const skillEntries = Object.values(skills || {});
    const skillIds = new Set();
    const skillById = new Map();
    for (const skill of skillEntries) {
        if (skillIds.has(skill?.id)) fail(`skills.${skill?.id}`, "duplicate id");
        skillIds.add(skill?.id); skillById.set(skill?.id, skill);
    }
    for (const skill of skillEntries) {
        const path = `skills.${skill.id}`;
        number(skill.requiredLevel, `${path}.requiredLevel`, 1, 30, true);
        number(skill.cost, `${path}.cost`, Number.EPSILON, Infinity, true);
        for (const prerequisite of array(skill.prerequisites, `${path}.prerequisites`)) {
            reference(skillIds, prerequisite, `${path}.prerequisites`);
            const prior = skillById.get(prerequisite);
            if (prior && prior.requiredLevel >= skill.requiredLevel) fail(`${path}.prerequisites`, "prerequisite level must be lower");
        }
        if (skill.type === "active") reference(new Set(Object.keys(TECHNIQUE_DEFINITIONS)), skill.battleActionId, `${path}.battleActionId`);
        else if (skill.type !== "passive" || !object(skill.passiveEffect)) fail(`${path}.passiveEffect`, "passive skill requires an effect object");
    }
    const visit = (id, path = []) => { if (path.includes(id)) { fail(`skills.${id}.prerequisites`, "cycle detected"); return; } for (const next of skillById.get(id)?.prerequisites || []) visit(next, [...path, id]); };
    for (const id of skillIds) visit(id);
    const milestones = [3,6,9,12,15,18,21,24,27,30];
    if (skills === SKILL_DEFINITIONS) for (const level of milestones) if (STARTER_SKILL_IDS.filter(id => skillById.get(id)?.requiredLevel === level).length !== 1) fail("skills.starter-combat", `expected exactly one skill at level ${level}`);
    const monsterReferences = new Map(monsterIndex);
    for (const [alias, target] of Object.entries(monsterAliases)) if (monsterIndex.has(target)) monsterReferences.set(alias, monsterIndex.get(target));
    function rewards(value, path) {
        if (!object(value)) { fail(path, "expected rewards object"); return; }
        if (value.currency !== undefined) number(value.currency, `${path}.currency`, 0, Infinity, true);
        if (value.rankPoints !== undefined) number(value.rankPoints, `${path}.rankPoints`, 0, Infinity, true);
        if (value.items !== undefined) array(value.items, `${path}.items`).forEach((entry, i) => {
            reference(itemIndex, Array.isArray(entry) ? entry[0] : entry?.id, `${path}.items[${i}].id`);
            number(Array.isArray(entry) ? entry[1] : entry?.quantity, `${path}.items[${i}].quantity`, 1, Infinity, true);
        });
        if (value.reputation !== undefined) {
            if (!object(value.reputation)) fail(`${path}.reputation`, "expected object");
            else for (const [id, amount] of Object.entries(value.reputation)) number(amount, `${path}.reputation.${id}`, 0, Infinity, true);
        }
    }
    for (const map of mapIndex.values()) {
        const path = `maps.${map.id}`;
        const columns = map.grid?.columns;
        const rows = map.grid?.rows;
        number(columns, `${path}.grid.columns`, 1, Infinity, true);
        number(rows, `${path}.grid.rows`, 1, Infinity, true);
        const spawns = array(map.groups?.spawns, `${path}.groups.spawns`);
        const spawnIds = new Set();
        for (const [i, spawn] of spawns.entries()) {
            const spawnPath = `${path}.groups.spawns[${i}]`;
            text(spawn?.spawnId, `${spawnPath}.spawnId`);
            if (spawnIds.has(spawn?.spawnId)) fail(spawnPath, `duplicate spawn id ${spawn?.spawnId}`);
            spawnIds.add(spawn?.spawnId);
        }
        if (!spawnIds.has(map.defaultSpawnId)) fail(`${path}.defaultSpawnId`, `unknown spawn ${map.defaultSpawnId}`);
        for (const [groupId, entries] of Object.entries(map.groups || {})) {
            for (const [i, entry] of array(entries, `${path}.groups.${groupId}`).entries()) {
                const entryPath = `${path}.groups.${groupId}[${i}]`;
                number(entry?.x, `${entryPath}.x`, 0, columns);
                number(entry?.y, `${entryPath}.y`, 0, rows);
                number(entry?.width, `${entryPath}.width`, Number.EPSILON, columns);
                number(entry?.height, `${entryPath}.height`, Number.EPSILON, rows);
                if (Number.isFinite(entry?.x) && Number.isFinite(entry?.width) && entry.x + entry.width > columns) fail(entryPath, "extends beyond map columns");
                if (Number.isFinite(entry?.y) && Number.isFinite(entry?.height) && entry.y + entry.height > rows) fail(entryPath, "extends beyond map rows");
            }
        }
        for (const [i, warp] of (map.groups?.warps || []).entries()) {
            if (warp.active === false || !warp.destinationMapId) continue;
            const warpPath = `${path}.groups.warps[${i}]`;
            reference(mapIndex, warp.destinationMapId, `${warpPath}.destinationMapId`);
            const destination = mapIndex.get(warp.destinationMapId);
            const destinationSpawn = destination?.groups?.spawns?.find(spawn => spawn.spawnId === warp.destinationSpawnId);
            if (destination && !destinationSpawn) fail(`${warpPath}.destinationSpawnId`, `unknown spawn ${warp.destinationSpawnId}`);
            if (destinationSpawn?.arrivalWarpId) {
                const returnWarp = destination.groups?.warps?.find(entry => entry.id === destinationSpawn.arrivalWarpId);
                if (!returnWarp || returnWarp.destinationMapId !== map.id) fail(warpPath, "destination spawn has no reciprocal return warp");
            }
        }
    }
    for (const mapId of Object.keys(world || {})) reference(mapIndex, mapId, `world.${mapId}`);
    for (const item of itemIndex.values()) {
        const path = `items.${item.id}`;
        text(item.description, `${path}.description`);
        text(item.category, `${path}.category`);
        if (!["usable", "equipment", "etc"].includes(item.inventoryType)) fail(`${path}.inventoryType`, "unsupported inventory type");
        if (item.category === "equipment" || item.slot !== undefined) reference(slots, item.slot, `${path}.slot`);
        for (const key of ["value", "shopPrice", "apCost"]) if (item[key] !== undefined) number(item[key], `${path}.${key}`, 0, Infinity, true);
        if (item.effectType !== undefined && !["heal", "cure-status", "apply-enemy-status"].includes(item.effectType)) fail(`${path}.effectType`, "unsupported effect");
        if (item.effectType === "heal") number(item.healAmount, `${path}.healAmount`, 1, Infinity, true);
        if (item.curesStatus) reference(new Set(Object.keys(STATUS_EFFECT_DEFINITIONS)), item.curesStatus, `${path}.curesStatus`);
        if (item.statusEffectId) reference(new Set(Object.keys(STATUS_EFFECT_DEFINITIONS)), item.statusEffectId, `${path}.statusEffectId`);
        if (item.damageRange !== undefined) {
            const range = array(item.damageRange, `${path}.damageRange`);
            if (range.length !== 2) fail(`${path}.damageRange`, "expected two bounds");
            range.forEach((n, i) => number(n, `${path}.damageRange[${i}]`));
            if (range[0] > range[1]) fail(`${path}.damageRange`, "minimum exceeds maximum");
        }
        if (item.allowedTechniques !== undefined) for (const id of array(item.allowedTechniques, `${path}.allowedTechniques`)) {
            reference(new Set(Object.keys(TECHNIQUE_DEFINITIONS)), id, `${path}.allowedTechniques`);
        }
    }
    for (const monster of monsterIndex.values()) {
        const path = `monsters.${monster.id}`;
        number(monster.maxHp, `${path}.maxHp`, 1, Infinity, true);
        for (const key of ["attack", "defense", "speed"]) number(monster[key], `${path}.${key}`, 0, Infinity, true);
        number(monster.expReward, `${path}.expReward`, 0, Infinity, true);
        if (monster.exactVisualAsset === true) text(monster.assetId, `${path}.assetId`);
        else if (!monster.metadata?.placeholderRenderer) fail(`${path}.metadata.placeholderRenderer`, "required when exact visual asset is unavailable");
        reference(new Set(Object.keys(ATTACK_DEFINITIONS)), monster.basicAttackId, `${path}.basicAttackId`);
        const range = array(monster.expRange, `${path}.expRange`);
        if (range.length !== 2 || range.some(n => n !== 0)) fail(`${path}.expRange`, "combat must not grant Level EXP");
        if (monster.rankReward !== 0) fail(`${path}.rankReward`, "combat must not grant direct Rank");
        const actions = array(monster.ai?.actions, `${path}.ai.actions`);
        if (!actions.length) fail(`${path}.ai.actions`, "at least one action required");
        for (const action of actions) {
            if (!["attack", "defend"].includes(action?.type)) fail(`${path}.ai.actions`, "unsupported action type");
            number(action?.weight, `${path}.ai.weight`, Number.EPSILON);
        }
        if (monster.rewards !== undefined) rewards(monster.rewards, `${path}.rewards`);
        // Reserved authoring input only: the runtime has no random-drop engine.
        if (monster.drops !== undefined) for (const [i, drop] of array(monster.drops, `${path}.drops`).entries()) {
            reference(itemIndex, drop?.itemId, `${path}.drops[${i}].itemId`);
            number(drop?.chance, `${path}.drops[${i}].chance`, 0, 1);
            number(drop?.min, `${path}.drops[${i}].min`, 1, Infinity, true);
            number(drop?.max, `${path}.drops[${i}].max`, 1, Infinity, true);
            if (drop?.min > drop?.max) fail(`${path}.drops[${i}]`, "minimum exceeds maximum");
        }
        for (const [element, multiplier] of Object.entries(monster.properties?.resistances || {})) number(multiplier, `${path}.properties.resistances.${element}`);
        for (const mapId of monster.metadata?.habitatTags || []) reference(mapIds, mapId, `${path}.metadata.habitatTags`);
    }
    for (const quest of questIndex.values()) {
        const path = `quests.${quest.id}`;
        if (!["locked", "available", "active", "completed", "failed"].includes(quest.initialState)) fail(`${path}.initialState`, "invalid quest state");
        if (!object(quest.objectives) || !Object.keys(quest.objectives).length) fail(`${path}.objectives`, "nonempty boolean objective map required");
        else for (const [key, value] of Object.entries(quest.objectives)) if (typeof value !== "boolean") fail(`${path}.objectives.${key}`, "expected boolean");
        rewards(quest.rewards, `${path}.rewards`);
        if (quest.giverId !== undefined) reference(npcIds, quest.giverId, `${path}.giverId`);
        if (quest.nextQuestId !== undefined) reference(questIndex, quest.nextQuestId, `${path}.nextQuestId`);
        if (quest.prerequisites !== undefined) for (const id of array(quest.prerequisites, `${path}.prerequisites`)) {
            reference(questIndex, id, `${path}.prerequisites`);
            if (id === quest.id) fail(`${path}.prerequisites`, "quest cannot require itself");
        }
        if (quest.contentStatus === "catalog" && quest.initialState !== "locked") fail(path, "unwired catalog quests must remain locked");
        for (const target of quest.metadata?.objectiveTargets || []) {
            if (!Object.hasOwn(quest.objectives || {}, target.objectiveId)) fail(`${path}.objectiveTargets`, `unknown objective ${target.objectiveId}`);
            for (const [field, registry] of [["monsterId", monsterReferences], ["itemId", itemIndex], ["encounterId", encounterIndex], ["npcId", npcIds], ["interactionId", interactionIds], ["mapId", mapIds]]) {
                if (target[field] !== undefined) reference(registry, target[field], `${path}.objectiveTargets.${target.objectiveId}.${field}`);
            }
            const encounter = encounterIndex.get(target.encounterId);
            if (encounter && target.monsterId && encounter.enemyId !== target.monsterId) fail(`${path}.objectiveTargets`, "encounter and monster disagree");
            if (encounter && target.mapId && encounter.mapNodeId !== target.mapId) fail(`${path}.objectiveTargets`, "encounter and map disagree");
            if (target.type !== undefined && !["monster-defeated", "item-acquired", "interaction-completed", "return-to-npc"].includes(target.type)) fail(`${path}.objectiveTargets.${target.objectiveId}.type`, "unsupported event type");
            if (target.requiredCount !== undefined) number(target.requiredCount, `${path}.objectiveTargets.${target.objectiveId}.requiredCount`, 1, Infinity, true);
            for (const requiredId of target.requiredObjectives || []) {
                if (!Object.hasOwn(quest.objectives || {}, requiredId)) fail(`${path}.objectiveTargets.${target.objectiveId}.requiredObjectives`, `unknown objective ${requiredId}`);
            }
        }
    }
    const encounterRange = (entry, path) => {
        const min = entry.minEnemies ?? 1, max = entry.maxEnemies ?? min;
        number(min, `${path}.minEnemies`, 1, MAX_ENCOUNTER_ENEMIES, true);
        number(max, `${path}.maxEnemies`, 1, MAX_ENCOUNTER_ENEMIES, true);
        if (min > max) fail(path, "minimum enemies exceeds maximum");
    };
    for (const encounter of encounterIndex.values()) {
        const path = `encounters.${encounter.id}`;
        reference(monsterReferences, encounter.enemyId, `${path}.enemyId`);
        reference(mapIds, encounter.mapNodeId, `${path}.mapNodeId`);
        encounterRange(encounter, path);
        if (encounter.rewards !== undefined) rewards(encounter.rewards, `${path}.rewards`);
        if (encounter.contentStatus !== "catalog") for (const key of ["x", "y", "triggerRadiusX", "triggerRadiusY"]) number(encounter[key], `${path}.${key}`);
    }
    for (const [mapId, content] of Object.entries(world || {})) for (const zone of content.encounterZones || []) {
        reference(monsterReferences, zone.enemyId, `world.${mapId}.${zone.id}.enemyId`);
        encounterRange(zone, `world.${mapId}.${zone.id}`);
        number(zone.chancePerSecond, `world.${mapId}.${zone.id}.chancePerSecond`, 0, 1);
    }
    for (const shop of shopIndex.values()) {
        reference(mapIds, shop.mapNodeId, `shops.${shop.id}.mapNodeId`);
        reference(npcIds, shop.npcId, `shops.${shop.id}.npcId`);
        for (const id of array(shop.itemIds, `shops.${shop.id}.itemIds`)) {
            reference(itemIndex, id, `shops.${shop.id}.itemIds`);
            const item = itemIndex.get(id);
            if (item) number(item.shopPrice ?? item.value, `shops.${shop.id}.${id}.price`, 0, Infinity, true);
        }
    }
    return errors;
}

export function assertValidContent(content) {
    const errors = validateContent(content);
    if (errors.length) throw new Error(`Content validation failed:\n${errors.map(error => `- ${error}`).join("\n")}`);
    return true;
}
