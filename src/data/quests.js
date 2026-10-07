import { createContentRegistry, requireContent } from "./contentRegistry.js";
const QUEST_DEFINITIONS_ENTRIES = [
    Object.freeze({
        id: "kalin-livestock",
        name: "What Hunts the Herd",
        initialState: "locked",
        objectives: Object.freeze({
            learnAboutLivestock: false,
            inspectTracks: false,
            defeatGhoul: false,
            reportToElder: false
        }),
        rewards: Object.freeze({
            currency: 30,
            items: Object.freeze([{ id: "healing-draught", quantity: 1 }]),
            reputation: Object.freeze({ kalin: 3 })
        })
    }),
    Object.freeze({
        id: "safer-road",
        name: "A Safer Road",
        giverId: "guild-warden",
        category: "Guild Contract",
        description: "A highwayman has been cutting travelers off on the forest road. Clear the threat and report back to Guild Warden Mara.",
        initialState: "available",
        objectives: Object.freeze({ defeatHighwayman: false }),
        objectiveLabels: Object.freeze({
            defeatHighwayman: "Defeat the Highwayman in Front Forest"
        }),
        metadata: Object.freeze({
            objectiveTargets: Object.freeze([
                Object.freeze({ objectiveId: "defeatHighwayman", type: "monster-defeated", monsterId: "highwayman", encounterId: "highwayman-patrol", mapId: "front-forest" })
            ])
        }),
        rewards: Object.freeze({
            currency: 25,
            items: Object.freeze([{ id: "healing-draught", quantity: 1 }]),
            reputation: Object.freeze({ adventurerGuild: 3 })
        })
    })
];


// Boolean objectives are the current QuestManager contract. Targets below are
// authoring metadata, not an unimplemented kill/collection event interpreter.
const contract = (id, name, giverId, description, targets, currency, itemId, reputation, options = {}) => {
    const { rewardOverrides = {}, ...questOptions } = options;
    return {
        id, name, giverId, description, type: "local-contract", category: "Local Contract",
        initialState: "locked", contentStatus: "catalog",
        objectives: Object.fromEntries(targets.map(target => [target.objectiveId, false])),
        objectiveLabels: Object.fromEntries(targets.map(target => [target.objectiveId, target.label])),
        rewards: { currency, items: [{ id: itemId, quantity: 1 }], reputation: { adventurerGuild: reputation }, ...rewardOverrides },
        prerequisites: [], repeatable: false, ...questOptions,
        metadata: {
            objectiveTargets: targets,
            ...(questOptions.contentStatus === "playable" ? {} : { pipelineGap: "Needs authored activation and field placement." })
        }
    };
};

export const QUEST_DEFINITIONS = createContentRegistry([
    ...QUEST_DEFINITIONS_ENTRIES,
    contract("wolves-southern-road", "Wolves on the Southern Road", "guild-warden",
        "Carters will pay to have the wolves driven away from the southern road. Bring Mara proof of the hunt.", [
            { objectiveId: "defeatWolves", label: "Defeat 3 Grey Wolves on the Old Forest Road", type: "monster-defeated", monsterId: "grey-wolf", encounterId: "road-wolves", mapId: "old-forest-road", requiredCount: 3 },
            { objectiveId: "report", label: "Report to Guild Warden Mara", type: "return-to-npc", npcId: "guild-warden", requiredObjectives: ["defeatWolves"] }
        ], 14, "bandage", 2, {
            initialState: "available", contentStatus: "playable", boardPriority: 10,
            rewardOverrides: { rankPoints: 2 },
            dialogueIds: { available: "wolfContractAvailable", active: "wolfContractActive", complete: "wolfContractComplete", done: "wolfContractDone" },
            nextQuestId: "boar-thicket"
        }),
    contract("boar-thicket", "The Boar in the Thicket", "guild-warden",
        "An old boar has injured two woodcutters. Clear their cutting ground and bring back its hide.", [
            { objectiveId: "defeatBoar", label: "Defeat the thicket boar", type: "monster-defeated", monsterId: "wild-boar", encounterId: "thicket-boar", mapId: "abandoned-farmstead" },
            { objectiveId: "bringHide", label: "Bring a boar hide to Mara", type: "return-to-npc", itemId: "boar-hide", npcId: "guild-warden", requiredObjectives: ["defeatBoar"] }
        ], 18, "healing-draught", 3, { prerequisites: ["wolves-southern-road"] }),
    contract("missing-supplies", "Missing Supplies", "guild-warden",
        "A carter lost his provisions and accounts on the forest road. Recover the ledger before the debts fall on his family.", [
            { objectiveId: "investigate", label: "Search the abandoned farmhouse", type: "interaction-completed", interactionId: "farmhouse-supplies", mapId: "abandoned-farmstead" },
            { objectiveId: "clearCamp", label: "Deal with the farmstead highwaymen", type: "monster-defeated", monsterId: "highwayman", encounterId: "supply-raiders", mapId: "abandoned-farmstead" },
            { objectiveId: "ledger", label: "Return the stolen ledger", type: "return-to-npc", itemId: "stolen-ledger", npcId: "guild-warden" }
        ], 20, "guild-contract-token", 3),
    contract("graveyard-unease", "Graveyard Unease", "north-warden",
        "The watch hears tools scraping behind the burial wall after dusk. Find the cause and bring proof to the north warden.", [
            { objectiveId: "quietDead", label: "Put the restless laborers down", type: "monster-defeated", monsterId: "male-zombie", encounterId: "graveyard-laborers", mapId: "old-graveyard" },
            { objectiveId: "dust", label: "Bring grave dust to the north warden", type: "return-to-npc", itemId: "grave-dust", npcId: "north-warden" }
        ], 22, "antidote", 3),
    contract("herbal-remedy", "Herbal Remedy", "potion-merchant",
        "Iven's supply of bitterleaf ran out treating travelers. Gather fresh leaves near the road and bring them to his stall.", [
            { objectiveId: "herbs", label: "Gather medicinal herb", type: "item-acquired", itemId: "medicinal-herb", mapId: "woodcutter-camp" },
            { objectiveId: "deliver", label: "Deliver the herb to Apothecary Iven", type: "return-to-npc", npcId: "potion-merchant", requiredObjectives: ["herbs"] }
        ], 6, "bitter-tonic", 1),
    contract("corruption-woods", "Corruption in the Woods", "north-warden",
        "A delver returned to the woods with blackened wounds. Find his camp and bring back something the warden can examine.", [
            { objectiveId: "investigate", label: "Inspect the ruined crossroads shrine", type: "interaction-completed", interactionId: "crossroads-ruined-shrine", mapId: "northern-crossroads" },
            { objectiveId: "delver", label: "Confront the corrupted delver", type: "monster-defeated", monsterId: "corrupted-adventurer", encounterId: "lost-delver", mapId: "northern-crossroads" },
            { objectiveId: "shard", label: "Bring a corrupted shard to the north warden", type: "return-to-npc", itemId: "corrupted-shard", npcId: "north-warden" }
        ], 28, "greater-healing-draught", 4, { prerequisites: ["safer-road"] })
], "quest");

export const getQuestDefinition = id => requireContent(QUEST_DEFINITIONS, id, "quest");
export const listQuestsByType = type => Object.values(QUEST_DEFINITIONS).filter(quest => (quest.type || quest.category) === type);
