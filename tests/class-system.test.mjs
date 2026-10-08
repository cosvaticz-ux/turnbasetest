import assert from "node:assert/strict";
import { CLASS_DEFINITIONS } from "../src/data/classes.js";
import { CLASS_SKILLS } from "../src/data/classSkills.js";
import { TECHNIQUE_DEFINITIONS } from "../src/data/techniques.js";
import { createInitialGameState, normalizeGameState } from "../src/core/GameState.js";
import { createPartyMemberState } from "../src/core/PartyManager.js";
import { createPlayer, CHARACTER_DEFINITIONS, createEncounterEnemies } from "../src/data/battleContent.js";
import { ClassSystem, getActiveClassSkills, getSkillTier } from "../src/core/ClassSystem.js";
import { ClassCombat, clearClassCombat } from "../src/core/ClassCombat.js";
import { ClassDebug } from "../src/core/ClassDebug.js";
import { SkillEffectResolver } from "../src/core/SkillEffectResolver.js";
import { MasteryManager } from "../src/core/MasteryManager.js";
import { RewardResolver } from "../src/core/RewardResolver.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { resolveCombatDamage, applyResolvedDamage, resolvePropertyMultiplier } from "../src/battle/CombatResolver.js";

const world=createInitialGameState(), classes=new ClassSystem(world), member=world.party[0];
assert.equal(Object.keys(CLASS_DEFINITIONS).length,11);
for(const definition of Object.values(CLASS_DEFINITIONS))for(const id of definition.skillIds){assert.ok(CLASS_SKILLS[id]);assert.equal(CLASS_SKILLS[id].tiers.length,3);}
assert.equal(classes.changeClass(member,"knight").changed,false);
assert.equal(classes.changeClass(member,"archer").changed,true);
assert.ok(getActiveClassSkills(member).some(skill=>skill.id==="aimed-shot"));
ClassDebug.setSkillTier(member,"aimed-shot",3);
classes.changeClass(member,"infantry");
assert.ok(!getActiveClassSkills(member).some(skill=>skill.id==="aimed-shot"));
classes.changeClass(member,"archer");
assert.equal(getSkillTier(member,"aimed-shot"),3);
new RewardResolver(world).apply({mastery:{luke:{sword:3}},classUnlocks:[{characterId:"luke",token:"knight"}]});
assert.equal(classes.changeClass(member,"knight").changed,true);
assert.equal(classes.evaluate(member,{all:[{kind:"class",id:"knight"},{any:[{kind:"flag",id:"missing"},{kind:"mastery",id:"sword",amount:3}]}]}),true);
assert.equal(classes.evaluate(member,{kind:"level",amount:1}),false,"level-only unlocks are unsupported");

function actor(classId, weapon="traveler-sword", tier=1, characterId="luke") {
    const saved=createPartyMemberState(characterId);
    ClassDebug.unlockAll(saved);
    new ClassSystem().changeClass(saved,classId);
    for(const id of CLASS_DEFINITIONS[classId].skillIds)ClassDebug.setSkillTier(saved,id,tier);
    saved.equipment.weapon=weapon;
    const result=createPlayer(CHARACTER_DEFINITIONS[characterId],saved);
    result.ap=20;result.maxAp=20;result.hp=result.maxHp;
    return result;
}
function enemy(tags=[]) {
    const foe=createEncounterEnemies("highwayman")[0];
    foe.hp=foe.maxHp=1000;foe.defense=10;foe.properties={tags};return foe;
}
const uses=[];
const legacy=new SkillEffectResolver();
const engine=new ClassCombat({randomSource:()=>.5,recordUse:(...args)=>uses.push(args),gameState:world});
engine.damage=(attacker,target,profile)=>applyResolvedDamage(target,resolveCombatDamage({attacker,target,
    profile:engine.modifyDamage(attacker,target,legacy.prepareDamageProfile(attacker,target,profile)),
    statusMultiplier:engine.incomingMultiplier(target)*resolvePropertyMultiplier(target,profile),randomSource:engine.randomSource}));
const use=(unit,id,target=unit,allies=[unit],foes=[target])=>engine.execute(unit,id,target,{party:allies,enemies:foes});

