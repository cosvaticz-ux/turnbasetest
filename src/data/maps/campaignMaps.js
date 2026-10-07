import { defineMapNode } from "./mapNodeSchema.js";

function createLinearNode({ id, name, role, from = null, to = null, toPrerequisite = null, toMilestone = null }) {
    const fromId = from ? `warp-to-${from}` : null;
    const toId = to ? `warp-to-${to}` : null;
    return defineMapNode({
        id,
        name,
        shortName: name,
        role,
        defaultSpawnId: from ? `spawn-from-${from}` : "player-start",
        groups: {
            zones: [
                { id: `${id}-ground`, label: "WALKABLE ROUTE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: `${id}-west-boundary`, label: "TERRAIN / BLOCKED", x: 0, y: 0, width: 7, height: 20, type: "blocked" },
                { id: `${id}-east-boundary`, label: "TERRAIN / BLOCKED", x: 17, y: 0, width: 7, height: 20, type: "blocked" }
            ],
            paths: [
                { id: `${id}-route`, label: "STORY PATH", x: 9, y: 0, width: 6, height: 20, type: "path" }
            ],
            footprints: [],
            markers: [
                { id: `${id}-story-space`, label: "STORY EVENT AREA", x: 9, y: 7, width: 6, height: 6, type: "important" }
            ],
            spawns: [
                from
                    ? { id: `spawn-from-${from}`, spawnId: `spawn-from-${from}`, label: "ARRIVAL", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: fromId }
                    : { id: "player-start", spawnId: "player-start", label: "PLAYER START", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north" },
                ...(to ? [{ id: `spawn-from-${to}`, spawnId: `spawn-from-${to}`, label: "RETURN ARRIVAL", x: 11, y: 2, width: 2, height: 1, type: "spawn", facing: "south", arrivalWarpId: toId }] : [])
            ],
            warps: [
                ...(from ? [{
                    id: fromId,
                    label: `RETURN: ${from}`,
                    x: 10, y: 19, width: 4, height: 1, type: "warp",
                    destinationMapId: from,
                    destinationSpawnId: `spawn-from-${id}`
                }] : []),
                ...(to ? [{
                    id: toId,
                    label: `STORY: ${to}`,
                    x: 10, y: 0, width: 4, height: 1, type: "warp",
                    destinationMapId: to,
                    destinationSpawnId: `spawn-from-${id}`,
                    prerequisiteMilestone: toPrerequisite,
                    milestoneOnTraverse: toMilestone,
                    deniedDialogueId: "pathStoryGate"
                }] : [])
            ]
        }
    });
}

export const CAMPAIGN_MAP_NODES = Object.freeze({
    "mountain-start": createLinearNode({
        id: "mountain-start", name: "Moonlit Mountain", role: "Chapter 1 opening and Fulitas Lighting tutorial.",
        to: "mountain-path", toPrerequisite: "rafel_used_fulitas_lighting"
    }),
    "mountain-path": createLinearNode({
        id: "mountain-path", name: "Frozen Pass", role: "Chapter 1 escape route.",
        from: "mountain-start", to: "anno-encounter", toMilestone: "chapter_01_complete"
    }),
    "anno-encounter": createLinearNode({
        id: "anno-encounter", name: "Sheltered Crossing", role: "Chapter 2 meeting with Crescent Anno.",
        from: "mountain-path", to: "pursuit-area", toPrerequisite: "chapter_02_complete"
    }),
    "pursuit-area": createLinearNode({
        id: "pursuit-area", name: "Ashen Timberline", role: "Chapter 3 Death Arch-mage pursuit and Gram rescue.",
        from: "anno-encounter", to: "road-foothill", toPrerequisite: "gram_joined", toMilestone: "chapter_03_complete"
    }),
    "road-foothill": createLinearNode({
        id: "road-foothill", name: "Foothill Road", role: "Road into Village Kalin.",
        from: "pursuit-area", to: "kalin-village"
    }),
    "kalin-village": createLinearNode({
        id: "kalin-village", name: "Village Kalin", role: "Chapter 4 lumber and hunting settlement.",
        from: "road-foothill", to: "kalin-investigation", toPrerequisite: "kalin_livestock_investigation_started"
    }),
    "kalin-investigation": createLinearNode({
        id: "kalin-investigation", name: "Kalin Hunting Grounds", role: "Livestock investigation trail.",
        from: "kalin-village", to: "ghoul-nest", toPrerequisite: "ghoul_nest_discovered"
    }),
    "ghoul-nest": createLinearNode({
        id: "ghoul-nest", name: "Carrion Hollow", role: "Chapter 4 Ghoul encounter.",
        from: "kalin-investigation"
    })
});
