import { normalizeLanePosition } from '../data/explorationMaps.js';
import { normalizeProgression } from "./Progression.js";
import { createPartyMemberState, PARTY_MEMBER_DEFINITIONS } from "./PartyManager.js";
import { QUEST_DEFINITIONS } from "../data/quests.js";

export const SAVE_SCHEMA_VERSION = 8;
export const DEFAULT_RUNTIME_MODE = "demo";

export const DEFAULT_SETTINGS = Object.freeze({
    masterVolume: 0.8,
    musicVolume: 0.7, // Retained for compatibility with older saves; playback was removed.
    sfxVolume: 0.8,
    filmGrain: true,
    screenEffects: "high"
});

const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));

export function normalizeSettings(settings = {}) {
    return {
        masterVolume: clamp01(settings.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
        musicVolume: clamp01(settings.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
        sfxVolume: clamp01(settings.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
        filmGrain: settings.filmGrain !== false,
        screenEffects: settings.screenEffects === "low" ? "low" : "high"
    };
}

export function createInitialGameState() {
    return {
        schemaVersion: SAVE_SCHEMA_VERSION,
        runtimeMode: DEFAULT_RUNTIME_MODE,
        party: [createPartyMemberState("luke"), createPartyMemberState("dummy")],
        inventory: [{ id: "healing-draught", quantity: 1 }, { id: "ash-spear", quantity: 1 }],
        story: {
            flags: {},
            currency: 12,
            chapter: 1,
            level: 1,
            milestones: [],
            rank: "F",
            rankPoints: 0
        },
        reputation: { adventurerGuild: 0, kalin: 0 },
        rank: { current: "F", promotionEligible: false },
        knowledge: [],
        worldAccess: [],
        storyThreats: {
            "death-archmage": { id: "death-archmage", state: "inactive", encounters: 0 }
        },
        masteryLedger: {},
        mapPosition: { mapId: 'front-forest', x: 180, y: 550 },
        quests: {
            ...Object.fromEntries(Object.values(QUEST_DEFINITIONS).map(definition => [definition.id, {
                id: definition.id,
                name: definition.name,
                state: definition.initialState,
                objectives: { ...definition.objectives },
                objectiveProgress: {},
                processedEventIds: [],
                rewards: definition.rewards,
                rewarded: false
            }]))
        },
        completedEncounters: [],
        resolvedBattleRewards: [],
        settings: normalizeSettings()
    };
}

export function normalizeGameState(candidate = {}) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const defaults = createInitialGameState();
    const runtimeMode = candidate.runtimeMode === "campaign" ? "campaign" : DEFAULT_RUNTIME_MODE;
    const rawMapPosition = candidate.mapPosition && typeof candidate.mapPosition === "object"
        ? candidate.mapPosition
        : defaults.mapPosition;
    const mapPosition = normalizeLanePosition(rawMapPosition);
    return {
        ...defaults,
        ...candidate,
        schemaVersion: SAVE_SCHEMA_VERSION,
        runtimeMode,
        party: normalizeParty(candidate.party, defaults.party),
        inventory: Array.isArray(candidate.inventory) ? candidate.inventory.map(item => ({ ...item })) : defaults.inventory,
        story: {
            ...defaults.story,
            ...(candidate.story || {}),
            ...normalizeProgression(candidate.story || {}),
            flags: { ...defaults.story.flags, ...(candidate.story?.flags || {}) },
            milestones: [...new Set(Array.isArray(candidate.story?.milestones)
                ? candidate.story.milestones.filter(id => typeof id === "string")
                : [])],
            chapter: Math.min(4, Math.max(1, Math.floor(Number(candidate.story?.chapter) || 1)))
        },
        mapPosition,
        quests: normalizeQuests(defaults.quests, candidate.quests),
        reputation: { ...defaults.reputation, ...(candidate.reputation || {}) },
        rank: { ...defaults.rank, ...(candidate.rank || {}) },
        knowledge: [...new Set(Array.isArray(candidate.knowledge) ? candidate.knowledge.filter(Boolean) : [])],
        worldAccess: [...new Set(Array.isArray(candidate.worldAccess) ? candidate.worldAccess.filter(Boolean) : [])],
        storyThreats: { ...defaults.storyThreats, ...(candidate.storyThreats || {}) },
        masteryLedger: { ...defaults.masteryLedger, ...(candidate.masteryLedger || {}) },
        completedEncounters: [...new Set(Array.isArray(candidate.completedEncounters)
            ? candidate.completedEncounters.filter(id => typeof id === "string")
            : [])],
        resolvedBattleRewards: [...new Set(Array.isArray(candidate.resolvedBattleRewards)
            ? candidate.resolvedBattleRewards.filter(id => typeof id === "string")
            : [])],
        settings: normalizeSettings(candidate.settings)
    };
}

function normalizeParty(candidateParty, defaultParty) {
    const source = Array.isArray(candidateParty) ? candidateParty : [];
    const known = source
        .map(member => PARTY_MEMBER_DEFINITIONS[member?.id]
            ? createPartyMemberState(member.id, member)
            : null)
        .filter(Boolean)
        .filter((member, index, entries) => entries.findIndex(entry => entry.id === member.id) === index);
    if (known.length) {
        let activeCount = 0;
        for (const member of known) {
            if (member.active !== false && activeCount < 3) activeCount += 1;
            else member.active = false;
        }
        if (activeCount === 0) known[0].active = true;
        return known;
    }
    return defaultParty.map(member => createPartyMemberState(member.id, member));
}

function normalizeQuests(defaultQuests, candidateQuests) {
    const saved = candidateQuests && typeof candidateQuests === "object" ? candidateQuests : {};
    return Object.fromEntries(Object.entries(defaultQuests).map(([questId, defaultQuest]) => {
        const savedQuest = saved[questId] || {};
        return [questId, {
            ...defaultQuest,
            ...savedQuest,
            objectives: { ...defaultQuest.objectives, ...(savedQuest.objectives || {}) },
            objectiveProgress: { ...defaultQuest.objectiveProgress, ...(savedQuest.objectiveProgress || {}) },
            processedEventIds: [...new Set(Array.isArray(savedQuest.processedEventIds)
                ? savedQuest.processedEventIds.filter(id => typeof id === "string")
                : [])],
            rewards: defaultQuest.rewards
        }];
    }));
}
