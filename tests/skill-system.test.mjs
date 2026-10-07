import assert from "node:assert/strict";
import { createInitialGameState, normalizeGameState } from "../src/core/GameState.js";
import { applyCharacterExperience, getEarnedSkillPoints, getLevelExpRequirement, LEVEL_CAP, LEVEL_EXP_CURVE } from "../src/core/Progression.js";
import { BattleVictoryResolver } from "../src/core/BattleVictoryResolver.js";
import { SkillManager } from "../src/core/SkillManager.js";
import { SkillEffectResolver } from "../src/core/SkillEffectResolver.js";
import { SKILL_DEFINITIONS, STARTER_SKILL_IDS } from "../src/data/skills.js";
import { createPartyCombatants } from "../src/data/battleContent.js";
import { validateContent } from "../src/data/contentValidation.js";

assert.equal(LEVEL_EXP_CURVE.length, 29);
assert.ok(LEVEL_EXP_CURVE.every((value,index)=>index===0||value>LEVEL_EXP_CURVE[index-1]));
let state=createInitialGameState();state.party[1].active=false;
let result=new BattleVictoryResolver(state).resolve({encounterId:"exp-one",enemyId:"highwayman",enemyCount:1,mapId:"front-forest"});
assert.equal(result.loot.experience[0].expGained,24);assert.equal(state.party[0].progression.exp,24);assert.equal(state.party[1].progression.exp,0);
assert.equal(new BattleVictoryResolver(state).resolve({encounterId:"exp-one",enemyId:"highwayman"}).reason,"already-resolved");
state.party[1].active=true;
result=new BattleVictoryResolver(state).resolve({encounterId:"exp-two",enemyId:"grey-wolf",enemyCount:2,mapId:"old-forest-road"});
assert.equal(result.loot.experience.length,2);assert.equal(result.loot.experience[0].expGained,36);assert.equal(result.loot.experience[1].expGained,36);assert.equal(state.party[0].progression.level,2);assert.equal(state.party[0].progression.exp,20);

const member=state.party[0];member.progression={level:1,exp:39,skillPoints:0,spentSkillPoints:0,unlockedSkills:[]};
assert.equal(applyCharacterExperience(member,1).newLevel,2);
member.progression={level:1,exp:0,skillPoints:0,spentSkillPoints:0,unlockedSkills:[]};
const total=LEVEL_EXP_CURVE.reduce((sum,value)=>sum+value,0)+999;
const capped=applyCharacterExperience(member,total);assert.equal(capped.newLevel,LEVEL_CAP);assert.equal(capped.levelsGained,29);assert.equal(capped.skillPointsGained,10);assert.equal(getEarnedSkillPoints(30),10);assert.equal(getEarnedSkillPoints(4),1);assert.equal(getEarnedSkillPoints(5),1);assert.equal(getLevelExpRequirement(30),0);

state=createInitialGameState();const manager=new SkillManager(state);assert.equal(manager.purchase("luke","quick-strike").reason,"level");
state.party[0].progression={level:3,exp:0,skillPoints:0,spentSkillPoints:1,unlockedSkills:[]};assert.equal(manager.purchase("luke","quick-strike").reason,"points");
state.party[0].progression={level:30,exp:0,skillPoints:10,spentSkillPoints:0,unlockedSkills:[]};
assert.equal(manager.purchase("luke","guard-stance").reason,"prerequisite");
for(const id of STARTER_SKILL_IDS){const before=state.party[0].progression.skillPoints;assert.equal(manager.purchase("luke",id).changed,true);assert.equal(state.party[0].progression.skillPoints,before-1);}
assert.equal(manager.purchase("luke","quick-strike").reason,"already-unlocked");assert.equal(state.party[1].progression.unlockedSkills.length,0);
const loaded=normalizeGameState(JSON.parse(JSON.stringify(state)));assert.deepEqual(loaded.party[0].progression.unlockedSkills,STARTER_SKILL_IDS);
const old=normalizeGameState({party:[{id:"luke"}]});assert.deepEqual(old.party[0].progression,{level:1,exp:0,skillPoints:0,spentSkillPoints:0,unlockedSkills:[]});
const combatants=createPartyCombatants(state.party);assert.ok(combatants[0].unlockedSkillIds.includes("quick-strike"));assert.ok(!combatants[1].unlockedSkillIds.includes("quick-strike"));
const effects=new SkillEffectResolver();combatants[0].unlockedSkills=["counterstep","execution-window","veterans-instinct"];assert.ok(effects.getIncomingMultiplier(combatants[0])<1);assert.ok(effects.prepareDamageProfile(combatants[0],{hp:2,maxHp:10},{damageRange:[1,1]}).attackMultiplier>1);
assert.equal(Object.keys(SKILL_DEFINITIONS).length,10);assert.deepEqual(Object.values(SKILL_DEFINITIONS).map(skill=>skill.requiredLevel),[3,6,9,12,15,18,21,24,27,30]);
const cyclic={a:{id:"a",name:"A",description:"A",requiredLevel:3,cost:1,type:"passive",passiveEffect:{x:1},prerequisites:["b"]},b:{id:"b",name:"B",description:"B",requiredLevel:6,cost:1,type:"passive",passiveEffect:{x:1},prerequisites:["a"]}};
assert.ok(validateContent({skills:cyclic}).some(error=>error.includes("cycle detected")));
console.log("Skill system: EXP distribution/idempotency, Lv.30 curve, milestones, purchasing, saves, battle loadouts, passives and validation passed.");
