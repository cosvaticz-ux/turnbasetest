export const MIN_LEVEL = 1;
export const LEVEL_CAP = 30;
export const SKILL_POINT_MILESTONES = Object.freeze([3, 6, 9, 12, 15, 18, 21, 24, 27, 30]);
export const LEVEL_EXP_CURVE = Object.freeze([40,55,70,90,110,135,160,190,220,255,290,330,370,415,460,510,560,615,670,730,790,855,920,990,1060,1135,1210,1290,1370]);
export const BASE_LEVEL_EXP = LEVEL_EXP_CURVE[0];
export const LEVEL_EXP_GROWTH = 15;
export const RANK_ORDER = Object.freeze(["F", "E", "D"]);
export const RANK_THRESHOLDS = Object.freeze({ F: Object.freeze({ next: "E", required: 10, totalRequired: 10 }), E: Object.freeze({ next: "D", required: 30, totalRequired: 40 }), D: Object.freeze({ next: null, required: 0, totalRequired: 40 }) });
const integer = (value, minimum, maximum = Infinity) => Math.min(maximum, Math.max(minimum, Math.floor(Number.isFinite(Number(value)) ? Number(value) : minimum)));
export function getLevelExpRequirement(level) { const safe = integer(level, 1, LEVEL_CAP); return safe >= LEVEL_CAP ? 0 : LEVEL_EXP_CURVE[safe - 1]; }
export const getEarnedSkillPoints = level => SKILL_POINT_MILESTONES.filter(milestone => milestone <= integer(level, 1, LEVEL_CAP)).length;
export function normalizeCharacterProgression(member = {}) {
    const source = member.progression && typeof member.progression === "object" ? member.progression : member;
    const level = integer(source.level, 1, LEVEL_CAP); const exp = Math.max(0, Math.floor(Number(source.exp) || 0));
    const unlockedSkills = [...new Set(Array.isArray(source.unlockedSkills) ? source.unlockedSkills.filter(id => typeof id === "string") : [])];
    const earned = getEarnedSkillPoints(level); const spentSkillPoints = integer(source.spentSkillPoints ?? unlockedSkills.length, 0, earned);
    const skillPoints = integer(source.skillPoints ?? earned - spentSkillPoints, 0, earned - spentSkillPoints);
    return { level, exp, skillPoints, spentSkillPoints, unlockedSkills };
}
export function applyCharacterExperience(member, amount) {
    const progression = normalizeCharacterProgression(member); const previousLevel = progression.level;
    const expGained = Math.max(0, Math.floor(Number(amount) || 0)); progression.exp += expGained;
    while (progression.level < LEVEL_CAP && progression.exp >= getLevelExpRequirement(progression.level)) {
        progression.exp -= getLevelExpRequirement(progression.level); progression.level += 1;
    }
    const skillPointsGained = getEarnedSkillPoints(progression.level) - getEarnedSkillPoints(previousLevel);
    progression.skillPoints += skillPointsGained; member.progression = progression;
    return { previousLevel, newLevel: progression.level, levelBefore: previousLevel, levelAfter: progression.level, levelsGained: progression.level - previousLevel, expGained, gained: expGained, skillPointsGained, exp: progression.exp, nextLevelExp: getLevelExpRequirement(progression.level) };
}
export function getRankFromPoints(points = 0) { const value = integer(points, 0); return value >= 40 ? "D" : value >= 10 ? "E" : "F"; }
export function normalizeProgression(story = {}) {
    let rankPoints = Math.max(0, Math.floor(Number(story.rankPoints) || 0));
    if (!Number.isFinite(Number(story.rankPoints)) && Number.isFinite(Number(story.rank))) { const legacy = integer(story.rank, 0); rankPoints = legacy >= 2 ? 40 : legacy >= 1 ? 10 : 0; }
    return { level: integer(story.level, 1, LEVEL_CAP), exp: 0, rank: getRankFromPoints(rankPoints), rankPoints };
}
export function applyExperience(target, amount) { return applyCharacterExperience(target, amount); }
export function applyRankPoints(story, amount) { if (!story || typeof story !== "object") return { gained: 0, rankBefore: "F", rankAfter: "F", rankPoints: 0 }; const gained = integer(amount, 0); const rankBefore = getRankFromPoints(story.rankPoints); story.rankPoints = integer(story.rankPoints, 0) + gained; story.rank = getRankFromPoints(story.rankPoints); return { gained, rankBefore, rankAfter: story.rank, rankPoints: story.rankPoints }; }
export function getRankProgress(story = {}) { const points = integer(story.rankPoints, 0); const rank = getRankFromPoints(points); if (rank === "F") return { rank, nextRank: "E", current: Math.min(points, 10), required: 10, totalPoints: points }; if (rank === "E") return { rank, nextRank: "D", current: Math.min(points - 10, 30), required: 30, totalPoints: points }; return { rank, nextRank: null, current: 0, required: 0, totalPoints: points }; }
