import { PartyManager } from "./PartyManager.js";
import { QuestManager } from "./QuestManager.js";
import { RewardResolver } from "./RewardResolver.js";
import { StoryProgressionManager } from "./StoryProgressionManager.js";
import { StoryThreatManager } from "./StoryThreatManager.js";

export class CampaignDirector {
    constructor(gameState) {
        this.gameState = gameState;
        this.enabled = gameState?.runtimeMode === "campaign";
        this.story = new StoryProgressionManager(gameState);
        this.party = new PartyManager(gameState);
        this.quests = new QuestManager(gameState);
        this.threats = new StoryThreatManager(gameState);
    }

    onMapArrival(mapNodeId) {
        if (!this.enabled) return { changed: false };
        if (mapNodeId === "mountain-start" && !this.story.has("chapter_01_started")) {
            this.story.complete("chapter_01_started");
            return { changed: true, dialogueId: "chapter1Opening" };
        }
        if (mapNodeId === "kalin-village" && !this.story.has("chapter_04_started")) {
            this.story.complete("chapter_04_started");
            return { changed: true, dialogueId: "kalinArrival" };
        }
        return { changed: false };
    }

    canTraverse(warp) {
        if (!this.enabled) return true;
        const prerequisites = [warp?.prerequisiteMilestone, ...(warp?.prerequisiteMilestones || [])].filter(Boolean);
        return prerequisites.every(id => this.story.has(id));
    }

    onTraverse(warp) {
        if (!this.enabled || !warp?.milestoneOnTraverse) return { changed: false };
        const result = this.story.complete(warp.milestoneOnTraverse);
        return { changed: result.completed, result };
    }

    handleInteraction(definition) {
        if (!this.enabled) {
            return { changed: false, dialogueId: definition?.dialogueId || null };
        }
        switch (definition?.eventId) {
            case "fulitas-lighting": {
                const result = this.story.complete("rafel_used_fulitas_lighting");
                return { changed: result.completed, dialogueId: "fulitasLighting" };
            }
            case "anno-meeting": {
                this.story.complete("chapter_01_complete");
                this.party.add("anno");
                const joined = this.story.complete("anno_joined");
                const complete = this.story.complete("chapter_02_complete");
                return { changed: joined.completed || complete.completed, dialogueId: "annoMeeting" };
            }
            case "death-archmage": {
                const awakened = this.story.complete("death_archmage_awakened");
                if (awakened.completed) this.threats.activate("death-archmage", { mapNodeId: "pursuit-area" });
                return { changed: awakened.completed, dialogueId: "deathArchmageAwakens", refreshEncounters: true };
            }
            case "gram-rescue": {
                if (!this.threats.isActive("death-archmage")) return { changed: false, dialogueId: "pathStoryGate" };
                this.party.add("gram");
                const joined = this.story.complete("gram_joined");
                this.threats.deactivate("death-archmage", "camouflaged");
                return { changed: joined.completed, dialogueId: "gramRescue", refreshEncounters: true };
            }
            case "kalin-elder": {
                const quest = this.quests.get("kalin-livestock");
                if (quest?.state === "completed") return { changed: false, dialogueId: "kalinQuestComplete", sliceComplete: true };
                if (quest?.objectives?.defeatGhoul) {
                    this.quests.setObjective("kalin-livestock", "reportToElder", true);
                    const completed = this.quests.completeAndReward("kalin-livestock", new RewardResolver(this.gameState));
                    const storyComplete = this.story.complete("chapter_04_complete");
                    return { changed: completed || storyComplete.completed, dialogueId: "kalinQuestComplete", sliceComplete: true };
                }
                if (quest?.state !== "active") {
                    this.quests.start("kalin-livestock");
                    this.quests.setObjective("kalin-livestock", "learnAboutLivestock", true);
                    this.story.complete("kalin_livestock_investigation_started");
                    return { changed: true, dialogueId: "kalinQuestStart" };
                }
                return { changed: false, dialogueId: "kalinQuestActive" };
            }
            case "kalin-tracks": {
                this.quests.setObjective("kalin-livestock", "inspectTracks", true);
                const discovered = this.story.complete("ghoul_nest_discovered");
                return { changed: discovered.completed, dialogueId: "kalinTracks" };
            }
            case "ghoul-battle":
                return {
                    changed: false,
                    dialogueId: "ghoulNest",
                    battle: {
                        encounterId: "kalin-ghoul",
                        enemyId: "ghoul",
                        enemyCount: 1,
                        preparePhase: { enabled: true },
                        persistCompletion: true
                    }
                };
            default:
                return { changed: false, dialogueId: definition?.dialogueId || null };
        }
    }

    onBattleVictory(encounterId) {
        if (!this.enabled || encounterId !== "kalin-ghoul") return { changed: false };
        this.quests.setObjective("kalin-livestock", "defeatGhoul", true);
        const result = this.story.complete("ghoul_defeated");
        return { changed: result.completed, dialogueId: "ghoulNestCleared" };
    }
}