// Validate all active effects at every tier through the real damage/status pipeline.
for(const definition of Object.values(CLASS_DEFINITIONS))for(let tier=1;tier<=3;tier++)for(const id of definition.skillIds){
    const skill=CLASS_SKILLS[id];if(skill.type!=="active")continue;
    const weapon={bow:"yew-bow",crossbow:"soldier-crossbow",firearm:"prototype-firearm",axe:"woodsman-axe",greatsword:"iron-greatsword"}[skill.weaponTypes?.[0]]||"traveler-sword";
    const unit=actor(definition.id,weapon,tier),ally=actor("infantry","traveler-sword",1,"dummy"),foe=enemy();
    if(skill.requiresShield)unit.equipment.shield="wooden-shield";
    if(skill.effect==="reload")unit.classCombat.loaded=false;
    if(skill.effect==="prayer")unit.hp=Math.floor(unit.maxHp*.1);
    ally.hp=50;ally.poisonTurns=2;ally.poisonDamage=5;
    const target=skill.targetType==="enemy"?foe:skill.targetType==="ally"?ally:unit;
    const result=use(unit,id,target,[unit,ally],[foe]);
    assert.equal(result.executed,true,`${id} tier ${tier}: ${result.reason}`);
    assert.ok(Number.isFinite(unit.ap));
}

const archer=actor("archer"),foe=enemy();
assert.match(engine.availability(archer,"aimed-shot").reason,/Requires Bow/);
const knight=actor("knight");assert.match(engine.availability(knight,"shield-bash").reason,/Requires Shield/);
knight.equipment.shield="wooden-shield";assert.equal(engine.availability(knight,"shield-bash").available,true);
knight.equipment.weapon="iron-greatsword";assert.equal(engine.availability(knight,"shield-bash").available,false);
const merc=actor("mercenary","soldier-crossbow",3);
assert.match(engine.availability(merc,"arquebus-shot").reason,/Requires Firearm/);
assert.equal(new ClassSystem().changeClass(merc,"infantry").changed,false,"runtime class changes are blocked");
assert.equal(use(merc,"crossbow-shot",foe).executed,true);
assert.equal(merc.classCombat.loaded,false);
assert.match(engine.availability(merc,"crossbow-shot").reason,/loaded/);
const beforeAp=merc.ap,beforeHp=foe.hp;
assert.equal(use(merc,"crossbow-shot",foe).executed,false);
assert.equal(merc.ap,beforeAp);assert.equal(foe.hp,beforeHp);
assert.equal(use(merc,"quick-reload").executed,true);assert.equal(merc.classCombat.loaded,true);
assert.equal(merc.classCombat.reloadBonus.damageBonus,.15);
assert.equal(use(merc,"crossbow-shot",foe).executed,true);
const prep=engine.getPrepareCommands([merc],TECHNIQUE_DEFINITIONS).find(command=>command.id===`reload:${merc.id}`);
assert.equal(prep.free,true);assert.equal(prep.execute(),true);assert.equal(merc.ap,beforeAp-1);
assert.equal(merc.classCombat.freeReloadUsed,true);
merc.classCombat.loaded=false;
assert.equal(engine.getPrepareCommands([merc]).find(command=>command.id===`reload:${merc.id}`).free,false);
engine.beginPrepare([merc]);assert.equal(engine.getPrepareCommands([merc]).find(command=>command.id===`reload:${merc.id}`).free,true,"boss Prepare resets the free allowance");

const ammoActor=actor("mercenary","soldier-crossbow",3);
assert.equal(new ClassSystem().selectAmmo(ammoActor,"bodkin"),true);
const penetrating=engine.beginAttack(ammoActor,{id:"test",element:"physical",damageRange:[20,20]});
assert.equal(penetrating.armorPenetration,.2);
assert.equal(new ClassSystem().selectAmmo(ammoActor,"incendiary"),false);
const firearm=actor("mercenary","prototype-firearm",3),second=enemy();
assert.equal(new ClassSystem().selectAmmo(firearm,"scatter"),true);
assert.equal(use(firearm,"arquebus-shot",foe,[firearm],[foe,second]).events.length,2);
assert.ok(second.hp<second.maxHp);
const broadhead=actor("mercenary","soldier-crossbow",3);new ClassSystem().selectAmmo(broadhead,"broadhead");
engine.randomSource=()=>.2;use(broadhead,"crossbow-shot",foe);assert.ok(foe.statusEffects.some(effect=>effect.id==="bleed"));engine.randomSource=()=>.5;

