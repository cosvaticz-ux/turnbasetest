import { CHAPTER_DEBUG_TARGETS, STORY_MILESTONES } from "../data/storyContent.js";
import { CampaignDirector } from "./CampaignDirector.js";

const MILESTONES_BY_CHAPTER = Object.freeze({
    1: [],
    2: ["chapter_01_started", "rafel_used_fulitas_lighting", "chapter_01_complete"],
    3: ["chapter_01_started", "rafel_used_fulitas_lighting", "chapter_01_complete", "anno_joined", "chapter_02_complete"],
    4: ["chapter_01_started", "rafel_used_fulitas_lighting", "chapter_01_complete", "anno_joined", "chapter_02_complete", "death_archmage_awakened", "gram_joined", "chapter_03_complete"]
});

export function jumpToChapter(gameState, chapter) {
    if (gameState?.runtimeMode !== "campaign") return null;
    const targetChapter = Math.min(4, Math.max(1, Math.floor(Number(chapter) || 1)));
    const allowedMilestones = new Set(MILESTONES_BY_CHAPTER[targetChapter]);
    gameState.story.milestones = (gameState.story.milestones || []).filter(id => allowedMilestones.has(id));
    for (const milestoneId of Object.keys(STORY_MILESTONES)) delete gameState.story.flags[milestoneId];
    for (const milestoneId of gameState.story.milestones) gameState.story.flags[milestoneId] = true;
    gameState.story.flags.verticalSliceComplete = false;
    gameState.story.level = targetChapter >= 4 ? 2 : 1;
    if (gameState.storyThreats?.["death-archmage"]) {
        gameState.storyThreats["death-archmage"] = { id: "death-archmage", state: "inactive", encounters: 0 };
    }
    const quest = gameState.quests?.["kalin-livestock"];
    if (quest) {
        quest.state = "locked";
        quest.rewarded = false;
        for (const objectiveId of Object.keys(quest.objectives || {})) quest.objectives[objectiveId] = false;
    }
    const director = new CampaignDirector(gameState);
    director.party.add("rafel");
    director.party.remove("anno");
    director.party.remove("gram");
    for (const milestoneId of MILESTONES_BY_CHAPTER[targetChapter]) {
        if (!STORY_MILESTONES[milestoneId]) continue;
        if (milestoneId === "anno_joined") director.party.add("anno");
        if (milestoneId === "gram_joined") director.party.add("gram");
        director.story.complete(milestoneId);
    }
    gameState.story.chapter = targetChapter;
    gameState.mapPosition = { ...CHAPTER_DEBUG_TARGETS[targetChapter], x: null, y: null, facing: "north" };
    return gameState.mapPosition;
}

export function inspectCampaignState(gameState) {
    const director = new CampaignDirector(gameState);
    return {
        enabled: director.enabled,
        chapter: gameState.story?.chapter || 1,
        level: gameState.story?.level || 1,
        milestones: [...(gameState.story?.milestones || [])],
        party: director.party.getActiveMembers().map(member => ({ id: member.id, hp: member.hp, mastery: { ...member.mastery }, knownTechniques: [...member.knownTechniques] })),
        quests: structuredClone(gameState.quests || {}),
        threats: structuredClone(gameState.storyThreats || {})
    };
}
