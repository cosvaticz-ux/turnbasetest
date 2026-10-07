import { AssetResolver } from "../core/AssetResolver.js";
import "../ui/NpcSpriteSheetStyles.js";

const freezeEntries = entries => Object.freeze(entries.map(entry => Object.freeze({ ...entry })));

export const ENVIRONMENT_PRESETS = Object.freeze({
    clear: Object.freeze({ id: "clear", fog: false, rain: false, dark: false, ash: false }),
    forestFog: Object.freeze({ id: "forest-fog", fog: true, rain: false, dark: false, ash: false }),
    deepDark: Object.freeze({ id: "deep-dark", fog: true, rain: false, dark: true, ash: true }),
    townOvercast: Object.freeze({ id: "town-overcast", fog: false, rain: false, dark: false, ash: true }),
    mountainNight: Object.freeze({ id: "mountain-night", fog: true, rain: false, dark: true, ash: false }),
    deathAsh: Object.freeze({ id: "death-ash", fog: true, rain: false, dark: true, ash: true })
});

export const DIALOGUE_DEFINITIONS = Object.freeze({
    laneSign: freezeEntries([
        { speaker: "Road Sign", text: "East: Deep Forest and Litania. West: the South District shortcut." },
        { speaker: "Luke", text: "At a path opening, W takes us farther into the forest; S brings us toward the foreground. We can stay on this road with A and D." }
    ]),
    laneSupplies: freezeEntries([
        { speaker: "Luke", text: "A sealed healing draught. We should keep it for the road." }
    ]),
    laneTownHall: freezeEntries([
        { speaker: "Town Hall", text: "The hall is closed for council business. A notice directs travelers back to the South District market." }
    ]),
    laneDoor: freezeEntries([
        { speaker: "Resident", text: "The market is on the lower street. Follow the alley down; Iven keeps his shop there." }
    ]),
    chapter1Opening: freezeEntries([
        { speaker: "Rafel", text: "Cold. No fire, no shelter—and the lights behind me are still moving." },
        { speaker: "Rafel", text: "If the pass is buried, Fulitas Lighting can reveal its structure." }
    ]),
    fulitasLighting: freezeEntries([
        { speaker: "Rafel", text: "Fulitas Lighting." },
        { speaker: "Narration", text: "Pale structural lines answer beneath the snow, revealing a stable route through the pass." }
    ]),
    pathStoryGate: freezeEntries([
        { speaker: "Rafel", text: "I cannot leave this route unfinished." }
    ]),
    annoMeeting: freezeEntries([
        { speaker: "Crescent Anno", text: "Stop there. People do not cross this mountain at night without a reason." },
        { speaker: "Rafel", text: "Then walk with me until you decide whether my reason is dangerous." },
        { speaker: "Crescent Anno", text: "Temporarily. I will make my own judgment." }
    ]),
    deathArchmageAwakens: freezeEntries([
        { speaker: "Narration", text: "The dead mage rises without breath. Something old is wearing the corpse and watching the road." },
        { speaker: "Crescent Anno", text: "That is no wandering revenant. Move." }
    ]),
    deathArchmagePressure: freezeEntries([
        { speaker: "Death Arch-mage", text: "The corpse turns toward the warmth of living magic. The hunt closes in." },
        { speaker: "Rafel", text: "We cannot fight this here. Run for the broken timberline." }
    ]),
    gramRescue: freezeEntries([
        { speaker: "Gram de Crescent", text: "Your spellwork shines like a beacon. Mud, ash, resin—mix them. Smother the shape of it." },
        { speaker: "Gram de Crescent", text: "The camouflage will not fool that thing forever, but it will break the pursuit." },
        { speaker: "Crescent Anno", text: "You are coming with us." }
    ]),
    kalinArrival: freezeEntries([
        { speaker: "Narration", text: "Kalin smells of wet timber, smoke, and empty livestock pens." }
    ]),
    kalinQuestStart: freezeEntries([
        { speaker: "Kalin Elder", text: "Three goats and a draft ox vanished. No blood by the pens—only tracks leading into the hunting grounds." },
        { speaker: "Gram de Crescent", text: "We will look. Missing meat in country like this rarely stays a small problem." }
    ]),
    kalinQuestActive: freezeEntries([
        { speaker: "Kalin Elder", text: "Follow the drag marks north of the logging trail. Come back alive." }
    ]),
    kalinTracks: freezeEntries([
        { speaker: "Crescent Anno", text: "The prints are human-shaped, but the weight falls on the claws." },
        { speaker: "Gram de Crescent", text: "Ghoul. We have no holy water, so take this salt. Salt first, then fire while its hide is exposed." }
    ]),
    ghoulNest: freezeEntries([
        { speaker: "Narration", text: "Bones and stolen livestock fill the hollow. A Ghoul unfolds from beneath the carcasses." },
        { speaker: "Gram de Crescent", text: "Prepare with the salt. Fire will bite once the hide is exposed." }
    ]),
    ghoulNestCleared: freezeEntries([
        { speaker: "Rafel", text: "The hollow is quiet. We should report to Kalin." }
    ]),
    kalinQuestComplete: freezeEntries([
        { speaker: "Kalin Elder", text: "A Ghoul. Then the village owes you more than coin." },
        { speaker: "Narration", text: "For tonight, Kalin is safe. Beyond the village, the Death Arch-mage remains somewhere on the road." }
    ]),
    signpost: freezeEntries([
        { speaker: "Road Sign", text: "North: Litania. West: the old deepwood. Travelers are warned to keep to the road." }
    ]),
    deepShrine: freezeEntries([
        { speaker: "Weathered Shrine", text: "The saint's face has been scratched away. A dry candle still carries the scent of myrrh." },
        { speaker: "Luke", text: "Someone has been here recently." }
    ]),
    guildAvailable: freezeEntries([
        { speaker: "Guild Warden Mara", text: "A highwayman has been cutting travelers off on the forest road. Deal with him and report back." }
    ]),
    guildActive: freezeEntries([
        { speaker: "Guild Warden Mara", text: "The road remains unsafe. Find the highwayman in Front Forest, then return to me." }
    ]),
    guildComplete: freezeEntries([
        { speaker: "Guild Warden Mara", text: "So the road is clear. Good. The guild remembers useful people." },
        { speaker: "Guild Warden Mara", text: "Take 25 crowns and a healing draught. Your guild rank is now Initiate." }
    ]),
    guildDone: freezeEntries([
        { speaker: "Guild Warden Mara", text: "Initiate. The north district is open to you. This town has more work than hands." }
    ]),
    wolfContractAvailable: freezeEntries([
        { speaker: "Guild Warden Mara", text: "Three grey wolves are holding the Old Forest Road. Clear the pack and bring me proof the road is safe." }
    ]),
    wolfContractActive: freezeEntries([
        { speaker: "Guild Warden Mara", text: "The pack is still on the Old Forest Road. Follow the eastern trail out of Front Forest." }
    ]),
    wolfContractComplete: freezeEntries([
        { speaker: "Guild Warden Mara", text: "Three wolves and three pelts. That will put the carters at ease." },
        { speaker: "Guild Warden Mara", text: "Take 14 crowns and a bandage. The guild has recorded your service." }
    ]),
    wolfContractDone: freezeEntries([
        { speaker: "Guild Warden Mara", text: "The southern road is holding. There is more work on the board when you are ready." }
    ]),
    farmsteadSupplies: freezeEntries([
        { speaker: "Narration", text: "Broken supply crates and a rain-warped ledger lie beneath the farmhouse awning." }
    ]),
    graveyardMarker: freezeEntries([
        { speaker: "Weathered Headstone", text: "Fresh soil has been pressed flat beside the oldest row of graves." }
    ]),
    woodcutterGreeting: freezeEntries([
        { speaker: "Woodcutter", text: "The fire is safe. Bitterleaf grows near the timber stacks, but keep clear of the outer trail." }
    ]),
    campHerbs: freezeEntries([
        { speaker: "Bitterleaf Patch", text: "Medicinal bitterleaf grows between the cut stumps." }
    ]),
    crossroadsShrine: freezeEntries([
        { speaker: "Ruined Shrine", text: "Black residue veins the broken offering bowl. Someone has tried to scrape it away." }
    ]),
    villager: freezeEntries([
        { speaker: "Townswoman", text: "The north square is quieter, but the old guild hall watches every road in Litania." }
    ]),
    mara: freezeEntries([
        { speaker: "Mara", text: "The north square is quieter, but the guild still keeps an eye on every road into Litania." }
    ]),
    townHighwayman: freezeEntries([
        { speaker: "Highwayman", text: "Got business with me? If not, keep walking." }
    ]),
    northWarden: freezeEntries([
        { speaker: "North Warden", text: "Beyond this gate lies the rest of Litania. For now, your road ends at the guild monument." }
    ])
});

