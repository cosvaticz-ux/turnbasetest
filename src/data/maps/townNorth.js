import { defineMapNode } from "./mapNodeSchema.js";

export const TOWN_NORTH_NODE = defineMapNode({
    id: "town-north",
    name: "Town Part 2 — North District",
    shortName: "Town Part 2",
    role: "Upper town continuation with residential streets, public services, town square, and the reserved northern exit.",
    defaultSpawnId: "spawn-from-town-south",
    groups: {
        zones: [
            { id: "north-ground", label: "GROUND_TOWN / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
            { id: "north-boundary-west", label: "TOWN WALL / BLOCKED", x: 0, y: 0, width: 2, height: 20, type: "blocked" },
            { id: "north-boundary-east", label: "TOWN WALL / BLOCKED", x: 22, y: 0, width: 2, height: 20, type: "blocked" },
            { id: "north-square", label: "TOWN SQUARE / WALKABLE", x: 7, y: 8, width: 10, height: 6, type: "walkable" }
        ],
        paths: [
            { id: "north-main-road", label: "MAIN TOWN ROAD", x: 10, y: 0, width: 4, height: 20, type: "road" },
            { id: "north-square-west", label: "SIDE STREET", x: 2, y: 10, width: 8, height: 2, type: "secondary-path" },
            { id: "north-square-east", label: "SIDE STREET", x: 14, y: 10, width: 8, height: 2, type: "secondary-path" },
            { id: "north-residential-west", label: "RESIDENTIAL STREET", x: 4, y: 5, width: 6, height: 2, type: "secondary-path" },
            { id: "north-residential-east", label: "RESIDENTIAL STREET", x: 14, y: 5, width: 6, height: 2, type: "secondary-path" },
            { id: "north-lower-street", label: "SIDE STREET", x: 5, y: 16, width: 14, height: 2, type: "secondary-path" }
        ],
        footprints: [
            { id: "north-wall-west", label: "WALL", x: 2, y: 1, width: 7, height: 1, type: "wall" },
            { id: "north-wall-east", label: "WALL", x: 15, y: 1, width: 7, height: 1, type: "wall" },
            { id: "north-town-gate", label: "NORTH_TOWN_GATE", x: 9, y: 0, width: 6, height: 2, type: "important-building", blocking: false },
            { id: "north-service-building", label: "TOWN SERVICE", x: 2, y: 7, width: 5, height: 3, type: "important-building" },
            { id: "north-large-building", label: "LARGE PUBLIC BUILDING", x: 17, y: 7, width: 5, height: 3, type: "important-building" },
            { id: "north-house-west-01", label: "HOUSE", x: 2, y: 2, width: 4, height: 3, type: "building" },
            { id: "north-house-west-02", label: "HOUSE", x: 6, y: 2, width: 3, height: 3, type: "building" },
            { id: "north-house-east-01", label: "HOUSE", x: 15, y: 2, width: 3, height: 3, type: "building" },
            { id: "north-house-east-02", label: "HOUSE", x: 18, y: 2, width: 4, height: 3, type: "building" },
            { id: "north-house-lower-west", label: "HOUSE", x: 2, y: 13, width: 5, height: 3, type: "building" },
            { id: "north-house-lower-east", label: "HOUSE", x: 17, y: 13, width: 5, height: 3, type: "building" }
        ],
        markers: [
            { id: "north-square-center", label: "FOUNTAIN / PUBLIC SPACE", x: 11, y: 10, width: 2, height: 2, type: "important" },
            { id: "north-npc-west", label: "NPC_POSITION", x: 8, y: 11, width: 1, height: 1, type: "npc-marker" },
            { id: "north-npc-east", label: "NPC_POSITION", x: 15, y: 12, width: 1, height: 1, type: "npc-marker" },
            { id: "north-npc-lower", label: "NPC_POSITION", x: 9, y: 16, width: 1, height: 1, type: "npc-marker" },
            { id: "north-stall", label: "STALL", x: 8, y: 13, width: 2, height: 1, type: "asset-marker" },
            { id: "north-crate", label: "CRATE", x: 15, y: 15, width: 1, height: 1, type: "asset-marker" },
            { id: "north-barrel", label: "BARREL", x: 8, y: 15, width: 1, height: 1, type: "asset-marker" }
        ],
        spawns: [
            { id: "spawn-from-town-south", spawnId: "spawn-from-town-south", label: "SPAWN_FROM_TOWN_PART_1", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-town-south" }
        ],
        warps: [
            { id: "warp-to-town-south", label: "WARP: TOWN_PART_1", x: 10, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "town-south", destinationSpawnId: "spawn-from-town-north" },
            { id: "warp-reserved-north-road", label: "WARP_RESERVED: NORTH_ROAD", x: 10, y: 0, width: 4, height: 1, type: "warp-reserved", active: false }
        ]
    }
});
