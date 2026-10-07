import { SKILL_DEFINITIONS, STARTER_SKILL_IDS } from "../data/skills.js";
import { normalizeCharacterProgression } from "./Progression.js";
export class SkillManager {
 constructor(gameState, definitions = SKILL_DEFINITIONS) { this.gameState = gameState; this.definitions = definitions; }
 getCharacter(id) { return this.gameState?.party?.find(member => member?.id === id) || null; }
 getProgression(id) { const member = this.getCharacter(id); if (!member) return null; member.progression = normalizeCharacterProgression(member); return member.progression; }
 getStatus(characterId, skillId) { const progression=this.getProgression(characterId), skill=this.definitions[skillId]; if(!progression||!skill)return{status:"locked",reason:!progression?"unknown-character":"unknown-skill"}; if(progression.unlockedSkills.includes(skillId))return{status:"unlocked",skill,progression}; if(progression.level<skill.requiredLevel)return{status:"locked",reason:"level",skill,progression}; if(skill.prerequisites.some(id=>!progression.unlockedSkills.includes(id)))return{status:"locked",reason:"prerequisite",skill,progression}; if(progression.skillPoints<skill.cost)return{status:"locked",reason:"points",skill,progression}; return{status:"available",skill,progression}; }
 purchase(characterId,skillId){const check=this.getStatus(characterId,skillId);if(check.status==="unlocked")return{changed:false,reason:"already-unlocked",...check};if(check.status!=="available")return{changed:false,reason:check.reason,...check};check.progression.skillPoints-=check.skill.cost;check.progression.spentSkillPoints+=check.skill.cost;check.progression.unlockedSkills.push(skillId);return{changed:true,status:"unlocked",skill:check.skill,progression:check.progression};}
 getUnlocked(id){const p=this.getProgression(id);return p?p.unlockedSkills.map(skillId=>this.definitions[skillId]).filter(Boolean):[];}
 getBattleActionIds(id){return this.getUnlocked(id).filter(skill=>skill.type==="active"&&skill.battleActionId).map(skill=>skill.battleActionId);}
 static tree(){return STARTER_SKILL_IDS.map(id=>SKILL_DEFINITIONS[id]);}
}
