// Explicit import-only development helpers. No production UI or global controls.
import { CLASS_DEFINITIONS } from "../data/classes.js";
import { CLASS_SKILLS } from "../data/classSkills.js";
import { ensureClassState, getSkillTier } from "./ClassSystem.js";
import { initializeClassCombat } from "./ClassCombat.js";
export const ClassDebug = {
    unlockAll(member) { const state=ensureClassState(member);state.unlockedClasses=Object.keys(CLASS_DEFINITIONS);state.ownedSkills=Object.keys(CLASS_SKILLS);return state; },
    setSkillTier(member,id,tier) { if(!CLASS_SKILLS[id] || !Number.isInteger(tier) || tier<1 || tier>3)return false;const state=ensureClassState(member);state.skillMastery[id]=tier;member.mastery ||= {};member.mastery[`technique:${id}`]=0;return true; },
    setWeaponMastery(member,id,amount) { if(!Number.isFinite(amount)||amount<0)return false;member.mastery ||= {};member.mastery[id]=amount;return true; },
    reload(actor) { (actor.classCombat || initializeClassCombat(actor)).loaded=true; },
    inspect(member) { return structuredClone({classState:ensureClassState(member),mastery:member.mastery,tiers:Object.fromEntries(ensureClassState(member).ownedSkills.map(id=>[id,getSkillTier(member,id)])),combat:member.classCombat}); }
};