const protector=actor("knight","traveler-sword",3),ally=actor("archer","yew-bow",1,"dummy");
use(protector,"guard-ally",ally,[protector,ally]);
let interception=engine.intercept(ally,[protector,ally]);assert.equal(interception.target,protector);assert.equal(interception.reduction,.4);
assert.equal(engine.intercept(ally,[protector,ally]).target,ally,"explicit protection is consumed once");
ally.hp=1;engine.randomSource=()=>.1;assert.equal(engine.intercept(ally,[protector,ally]).target,protector);engine.randomSource=()=>.5;
use(protector,"defensive-stance");assert.equal(engine.incomingMultiplier(protector),.6);
assert.ok(engine.afterIncoming(foe,protector,{appliedDamage:5,hitType:"normal"}));
assert.equal(engine.afterIncoming(foe,protector,{appliedDamage:5,hitType:"normal"}),null);

const warrior=actor("warrior","woodsman-axe",3);
const healthy=enemy(),wounded=enemy();wounded.hp=200;
const full=use(warrior,"heavy-blow",healthy).events[0].finalDamage;
const low=use(warrior,"heavy-blow",wounded).events[0].finalDamage;
assert.ok(low>full);
engine.afterIncoming(foe,warrior,{appliedDamage:warrior.maxHp*.21});
const rush=warrior.statusEffects.find(effect=>effect.id==="blood-rush");assert.ok(rush.pending);
engine.statusManager.tickDurations([warrior]);assert.equal(rush.remainingTurns,2);engine.onRoundStart([warrior]);assert.equal(rush.pending,undefined);
engine.statusManager.tickDurations([warrior]);engine.statusManager.tickDurations([warrior]);assert.equal(warrior.statusEffects.length,0);

const hunter=actor("hunter","yew-bow",3),prey=enemy(["beast"]),otherHunter=actor("hunter","yew-bow",3,"dummy");
use(hunter,"hunters-mark",prey);
engine.addStatus(prey,"bleed",{},2);
const marked=engine.modifyDamage(hunter,prey,{attackMultiplier:1,element:"physical"}).attackMultiplier;
const unmarked=engine.modifyDamage(otherHunter,prey,{attackMultiplier:1,element:"physical"}).attackMultiplier;
assert.ok(marked>unmarked);assert.ok(unmarked>1.3);
use(hunter,"trap");assert.ok(engine.beforeEnemyAction(prey,[hunter]).events.length);assert.equal(engine.beforeEnemyAction(prey,[hunter]).events.length,0);
engine.addStatus(prey,"slow",{},2);use(hunter,"leg-shot",prey);assert.ok(prey.statusEffects.some(effect=>effect.id==="immobilize"));
assert.equal(engine.beforeEnemyAction(prey,[]).blocked,true);

const mage=actor("magician",null,3);
use(mage,"focus");const focused=engine.beginAttack(mage,TECHNIQUE_DEFINITIONS["ice-pike"]);
assert.equal(focused.attackMultiplier,1.35);assert.equal(engine.beginAttack(mage,TECHNIQUE_DEFINITIONS["ice-pike"]).attackMultiplier,undefined);
assert.equal(engine.getCost(mage,TECHNIQUE_DEFINITIONS["ice-pike"]),.85);
const wizard=actor("wizard",null,3);
use(wizard,"amplify");assert.equal(engine.getCost(wizard,TECHNIQUE_DEFINITIONS["ice-pike"]),1.25);
use(wizard,"chain-spell");use(wizard,"element-conversion");wizard.classState.selectedElement="fire";
const amplified=engine.beginAttack(wizard,TECHNIQUE_DEFINITIONS["ice-pike"]);
assert.equal(amplified.attackMultiplier,1.6);assert.equal(amplified.repeatMultiplier,.5);assert.equal(amplified.element,"fire");
const prepareSpell=engine.getPrepareCommands([wizard],TECHNIQUE_DEFINITIONS).find(command=>command.id.endsWith(":ice-pike"));
assert.equal(prepareSpell.execute(),true);assert.equal(engine.getCost(wizard,TECHNIQUE_DEFINITIONS["ice-pike"]),0);
engine.beginAttack(wizard,TECHNIQUE_DEFINITIONS["ice-pike"]);assert.equal(engine.getCost(wizard,TECHNIQUE_DEFINITIONS["ice-pike"]),1);
assert.equal(engine.getPrepareCommands([wizard],TECHNIQUE_DEFINITIONS).filter(command=>command.id.startsWith("prepare-spell:")).length,0);