export const MAP_CONTENT = Object.freeze({
    "mountain-start": Object.freeze({
        environment: "mountainNight", npcs: freezeEntries([]),
        interactives: freezeEntries([{ id: "fulitas-focus", name: "Buried Mountain Path", type: "story-event", eventId: "fulitas-lighting", dialogueId: "fulitasLighting", x: 12, y: 9.5, radius: 110, hideAfterMilestone: "rafel_used_fulitas_lighting" }]),
        encounterZones: freezeEntries([])
    }),
    "mountain-path": Object.freeze({ environment: "mountainNight", npcs: freezeEntries([]), interactives: freezeEntries([]), encounterZones: freezeEntries([]) }),
    "anno-encounter": Object.freeze({
        environment: "mountainNight",
        npcs: freezeEntries([{ id: "anno", name: "Crescent Anno", type: "story-event", eventId: "anno-meeting", dialogueId: "annoMeeting", todoAssetId: "TODO_ASSET_ANNO_OVERWORLD", x: 12, y: 9, radius: 105, hideAfterMilestone: "anno_joined", marker: "!" }]),
        interactives: freezeEntries([]), encounterZones: freezeEntries([])
    }),
    "pursuit-area": Object.freeze({
        environment: "deathAsh",
        npcs: freezeEntries([{ id: "gram", name: "Gram de Crescent", type: "story-event", eventId: "gram-rescue", dialogueId: "gramRescue", todoAssetId: "TODO_ASSET_GRAM_OVERWORLD", x: 12, y: 6.5, radius: 105, requiresMilestone: "death_archmage_awakened", hideAfterMilestone: "gram_joined", marker: "!" }]),
        interactives: freezeEntries([{ id: "dead-mage", name: "Mage's Remains", type: "story-event", eventId: "death-archmage", dialogueId: "deathArchmageAwakens", todoAssetId: "TODO_ASSET_DEATH_ARCHMAGE", x: 12, y: 13, radius: 100, hideAfterMilestone: "death_archmage_awakened" }]),
        encounterZones: freezeEntries([{ id: "death-archmage-hunt-zone", x: 8, y: 5, width: 8, height: 12, chancePerSecond: 0, enemyId: "death-archmage" }])
    }),
    "road-foothill": Object.freeze({ environment: "forestFog", npcs: freezeEntries([]), interactives: freezeEntries([]), encounterZones: freezeEntries([]) }),
    "kalin-village": Object.freeze({
        environment: "townOvercast",
        npcs: freezeEntries([{ id: "kalin-elder", name: "Kalin Elder", type: "story-event", eventId: "kalin-elder", dialogueId: "kalinQuestStart", x: 12, y: 9, radius: 108, marker: "!" }]),
        interactives: freezeEntries([]), encounterZones: freezeEntries([])
    }),
    "kalin-investigation": Object.freeze({
        environment: "forestFog", npcs: freezeEntries([]),
        interactives: freezeEntries([{ id: "ghoul-tracks", name: "Clawed Tracks", type: "story-event", eventId: "kalin-tracks", dialogueId: "kalinTracks", x: 12, y: 9, radius: 110, hideAfterMilestone: "ghoul_nest_discovered" }]),
        encounterZones: freezeEntries([])
    }),
    "ghoul-nest": Object.freeze({
        environment: "deepDark", npcs: freezeEntries([]),
        interactives: freezeEntries([{ id: "ghoul-lair", name: "Ghoul Nest", type: "story-encounter", eventId: "ghoul-battle", dialogueId: "ghoulNest", x: 12, y: 9, radius: 120, requiresMilestone: "ghoul_nest_discovered", hideAfterMilestone: "ghoul_defeated" }]),
        encounterZones: freezeEntries([])
    }),
    "front-forest": Object.freeze({
        environment: "forestFog",
        npcs: freezeEntries([]),
        interactives: freezeEntries([
            { id: "front-signpost", name: "Road Sign", type: "dialogue", dialogueId: "signpost", x: 9.5, y: 8.5, radius: 76 }
        ]),
        encounterZones: freezeEntries([
            {
                id: "front-danger-zone",
                x: 14,
                y: 13.5,
                width: 4,
                height: 3.5,
                chancePerSecond: 0.018,
                enemyId: "highwayman",
                minEnemies: 1,
                maxEnemies: 4,
                persistCompletion: false
            }
        ])
    }),
    "deep-forest": Object.freeze({
        environment: "deepDark",
        npcs: freezeEntries([]),
        interactives: freezeEntries([
            { id: "deep-weathered-shrine", name: "Weathered Shrine", type: "event", dialogueId: "deepShrine", flag: "inspectedDeepShrine", x: 16, y: 18.5, radius: 82 }
        ]),
        encounterZones: freezeEntries([
            {
                id: "deep-west-danger",
                x: 6,
                y: 9,
                width: 3,
                height: 2,
                chancePerSecond: 0.035,
                enemyId: "highwayman",
                minEnemies: 1,
                maxEnemies: 4,
                persistCompletion: false
            },
            {
                id: "deep-east-danger",
                x: 15,
                y: 13,
                width: 3,
                height: 2,
                chancePerSecond: 0.035,
                enemyId: "highwayman",
                minEnemies: 1,
                maxEnemies: 4,
                persistCompletion: false
            }
        ])
    }),
    "old-forest-road": Object.freeze({
        environment: "forestFog", npcs: freezeEntries([]),
        interactives: freezeEntries([]), encounterZones: freezeEntries([])
    }),
    "abandoned-farmstead": Object.freeze({
        environment: "forestFog", npcs: freezeEntries([]),
        interactives: freezeEntries([
            { id: "farmhouse-supplies", name: "Scattered Supplies", type: "event", dialogueId: "farmsteadSupplies", flag: "inspectedFarmhouseSupplies", x: 8.5, y: 8.5, radius: 82 }
        ]), encounterZones: freezeEntries([])
    }),
    "old-graveyard": Object.freeze({
        environment: "deepDark", npcs: freezeEntries([]),
        interactives: freezeEntries([
            { id: "graveyard-disturbed-earth", name: "Disturbed Grave", type: "event", dialogueId: "graveyardMarker", flag: "inspectedDisturbedGrave", x: 7.5, y: 15.5, radius: 82 }
        ]), encounterZones: freezeEntries([])
    }),
    "woodcutter-camp": Object.freeze({
        environment: "forestFog",
        npcs: freezeEntries([
            { id: "camp-woodcutter", name: "Camp Woodcutter", type: "dialogue", dialogueId: "woodcutterGreeting", x: 12.5, y: 9.5, radius: 86, marker: "!" }
        ]),
        interactives: freezeEntries([
            { id: "camp-bitterleaf", name: "Bitterleaf Patch", type: "event", dialogueId: "campHerbs", flag: "inspectedCampBitterleaf", x: 7.5, y: 13.5, radius: 78 }
        ]), encounterZones: freezeEntries([])
    }),
    "northern-crossroads": Object.freeze({
        environment: "townOvercast", npcs: freezeEntries([]),
        interactives: freezeEntries([
            { id: "crossroads-ruined-shrine", name: "Ruined Roadside Shrine", type: "event", dialogueId: "crossroadsShrine", flag: "inspectedCrossroadsShrine", x: 15.5, y: 7.5, radius: 84 }
        ]), encounterZones: freezeEntries([])
    }),
    "town-south": Object.freeze({
        environment: "townOvercast",
        npcs: freezeEntries([
            { id: "guild-warden", name: "Guild Warden Mara", type: "guild", sprite: AssetResolver.npcSprite("town-mara"), dialoguePortrait: AssetResolver.npcSprite("town-mara"), x: 7.5, y: 9.5, radius: 92, marker: "!" },
            { id: "potion-merchant", name: "Apothecary Iven", type: "shop", sprite: AssetResolver.npcSprite("town-iven"), dialoguePortrait: AssetResolver.npcSprite("town-iven"), x: 16.5, y: 7.5, radius: 92, marker: "$" },
            { id: "south-villager", name: "Townswoman", type: "dialogue", dialogueId: "villager", sprite: AssetResolver.npcSprite("town-woman"), dialoguePortrait: AssetResolver.npcSprite("town-woman"), x: 9.5, y: 11.5, radius: 78 }
        ]),
        interactives: freezeEntries([]),
        encounterZones: freezeEntries([])
    }),
    "town-north": Object.freeze({
        environment: "townOvercast",
        npcs: freezeEntries([
            { id: "north-warden", name: "North Warden", type: "dialogue", dialogueId: "northWarden", x: 15.5, y: 12.5, radius: 82 }
        ]),
        interactives: freezeEntries([
            { id: "guild-monument", name: "Guild Monument", type: "slice-end", x: 12, y: 11.5, radius: 96 }
        ]),
        encounterZones: freezeEntries([])
    })
});

export function getMapContent(mapId) {
    return MAP_CONTENT[mapId] || Object.freeze({
        environment: "clear",
        npcs: Object.freeze([]),
        interactives: Object.freeze([]),
        encounterZones: Object.freeze([])
    });
}
