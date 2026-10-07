import { createContentRegistry, requireContent } from "./contentRegistry.js";
export const STARTER_SKILL_IDS = Object.freeze(["quick-strike","guard-stance","power-strike","counterstep","armor-break","second-wind","precision-strike","riposte","execution-window","veterans-instinct"]);
const skill = (id, name, requiredLevel, description, type, battleActionId = null, passiveEffect = null) => ({ id, name, description, category: "combat", branch: "starter", requiredLevel, prerequisites: requiredLevel === 3 ? [] : [STARTER_SKILL_IDS[(requiredLevel / 3) - 2]], cost: 1, type, battleActionId, passiveEffect, metadata: { treeId: "starter-combat" } });
export const SKILL_DEFINITIONS = createContentRegistry([
 skill("quick-strike","Quick Strike",3,"A swift, low-commitment weapon attack.","active","quick-strike"),
 skill("guard-stance","Guard Stance",6,"Brace to reduce the next incoming hit.","active","guard-stance"),
 skill("power-strike","Power Strike",9,"Commit to a forceful strike with increased damage.","active","power-strike"),
 skill("counterstep","Counterstep",12,"Footwork reduces incoming weapon damage slightly.","passive",null,{incomingDamageMultiplier:.92}),
 skill("armor-break","Armor Break",15,"Damage an enemy and weaken its defense temporarily.","active","armor-break"),
 skill("second-wind","Second Wind",18,"Recover a portion of maximum HP once per battle.","active","second-wind"),
 skill("precision-strike","Precision Strike",21,"A measured attack with increased critical chance.","active","precision-strike"),
 skill("riposte","Riposte",24,"Guarding an attack primes a stronger return strike.","passive",null,{riposteMultiplier:1.25}),
 skill("execution-window","Execution Window",27,"Deal more damage to enemies below 30% HP.","passive",null,{lowHpThreshold:.3,lowHpMultiplier:1.2}),
 skill("veterans-instinct","Veteran's Instinct",30,"A modest critical and defensive edge.","passive",null,{criticalChance:.05,incomingDamageMultiplier:.95})
], "skill");
export const getSkillDefinition = id => requireContent(SKILL_DEFINITIONS, id, "skill");