const cleric=actor("cleric",null,3);ally.hp=10;ally.poisonTurns=3;ally.poisonDamage=5;engine.addStatus(ally,"curse",{negative:true},2);
assert.equal(use(cleric,"cleanse",ally,[cleric,ally]).executed,true);assert.equal(ally.poisonTurns,0);assert.equal(ally.statusEffects.length,0);
assert.ok(use(cleric,"mend",ally,[cleric,ally]).events[0].healed>0);
use(cleric,"blessing",ally,[cleric,ally]);use(cleric,"blessing",ally,[cleric,ally]);assert.equal(ally.statusEffects.filter(effect=>effect.id==="blessing").length,1);
for(let round=0;round<4;round++)engine.statusManager.tickDurations([ally]);assert.equal(ally.statusEffects.length,0);
const crusader=actor("crusader",null,3);crusader.hp=10;
assert.equal(use(crusader,"last-prayer").executed,true);
applyResolvedDamage(crusader,{appliedDamage:999});assert.equal(crusader.hp,1);assert.equal(crusader.classCombat.survival,undefined);
assert.equal(use(crusader,"last-prayer").executed,false);
const overkill=actor("crusader",null,3);overkill.classCombat.survival=true;
applyResolvedDamage(overkill,{appliedDamage:999,isOverkill:true});assert.equal(overkill.hp,0);

const multishot=actor("bow-master","yew-bow",3);
let rolls=[.99,.5,.5,.5,.5,.01,.5];engine.randomSource=()=>rolls.shift()??.5;
const arrows=use(multishot,"triple-shot",enemy()).events;
assert.equal(arrows.length,3);assert.equal(arrows[0].hitType,"miss");assert.equal(arrows[1].hitType,"normal");assert.equal(arrows[2].hitType,"fatal");engine.randomSource=()=>.5;

const mastery=new MasteryManager(world);classes.changeClass(member,"archer");
for(let encounter=0;encounter<3;encounter++){mastery.recordUse(member.id,"technique:pinning-shot",{encounterId:`practice-${encounter}`});mastery.recordUse(member.id,"technique:pinning-shot",{encounterId:`practice-${encounter}`});}
assert.equal(member.mastery["technique:pinning-shot"],3);assert.equal(getSkillTier(member,"pinning-shot"),2);
const memory=new Map(),saves=new SaveManager({setItem:(key,value)=>memory.set(key,value),getItem:key=>memory.get(key)});
assert.equal(saves.save("class-test",world),true);
const restored=saves.load("class-test");assert.equal(getSkillTier(restored.party[0],"pinning-shot"),2);assert.equal(restored.party[0].classState.currentClass,"archer");
assert.equal(normalizeGameState({party:[{id:"luke"}]}).party[0].classState.currentClass,"infantry");
assert.equal(normalizeGameState({party:[{id:"luke",classState:{currentClass:"missing",unlockedClasses:null,skillMastery:{"aimed-shot":999}}}]}).party[0].classState.currentClass,"infantry");
const previousMastery=structuredClone(merc.mastery);clearClassCombat(merc);assert.equal(merc.classCombat,undefined);assert.deepEqual(merc.mastery,previousMastery);
assert.ok(uses.some(([,discipline])=>discipline==="technique:crossbow-shot"));
assert.ok(uses.some(([,discipline])=>discipline==="crossbow"));
assert.ok(!foe.classState,"enemies must not acquire the default player class");
console.log("Class system: all 11 classes and active skill tiers, gating, reload, ammo, Prepare, reactions, conditions, spells, mastery and save migration passed.");
