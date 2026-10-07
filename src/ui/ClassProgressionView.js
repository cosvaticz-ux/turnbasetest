import { CLASS_DEFINITIONS } from "../data/classes.js";
import { CLASS_SKILLS, CLASS_BALANCE, AMMUNITION } from "../data/classSkills.js";
import { ClassSystem, ensureClassState, getActiveClassSkills, getSkillTier, getClassStatModifiers } from "../core/ClassSystem.js";
import { getEquippedWeapon } from "../data/weapons.js";
import { PARTY_MEMBER_DEFINITIONS } from "../core/PartyManager.js";

const node = (tag, text, className = "") => {
    const element = document.createElement(tag);
    element.textContent = text;
    element.className = className;
    return element;
};
function button(text, callback, disabled = false) {
    const element = node("button",text);
    element.type = "button";
    element.disabled = disabled;
    element.addEventListener("click",callback);
    return element;
}
function choice(label, entries, current, choose) {
    const wrapper=node("label",label,"class-choice");
    const select=node("select","");
    for(const [id,name] of entries){const option=node("option",name);option.value=id;option.selected=id===current;select.append(option);}
    select.value=current;
    select.addEventListener("change",()=>choose(select.value));
    wrapper.append(select);
    return wrapper;
}
export function renderClassProgression({ container, member, gameState, category, persist, rerender }) {
    const manager=new ClassSystem(gameState), state=ensureClassState(member), current=CLASS_DEFINITIONS[state.currentClass];
    const view=node("div","","class-progression-view");
    view.append(node("h3",`${member.name} · ${current.name}`),node("p",current.description));
    const save=()=>{persist?.();rerender?.();};
    if(category==="classes") {
        view.append(node("p","Class unlocks use proficiency and world training. Learned mastery stays with the character."));
        for(const definition of Object.values(CLASS_DEFINITIONS)) {
            const check=manager.canChangeClass(member,definition.id);
            const card=node("article","","class-progression-card");
            const unlocked=state.unlockedClasses.includes(definition.id);
            card.append(node("h4",`${definition.name} · ${definition.id===current.id?"Current":unlocked?"Unlocked":check.allowed?"Available":"Locked"}`),node("p",definition.description),node("small",`Affinities: ${definition.weaponAffinities.join(", ")}`));
            for(const requirement of check.requirements||[])card.append(node("p",`${requirement.met?"✓":"○"} ${requirement.label}`));
            const change=button("Equip class",()=>{
                if(!manager.changeClass(member,definition.id).changed)return;
                const base=PARTY_MEMBER_DEFINITIONS[member.id];
                member.maxHp=base.maxHp+getClassStatModifiers(member,base).maxHp;
                member.hp=Math.min(member.hp,member.maxHp);
                save();
            },!check.allowed||definition.id===current.id);
            change.title=check.reason;
            card.append(change);view.append(card);
        }
    } else if(category==="class-skills") {
        const weapon=getEquippedWeapon(member.equipment);
        if(getActiveClassSkills(member).some(skill=>["elemental-study","element-conversion"].includes(skill.id)))view.append(choice("Studied / conversion element",CLASS_BALANCE.elements.map(id=>[id,id]),state.selectedElement,id=>{manager.selectElement(member,id);save();}));
        if(current.id==="mercenary") {
            const tier=getSkillTier(member,"special-ammunition");
            const ammunition=Object.values(AMMUNITION).filter(ammo=>ammo.tier<=tier&&ammo.weaponTypes.includes(weapon.type));
            if(ammunition.length)view.append(choice("Ammunition",ammunition.map(ammo=>[ammo.id,ammo.name]),state.ammoId,id=>{manager.selectAmmo(member,id);save();}));
            else view.append(node("p","Equip a crossbow or firearm to select ammunition."));
        }
        for(const skill of getActiveClassSkills(member)) {
            const tier=getSkillTier(member,skill.id),card=node("article","","class-progression-card");
            const reason=skill.weaponTypes?.length&&!skill.weaponTypes.includes(weapon.type)?`Requires ${skill.weaponTypes.join(" / ")}`:skill.requiresShield&&(!member.equipment?.shield||weapon.hands>1)?"Requires Shield and a one-hand weapon":"Available with current equipment";
            card.append(node("h4",`${skill.name} ${["I","II","III"][tier-1]} · ${skill.type}`),node("p",skill.description),node("small",reason));
            const values=skill.tiers[tier-1];
            const details=[];
            if(values.damageMultiplier)details.push(`${Math.round(values.damageMultiplier*100)}% × ${skill.hitCount} hit${skill.hitCount===1?"":"s"}`);
            if(values.armorPenetration)details.push(`${Math.round(values.armorPenetration*100)}% armor penetration`);
            if(values.chance)details.push(`${Math.round(values.chance*100)}% ${values.status}`);
            if(values.duration)details.push(`${values.duration} round${values.duration===1?"":"s"}`);
            if(skill.type==="active")details.push(`${skill.apCost} base AP`);
            card.append(node("p",details.join(" · ")));
            view.append(card);
        }
    } else {
        view.append(node("p","Practice is capped at one gain per discipline per meaningful encounter. Trainers, quests, manuals and discoveries can also grant mastery."));
        view.append(node("h4","Weapon and discipline mastery"));
        for(const [id,amount] of Object.entries(member.mastery||{}).filter(([id])=>!id.startsWith("technique:"))) {
            const level=CLASS_BALANCE.weaponThresholds.filter(threshold=>amount>=threshold).length;
            const next=CLASS_BALANCE.weaponThresholds[level];
            view.append(node("p",`${id}: mastery ${level} · ${amount}${next?` / ${next} practice`:" · complete"}`));
        }
        view.append(node("h4","Technique mastery (including inactive classes)"));
        const ids=[...new Set([...state.ownedSkills,...Object.keys(member.mastery||{}).filter(id=>id.startsWith("technique:")).map(id=>id.slice(10))])];
        for(const id of ids){const tier=getSkillTier(member,id),progress=member.mastery?.[`technique:${id}`]||0,next=CLASS_BALANCE.skillThresholds[tier];view.append(node("p",`${CLASS_SKILLS[id]?.name||id}: ${["I","II","III"][tier-1]} · ${progress}${next?` / ${next} practice`:" · mastered"}`));}
    }
    container.replaceChildren(view);
}
