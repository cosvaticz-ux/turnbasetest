export { QUEST_DEFINITIONS } from "./quests.js";

export const STORY_MILESTONES = Object.freeze({
    chapter_01_started: Object.freeze({ chapter: 1, prerequisites: [], rewards: {} }),
    rafel_used_fulitas_lighting: Object.freeze({
        chapter: 1,
        prerequisites: ["chapter_01_started"],
        rewards: { techniques: [{ characterId: "rafel", techniqueId: "fulitas-lighting" }] }
    }),
    chapter_01_complete: Object.freeze({
        chapter: 1,
        prerequisites: ["rafel_used_fulitas_lighting"],
        rewards: {}
    }),
    anno_joined: Object.freeze({
        chapter: 2,
        prerequisites: ["chapter_01_complete"],
        rewards: {}
    }),
    chapter_02_complete: Object.freeze({
        chapter: 2,
        prerequisites: ["anno_joined"],
        rewards: {}
    }),
    death_archmage_awakened: Object.freeze({
        chapter: 3,
        prerequisites: ["chapter_02_complete"],
        rewards: { knowledge: ["death-archmage"] }
    }),
    gram_joined: Object.freeze({
        chapter: 3,
        prerequisites: ["death_archmage_awakened"],
        rewards: {}
    }),
    chapter_03_complete: Object.freeze({
        chapter: 3,
        prerequisites: ["gram_joined"],
        rewards: { level: 2 }
    }),
    chapter_04_started: Object.freeze({
        chapter: 4,
        prerequisites: ["chapter_03_complete"],
        rewards: {}
    }),
    kalin_livestock_investigation_started: Object.freeze({
        chapter: 4,
        prerequisites: ["chapter_04_started"],
        rewards: {}
    }),
    ghoul_nest_discovered: Object.freeze({
        chapter: 4,
        prerequisites: ["kalin_livestock_investigation_started"],
        rewards: { items: [{ id: "coarse-salt", quantity: 1 }], knowledge: ["ghoul-salt-fire"] }
    }),
    ghoul_defeated: Object.freeze({
        chapter: 4,
        prerequisites: ["ghoul_nest_discovered"],
        rewards: {}
    }),
    chapter_04_complete: Object.freeze({
        chapter: 4,
        prerequisites: ["ghoul_defeated"],
        rewards: { storyFlags: ["verticalSliceComplete"] }
    })
});

export const CHAPTER_DEBUG_TARGETS = Object.freeze({
    1: Object.freeze({ mapNodeId: "mountain-start", spawnId: "player-start" }),
    2: Object.freeze({ mapNodeId: "anno-encounter", spawnId: "spawn-from-mountain-path" }),
    3: Object.freeze({ mapNodeId: "pursuit-area", spawnId: "spawn-from-anno-encounter" }),
    4: Object.freeze({ mapNodeId: "kalin-village", spawnId: "spawn-from-road-foothill" })
});
