import { defineMapNode } from "./mapNodeSchema.js";

export const TOWN_SOUTH_NODE = defineMapNode({
    id: "town-south",
    name: "Town Part 1 — South District",
    shortName: "Town Part 1",
    role: "Lower town entrance with the southern gate, guild, essential shops, housing, and streets leading north.",
    defaultSpawnId: "spawn-from-front-forest",
    groups: {
        zones: [
            { id: "south-ground", label: "GROUND_TOWN / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
            { id: "south-boundary-west", label: "TOWN WALL / BLOCKED", x: 0, y: 0, width: 2, height: 20, type: "blocked" },
            { id: "south-boundary-east", label: "TOWN WALL / BLOCKED", x: 22, y: 0, width: 2, height: 20, type: "blocked" },
            { id: "south-public-space", label: "OPEN PUBLIC AREA / WALKABLE", x: 8, y: 8, width: 8, height: 5, type: "walkable" }
        ],
        paths: [
            { id: "south-town-square", label: "TOWN SQUARE / PUBLIC CROSSING", x: 8, y: 8, width: 8, height: 5, type: "public-square" },
            { id: "south-west-street", label: "SIDE STREET", x: 2, y: 8, width: 8, height: 2, type: "secondary-path" },
            { id: "south-east-street", label: "COMMERCIAL STREET", x: 14, y: 8, width: 8, height: 2, type: "secondary-path" },
            { id: "south-market-street", label: "MARKET STREET", x: 5, y: 12, width: 14, height: 2, type: "secondary-path" },
            { id: "south-west-alley", label: "ALLEY", x: 6, y: 8, width: 2, height: 4, type: "alley" },
            { id: "south-east-alley", label: "ALLEY", x: 17, y: 8, width: 2, height: 4, type: "alley" },
            { id: "south-main-road", label: "MAIN TOWN ROAD", x: 10, y: 0, width: 4, height: 20, type: "road" }
        ],
        footprints: [
            { id: "south-wall-west", label: "WALL", x: 2, y: 18, width: 7, height: 1, type: "wall" },
            { id: "south-wall-east", label: "WALL", x: 15, y: 18, width: 7, height: 1, type: "wall" },
            { id: "south-town-gate", label: "TOWN_GATE", x: 9, y: 17, width: 6, height: 2, type: "important-building", blocking: false },
            { id: "south-guild", label: "ADVENTURER_GUILD", x: 2, y: 8, width: 4, height: 4, type: "important-building" },
            { id: "south-potion-shop", label: "POTION_SHOP", x: 14, y: 2, width: 4, height: 3, type: "important-building" },
            { id: "south-weapon-shop", label: "WEAPON_SHOP", x: 18, y: 8, width: 4, height: 3, type: "important-building" },
            { id: "south-general-store", label: "GENERAL_STORE", x: 2, y: 2, width: 4, height: 3, type: "important-building" },
            { id: "south-house-west", label: "HOUSE", x: 6, y: 2, width: 4, height: 3, type: "building" },
            { id: "south-house-east", label: "HOUSE", x: 18, y: 2, width: 4, height: 3, type: "building" },
            { id: "south-house-lower-west", label: "HOUSE", x: 2, y: 14, width: 4, height: 3, type: "building" },
            { id: "south-house-lower-east", label: "HOUSE", x: 18, y: 14, width: 4, height: 3, type: "building" }
        ],
        markers: [
            { id: "south-guild-npc", label: "NPC_POSITION", x: 7, y: 9, width: 1, height: 1, type: "npc-marker" },
            { id: "south-shop-npc", label: "NPC_POSITION", x: 16, y: 7, width: 1, height: 1, type: "npc-marker" },
            { id: "south-villager", label: "NPC_POSITION", x: 9, y: 11, width: 1, height: 1, type: "npc-marker" },
            { id: "south-stall", label: "STALL", x: 14, y: 10, width: 2, height: 1, type: "asset-marker" },
            { id: "south-barrels", label: "BARREL", x: 7, y: 14, width: 1, height: 1, type: "asset-marker" },
            { id: "south-crates", label: "CRATE", x: 16, y: 14, width: 1, height: 1, type: "asset-marker" },
            { id: "south-street-prop", label: "STREET_PROP", x: 15, y: 11, width: 1, height: 1, type: "asset-marker" }
        ],
        spawns: [
            { id: "spawn-from-front-forest", spawnId: "spawn-from-front-forest", label: "SPAWN_FROM_FRONT_FOREST", x: 11, y: 16, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-front-forest" },
            { id: "spawn-from-town-north", spawnId: "spawn-from-town-north", label: "SPAWN_FROM_TOWN_PART_2", x: 11, y: 2, width: 2, height: 1, type: "spawn", facing: "south", arrivalWarpId: "warp-to-town-north" }
        ],
        warps: [
            { id: "warp-to-front-forest", label: "WARP: FRONT_FOREST", x: 10, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "front-forest", destinationSpawnId: "spawn-from-town-south" },
            { id: "warp-to-town-north", label: "WARP: TOWN_PART_2", x: 10, y: 0, width: 4, height: 1, type: "warp", destinationMapId: "town-north", destinationSpawnId: "spawn-from-town-south" }
        ]
    }
});
