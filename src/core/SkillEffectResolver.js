export class SkillEffectResolver {
 has(actor,id){return actor?.unlockedSkills?.includes(id)||actor?.progression?.unlockedSkills?.includes(id);}
 prepareDamageProfile(actor,target,profile){const next={...profile};let multiplier=Number(next.attackMultiplier)||1;if(this.has(actor,"execution-window")&&target?.maxHp>0&&target.hp/target.maxHp<=.3)multiplier*=1.2;if(this.has(actor,"riposte")&&actor.riposteReady)multiplier*=1.25;if(this.has(actor,"veterans-instinct"))next.critModifier=(Number(next.critModifier)||0)+.05;next.attackMultiplier=multiplier;const broken=target?.statusEffects?.find(status=>status.id==="armor-broken");if(broken)next.targetDefenseMultiplier=Number(broken.defenseMultiplier)||.7;return next;}
 getIncomingMultiplier(target){let value=1;if(this.has(target,"counterstep"))value*=.92;if(this.has(target,"veterans-instinct"))value*=.95;return value;}
 afterDamage(attacker,target,{wasGuarding=false}={}){if(attacker?.riposteReady)attacker.riposteReady=false;if(wasGuarding&&this.has(target,"riposte")&&target?.isAlive?.())target.riposteReady=true;}
 applyOnHit(actor,target,skillId,statusManager){if(skillId!=="armor-break"||!target?.isAlive?.())return false;return statusManager.apply(target,{id:"armor-broken",name:"Armor Broken",modifierText:"Defense reduced by 30%",defenseMultiplier:.7,remainingTurns:2});}
 applyActiveEffect(actor,effectId){
  if(!actor?.isAlive?.())return{applied:false,reason:"invalid-actor"};
  if(effectId==="guard-stance"){if(actor.isGuarding)return{applied:false,reason:"already-guarding"};actor.isGuarding=true;actor.guardDamageMultiplier=.35;return{applied:true,healed:0,message:`${actor.name} enters Guard Stance.`};}
  if(effectId==="second-wind"){if(actor.secondWindUsed||actor.hp>=actor.maxHp)return{applied:false,reason:"unavailable"};const healed=Math.min(actor.maxHp-actor.hp,Math.max(1,Math.floor(actor.maxHp*.3)));actor.hp+=healed;actor.secondWindUsed=true;return{applied:true,healed,message:`${actor.name} recovers ${healed} HP.`};}
  return{applied:false,reason:"unknown-effect"};
 }
}
