import { CLASS_SKILLS, CLASS_BALANCE, AMMUNITION } from "../data/classSkills.js";
import { getEquippedWeapon } from "../data/weapons.js";
import { EQUIPMENT_DEFINITIONS } from "../data/items.js";
import { ensureClassState, getActiveClassSkills, getPassiveValues, getSkillTier, ClassSystem } from "./ClassSystem.js";
import { StatusEffectManager } from "../battle/StatusEffectManager.js";
import { rollChance, randomInt } from "../utils/RNG.js";

export const living = actor => Boolean(actor && (actor.isAlive ? actor.isAlive() : actor.hp > 0));
const status = (actor, id) => actor?.statusEffects?.find(effect => effect.id === id);
const physical = profile => !profile.magic && (!profile.element || profile.element === "physical");
export const enemyTags = actor => [...(actor?.properties?.types || []), ...(actor?.properties?.tags || []), ...(actor?.tags || []), actor?.properties?.type || "", actor?.properties?.family || ""].map(tag => String(tag).toLowerCase().replaceAll("-", ""));
const hasTags = (actor, tags = []) => tags.some(tag => enemyTags(actor).includes(tag));
const negative = ["bleed", "burn", "slow", "immobilize", "stun", "stagger", "fear", "curse", "armor-broken", "arcane-broken", "poison"];

export function initializeClassCombat(actor) {
    ensureClassState(actor);
    actor.classCombat = { loaded: true, used: [], incomingDamage: 0, pressure: false, freeReloadUsed: false, preparedUsed: false, primes: {} };
    return actor.classCombat;
}
export function clearClassCombat(actor) {
    delete actor.classCombat;
    actor.statusEffects = (actor.statusEffects || []).filter(effect => !effect.classEffect);
}
export function resolveClassSkill(actor, id) {
    const skill = CLASS_SKILLS[id];
    if (!skill) return null;
    return { ...skill, ...skill.tiers[getSkillTier(actor, id) - 1], masteryTier: getSkillTier(actor, id), classSkill: true };
}

// One effect interpreter shared by battle commands, Prepare and tests. The scene
// supplies its existing damage pipeline, logs and mastery-use collector.
export class ClassCombat {
    constructor({ statusManager = new StatusEffectManager(), randomSource = Math.random, damage = null, recordUse = () => {}, gameState = null } = {}) {
        Object.assign(this, { statusManager, randomSource, damage, recordUse, gameState });
    }
    state(actor) { return actor.classCombat || initializeClassCombat(actor); }
    addStatus(actor, id, values, duration = 1) {
        return this.statusManager.apply(actor, { id, name: id.replaceAll("-", " "), classEffect: true, remainingTurns: duration, ...values });
    }
    getCost(actor, skill) {
        const state = this.state(actor);
        if (skill.effect === "reload") return CLASS_BALANCE.reloadAp;
        if (skill.magic || (!physical(skill) && skill.damageRange)) {
            if (state.preparedSpell === skill.id) return 0;
            const reduction = getPassiveValues(actor, "mana-control").costReduction || 0;
            const increase = (skill.damageRange || skill.damageMultiplier)
                ? Object.values(state.primes).reduce((sum, prime) => sum + (prime.costIncrease || 0), 0) : 0;
            return Math.round((skill.apCost || 0) * (1 - reduction) * (1 + increase) * 100) / 100;
        }
        return skill.apCost || 0;
    }
    attackReason(actor) {
        return getEquippedWeapon(actor.equipment).requiresReload && !this.state(actor).loaded ? "Weapon must be loaded" : "";
    }
    availability(actor, id, { party = [], prepare = false, target = null } = {}) {
        const skill = resolveClassSkill(actor, id);
        let reason = "";
        if (!skill || !getActiveClassSkills(actor).some(entry => entry.id === id)) reason = "Requires active class";
        else if (skill.type === "passive") reason = "Passive trait";
        else if (!living(actor)) reason = "Character cannot act";
        else {
            const weapon = getEquippedWeapon(actor.equipment), state = this.state(actor);
            if (skill.weaponTypes?.length && !skill.weaponTypes.includes(weapon.type)) reason = `Requires ${skill.weaponTypes.map(type => type[0].toUpperCase() + type.slice(1)).join(" / ")}`;
            else if (skill.requiresShield && (EQUIPMENT_DEFINITIONS[actor.equipment?.shield]?.slot !== "shield" || weapon.hands > 1)) reason = "Requires Shield and a one-hand weapon";
            else if (skill.requiresLoaded && !state.loaded) reason = "Weapon must be loaded";
            else if (skill.effect === "reload" && state.loaded) reason = "Weapon is already loaded";
            else if (skill.oncePerBattle && state.used.includes(id)) reason = "Already used this battle";
            else if (skill.hpRequirement && actor.hp / actor.maxHp >= skill.hpRequirement) reason = `Requires HP below ${skill.hpRequirement * 100}%`;
            else if (skill.effect === "protect" && !party.some(ally => ally !== actor && living(ally))) reason = "Requires another living ally";
            else if (skill.effect === "prime" && state.primes[id]) reason = "Already prepared";
            else if (skill.effect === "trap" && state.trap) reason = "Trap already set";
            else if (target && skill.effect === "heal" && target.hp >= target.maxHp) reason = "Target HP is full";
            else if (target && skill.effect === "cleanse" && !this.canCleanse(target,skill)) reason = "No removable condition";
            else if (!prepare && actor.ap < this.getCost(actor, skill)) reason = `Requires ${this.getCost(actor, skill)} AP`;
        }
        return { available: !reason, reason, skill, cost: skill ? this.getCost(actor, skill) : 0 };
    }
    record(actor, skill) {
        this.recordUse(actor.id, `technique:${skill.id}`);
        for (const passive of getActiveClassSkills(actor).filter(entry => entry.type === "passive")) this.recordUse(actor.id,`technique:${passive.id}`);
        if (skill.damageMultiplier || skill.effect === "trap") this.recordUse(actor.id, skill.magic ? "structuredMagic" : getEquippedWeapon(actor.equipment).masteryDiscipline);
        else if (skill.effect === "heal") this.recordUse(actor.id, "restoration");
    }
    reload(actor, { free = false } = {}) {
        const weapon = getEquippedWeapon(actor.equipment), state = this.state(actor);
        if (!living(actor) || !weapon.requiresReload || state.loaded || (!free && actor.ap < CLASS_BALANCE.reloadAp)) return false;
        if (!free) actor.ap = Math.max(0, actor.ap - CLASS_BALANCE.reloadAp);
        const quick = getPassiveValues(actor, "quick-reload"), soldier = getPassiveValues(actor, "professional-soldier");
        state.loaded = true;
        state.reloadBonus = { accuracyBonus: quick.reloadAccuracy || 0, damageBonus: soldier.reloadDamage || 0, armorPenetration: soldier.reloadPenetration || 0 };
        if (!free) actor.ap = Math.min(actor.maxAp, actor.ap + (soldier.reloadRefund || 0));
        this.recordUse(actor.id, `technique:quick-reload`);
        if (soldier.accuracyBonus) this.recordUse(actor.id,"technique:professional-soldier");
        return true;
    }
    // Snapshot next-attack modifiers once. A multi-hit/area attack shares the
    // snapshot, so reload and one-shot buffs are consumed once per action.
    beginAttack(actor, profile) {
        const state = this.state(actor), weapon = getEquippedWeapon(actor.equipment);
        const next = { ...profile, classAttack: true };
        if (profile.classSkill && profile.damageMultiplier) {
            next.damageRange = profile.magic ? CLASS_BALANCE.magicDamageRange : weapon.damageRange;
            next.attackMultiplier = profile.damageMultiplier;
        }
        const isMagic = !physical(next);
        next.magic = isMagic;
        if (!isMagic && weapon.requiresReload) {
            state.loaded = false;
            next.attackMultiplier = (next.attackMultiplier || 1) * (1 + (state.reloadBonus?.damageBonus || 0));
            next.accuracyModifier = (next.accuracyModifier || 0) + (state.reloadBonus?.accuracyBonus || 0);
            next.armorPenetration = (next.armorPenetration || 0) + (state.reloadBonus?.armorPenetration || 0);
            delete state.reloadBonus;
            const ammo = AMMUNITION[ensureClassState(actor).ammoId];
            if (ammo?.weaponTypes.includes(weapon.type) && ammo.tier <= (getPassiveValues(actor, "special-ammunition").ammoTier || 0)) {
                next.ammo = ammo;
                next.armorPenetration += ammo.armorPenetration || 0;
                next.attackMultiplier *= ammo.damageMultiplier || 1;
            }
        }
        for (const [id, prime] of Object.entries(state.primes)) {
            if ((prime.primeKind === "spell" && isMagic) || (prime.primeKind === "bow" && !isMagic && weapon.type === "bow")) {
                next.attackMultiplier = (next.attackMultiplier || 1) * (1 + (prime.spellBonus || 0));
                next.critModifier = (next.critModifier || 0) + (prime.critBonus || 0);
                if (prime.guaranteedHit) next.guaranteedHit = true;
                if (prime.convert) next.element = ensureClassState(actor).selectedElement;
                next.repeatMultiplier = prime.repeatMultiplier || next.repeatMultiplier;
                delete state.primes[id];
            }
        }
        if (state.preparedSpell === profile.id) delete state.preparedSpell;
        return next;
    }
    modifyDamage(actor, target, profile) {
        const next = { ...profile };
        let multiplier = next.attackMultiplier || 1;
        const weapon = getEquippedWeapon(actor?.equipment);
        if (actor?.classState) {
            for (const skill of getActiveClassSkills(actor).filter(entry => entry.type === "passive")) {
                if (skill.weaponTypes?.length && !skill.weaponTypes.includes(weapon.type)) continue;
                const tier = skill.tiers[getSkillTier(actor, skill.id) - 1];
                if (physical(next)) multiplier *= 1 + (tier.weaponDamage || 0);
                next.critModifier = (next.critModifier || 0) + (tier.critBonus || 0);
                if (physical(next)) next.criticalDamageBonus = (next.criticalDamageBonus || 0) + (tier.criticalDamageBonus || 0);
                next.accuracyModifier = (next.accuracyModifier || 0) + (tier.accuracyBonus || 0);
                if (hasTags(target, skill.bonusTags)) multiplier *= 1 + (tier.typeBonus || 0);
                if (tier.elementBonus && next.element === ensureClassState(actor).selectedElement) multiplier *= 1 + tier.elementBonus;
                if (tier.conditionBonus && (target.poisonTurns > 0 || ["bleed", "poison", "slow", "armor-broken"].some(id => status(target,id)))) multiplier *= 1 + tier.conditionBonus;
            }
        }
        for (const effect of actor?.statusEffects || []) {
            if (effect.pending) continue;
            multiplier *= 1 + (effect.attackBonus || 0);
            next.critModifier = (next.critModifier || 0) + (effect.critBonus || 0);
        }
        const mark = status(target, `marked:${actor?.id}`);
        multiplier *= 1 + (mark?.markBonus || 0);
        if (next.lowHpThreshold && target.hp / target.maxHp < next.lowHpThreshold) multiplier *= 1 + (next.lowHpBonus || 0);
        if (status(target,"bleed")) multiplier *= 1 + (next.bleedBonus || 0);
        if (hasTags(target, next.bonusTags)) multiplier *= 1 + (next.typeBonus || 0);
        if (hasTags(target, next.ammo?.bonusTags)) multiplier *= 1 + (next.ammo?.typeBonus || 0);
        next.attackMultiplier = multiplier;
        const defenseBuff = (target.statusEffects || []).reduce((sum,effect) => sum + (effect.defenseBonus || 0), 0);
        next.targetDefenseMultiplier = (next.targetDefenseMultiplier ?? 1) * (1 + defenseBuff);
        if (!physical(next)) next.targetDefenseMultiplier *= status(target,"arcane-broken")?.magicDefenseMultiplier ?? 1;
        if (status(actor,"slow")) next.accuracyModifier = (next.accuracyModifier || 0) - CLASS_BALANCE.slowAccuracyPenalty;
        if (next.classAttack) next.accuracy = next.guaranteedHit ? 1 : CLASS_BALANCE.baseAccuracy + (next.accuracyModifier || 0);
        else if (status(actor,"slow")) next.accuracy = (next.accuracy ?? 1) - CLASS_BALANCE.slowAccuracyPenalty;
        return next;
    }
    incomingMultiplier(target) {
        return (target?.statusEffects || []).reduce((value, effect) => value * (1 - (effect.reduction || 0)), 1);
    }
    applyCondition(actor, target, profile) {
        if (!living(target) || !profile.status || (profile.requiresPressure && !this.state(actor).pressure)) return false;
        const resistance = Number(target.properties?.statusResistances?.[profile.status]) || 0;
        const ward = ["curse","fear"].includes(profile.status) ? status(target,"ward-of-faith")?.resistance || 0 : 0;
        const passiveResistance = profile.status === "bleed" ? getPassiveValues(target,"battle-hardened").bleedResistance || 0 : 0;
        if (!rollChance((profile.chance ?? 1) + (profile.shieldChanceBonus || 0) - resistance - ward - passiveResistance, this.randomSource)) return false;
        const id = profile.root && status(target,"slow") ? "immobilize" : profile.status;
        return this.addStatus(target, id, {
            negative: true, defenseMultiplier: profile.defenseMultiplier,
            magicDefenseMultiplier: profile.magicDefenseMultiplier,
            damagePerTurn: ["bleed","burn"].includes(id) ? CLASS_BALANCE.dotDamage : 0
        }, id === "immobilize" ? 1 : profile.duration || 1);
    }
    cleanse(target, skill) {
        const allowed = this.cleanseIds(skill);
        let count = 0;
        if (allowed.includes("poison") && target.poisonTurns > 0) { target.poisonTurns = 0; target.poisonDamage = 0; count++; }
        for (const effect of [...(target.statusEffects || [])]) {
            if (count >= skill.cleanseCount) break;
            if (allowed.includes(effect.id)) { this.statusManager.remove(target,effect.id); count++; }
        }
        return count;
    }
    cleanseIds(skill) {
        const allowed = skill.physicalOnly ? ["poison","bleed"] : negative.filter(id => !["curse","fear"].includes(id));
        if (skill.curse) allowed.push("curse");
        if (skill.fear) allowed.push("fear");
        return allowed;
    }
    canCleanse(target,skill) {
        const allowed=this.cleanseIds(skill);
        return (target.poisonTurns>0 && allowed.includes("poison")) || (target.statusEffects||[]).some(effect=>allowed.includes(effect.id));
    }
    execute(actor, id, target, { party = [], enemies = [] } = {}) {
        const check = this.availability(actor,id,{party});
        if (!check.available) return { executed: false, reason: check.reason };
        const { skill, cost } = check, state = this.state(actor);
        if (skill.targetType === "self") target = actor;
        if (skill.targetType === "all-allies") target = actor;
        const validTargets = skill.targetType === "enemy" ? enemies : party;
        if (!living(target) || (!['self','all-allies'].includes(skill.targetType) && !validTargets.includes(target))) return { executed: false, reason: "Invalid target" };
        if (skill.effect === "protect" && actor === target) return { executed: false, reason: "Select another ally" };
        if (skill.effect === "reload") return { executed: this.reload(actor), events: [], message: `${actor.name} reloads.` };
        if (skill.effect === "heal" && target.hp >= target.maxHp) return { executed: false, reason: "Target HP is full" };
        if (skill.effect === "cleanse" && !this.cleanse(target,skill)) return { executed: false, reason: "No removable condition" };
        actor.ap = Math.max(0, Math.round((actor.ap - cost)*100)/100);
        if (skill.oncePerBattle) state.used.push(id);
        this.record(actor, skill);
        const events = [];
        const handlers = {
            stance: () => this.addStatus(actor,"counter-stance",{ reduction: skill.reduction || 0, counter: skill.counter },skill.duration),
            protect: () => this.addStatus(target,"protected",{ protectorId: actor.id, protectionReduction: skill.reduction, martyrBonus: skill.martyrBonus },skill.duration),
            ward: () => this.addStatus(target,"ward-of-faith",{resistance:skill.resistance},skill.duration),
            mark: () => this.addStatus(target,`marked:${actor.id}`,{markBonus:skill.markBonus},skill.duration),
            trap: () => { state.trap = { ...skill }; },
            prime: () => { state.primes[id] = skill; },
            blessing: () => this.addStatus(target,"blessing",{attackBonus:skill.attackBonus,defenseBonus:skill.defenseBonus},skill.duration),
            sanctuary: () => party.filter(living).forEach(ally => this.addStatus(ally,"sanctuary",{reduction:skill.reduction},skill.duration)),
            heal: () => { const healed = Math.min(target.maxHp-target.hp,Math.floor(randomInt(...CLASS_BALANCE.healRange,this.randomSource)*skill.healingMultiplier)); target.hp += healed; events.push({target,healed}); },
            prayer: () => { const healed = Math.min(actor.maxHp-actor.hp,Math.floor(actor.maxHp*skill.healRatio)); actor.hp += healed; if(skill.survival)state.survival=true; events.push({target:actor,healed}); },
            cleanse: () => {},
            reveal: () => {
                const resistances = target.properties?.resistances || {};
                const info = Object.entries(resistances).filter(([,value]) => skill.revealTier >= 2 || value > 1).map(([key,value]) => `${key} ×${value}`);
                if(skill.revealTier>=3)info.push(`Status resistance: ${JSON.stringify(target.properties?.statusResistances || {})}`);
                events.push({target,info: info.join(", ") || "No known weaknesses"});
                if(this.gameState){const key=`bestiary:${target.definitionId || target.id}:tier${skill.revealTier}`;this.gameState.knowledge ||= [];if(!this.gameState.knowledge.includes(key))this.gameState.knowledge.push(key);}
            }
        };
        if (skill.damageMultiplier && !skill.effect) {
            const profile = this.beginAttack(actor,skill);
            const targets = profile.ammo?.allEnemies ? enemies.filter(living) : [target];
            if(skill.secondaryMultiplier){const secondary=enemies.find(enemy=>enemy!==target&&living(enemy));if(secondary)targets.push(secondary);}
            for(const victim of targets) {
                const secondary = victim !== target && skill.secondaryMultiplier ? skill.secondaryMultiplier : 1;
                for(let hit=0;hit<(skill.hitCount||1);hit++) {
                    if(!living(victim))break;
                    const hitProfile={...profile,attackMultiplier:(profile.attackMultiplier||1)*secondary};
                    const result=this.damage(actor,victim,hitProfile);
                    events.push({target:victim,...result});
                    if(result.hitType!=="miss"){this.applyCondition(actor,victim,skill);if(profile.ammo)this.applyCondition(actor,victim,profile.ammo);}
                    if(profile.repeatMultiplier&&living(victim)){const repeat=this.damage(actor,victim,{...hitProfile,attackMultiplier:hitProfile.attackMultiplier*profile.repeatMultiplier});events.push({target:victim,...repeat});}
                }
            }
        } else handlers[skill.effect]?.();
        return { executed: true, events, message: `${actor.name} uses ${skill.name}${target !== actor ? ` on ${target.name}` : ""}.` };
    }
    intercept(target, party) {
        const protection = status(target,"protected");
        const protector = party.find(ally => ally.id === protection?.protectorId && living(ally));
        if(protector){this.statusManager.remove(target,"protected");return{target:protector,reduction:protection.protectionReduction||0,martyrBonus:protection.martyrBonus||0};}
        for(const ally of party.filter(member=>member!==target&&living(member))){const trait=getPassiveValues(ally,"hold-the-line");if(target.hp/target.maxHp < (trait.allyHpThreshold||0)&&rollChance(trait.interceptChance,this.randomSource))return{target:ally,reduction:0};}
        return {target,reduction:0};
    }
    beforeEnemyAction(enemy, party) {
        const events=[];
        for(const actor of party.filter(living)){
            const state=this.state(actor), trap=state.trap;
            if(!trap||!living(enemy))continue;
            delete state.trap;
            const profile={...trap,damageRange:getEquippedWeapon(actor.equipment).damageRange,attackMultiplier:trap.damageMultiplier,classAttack:true};
            const result=this.damage(actor,enemy,profile);events.push({target:enemy,...result});
            if(result.hitType!=="miss")this.applyCondition(actor,enemy,trap);
        }
        const blocked=["stun","immobilize","stagger"].find(id=>status(enemy,id));
        if(blocked)this.statusManager.remove(enemy,blocked);
        return {events,blocked:Boolean(blocked)||!living(enemy)};
    }
    afterIncoming(enemy, target, result, intercept = {}) {
        const state=this.state(target);
        state.pressure=true;
        state.incomingDamage += result.appliedDamage || 0;
        const blood=getPassiveValues(target,"blood-rush");
        if(blood.damageThreshold&&state.incomingDamage>=target.maxHp*blood.damageThreshold){state.incomingDamage=0;this.addStatus(target,"blood-rush",{attackBonus:blood.attackBonus,critBonus:blood.critBonus,pending:true},blood.duration);}
        if(intercept.martyrBonus && result.appliedDamage > 0)this.addStatus(target,"martyr-strength",{attackBonus:intercept.martyrBonus,pending:true},1);
        const stance=status(target,"counter-stance");
        if(stance?.counter && living(target) && living(enemy) && result.hitType !== "miss"){
            this.statusManager.remove(target,"counter-stance");
            return this.damage(target,enemy,{damageRange:getEquippedWeapon(target.equipment).damageRange,attackMultiplier:stance.counter,element:"physical"});
        }
        return null;
    }
    onRoundStart(party) {
        for(const actor of party){const state=this.state(actor);state.pressure=false;for(const effect of actor.statusEffects||[])if(effect.pending)delete effect.pending;}
    }
    getPrepareCommands(party, techniques = {}) {
        const commands=[];
        for(const actor of party.filter(living)) {
            const state=this.state(actor), weapon=getEquippedWeapon(actor.equipment);
            const add=(id,name,enabled,execute,free=false)=>commands.push({id,elementId:id,icon:"◇",name:`${actor.name} · ${name}`,costLabel:free?"Free":"Prepare",enabled,execute,free});
            if(weapon.requiresReload){
                const free=Boolean(getPassiveValues(actor,"quick-reload").freePrepare&&!state.freeReloadUsed);
                add(`reload:${actor.id}`,"Reload",!state.loaded,()=>{const done=this.reload(actor,{free:true});if(done&&free)state.freeReloadUsed=true;return done;},free);
                const ammoTier=getPassiveValues(actor,"special-ammunition").ammoTier||0;
                for(const ammo of Object.values(AMMUNITION).filter(ammo=>ammo.weaponTypes.includes(weapon.type)&&ammo.tier<=ammoTier))add(`ammo:${actor.id}:${ammo.id}`,`Ammo: ${ammo.name}`,ensureClassState(actor).ammoId!==ammo.id,()=>new ClassSystem().selectAmmo(actor,ammo.id),true);
            }
            if(getActiveClassSkills(actor).some(skill=>skill.id==="prepared-spell")&&!state.preparedUsed){
                const spells=[...(actor.knownTechniques||[]).map(id=>techniques[id]),...getActiveClassSkills(actor)].filter(skill=>skill&&(skill.magic||(!physical(skill)&&skill.damageRange))&&(skill.damageRange||skill.tiers?.[0]?.damageMultiplier));
                for(const spell of spells)add(`prepare-spell:${actor.id}:${spell.id}`,`Prepare ${spell.name}`,true,()=>{state.preparedSpell=spell.id;state.preparedUsed=true;this.recordUse(actor.id,"technique:prepared-spell");return true;});
            }
        }
        return commands;
    }
    beginPrepare(party){for(const actor of party){const state=this.state(actor);state.freeReloadUsed=false;state.preparedUsed=false;}}
}
