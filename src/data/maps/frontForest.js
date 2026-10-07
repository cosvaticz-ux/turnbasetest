import { defineMapNode } from "./mapNodeSchema.js";

export const FRONT_FOREST_NODE = defineMapNode({
    id: "front-forest",
    name: "Front Forest",
    shortName: "Front Forest",
    role: "Player starting area and transition between the deep forest and the southern town gate.",
    defaultSpawnId: "player-start",
    groups: {
        zones: [
            { id: "front-ground", label: "GROUND_GRASS / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
            { id: "front-block-west", label: "DENSE FOREST / BLOCKED", x: 0, y: 0, width: 5, height: 20, type: "blocked" },
            { id: "front-block-east-north", label: "DENSE FOREST / BLOCKED", x: 19, y: 0, width: 5, height: 9, type: "blocked" },
            { id: "front-block-east-south", label: "DENSE FOREST / BLOCKED", x: 19, y: 12, width: 5, height: 8, type: "blocked" },
            { id: "front-block-north-west", label: "FOREST EDGE / BLOCKED", x: 5, y: 0, width: 5, height: 7, type: "blocked" },
            { id: "front-block-north-east", label: "FOREST EDGE / BLOCKED", x: 14, y: 0, width: 5, height: 7, type: "blocked" },
            { id: "front-clearing", label: "OPEN CLEARING / WALKABLE", x: 8, y: 9, width: 8, height: 6, type: "walkable" }
        ],
        paths: [
            { id: "front-town-road", label: "PATH_DIRT / ROAD TO TOWN", x: 10, y: 0, width: 4, height: 11, type: "path" },
            { id: "front-road-bend", label: "PATH_DIRT", x: 8, y: 9, width: 6, height: 4, type: "path" },
            { id: "front-forest-trail", label: "FOREST_PATH", x: 5, y: 12, width: 5, height: 8, type: "path" },
            { id: "front-east-branch", label: "SECONDARY PATH", x: 14, y: 11, width: 5, height: 2, type: "secondary-path" },
            { id: "front-old-road-link", label: "OLD FOREST ROAD", x: 18, y: 9, width: 6, height: 3, type: "road" },
            { id: "front-west-branch", label: "SECONDARY PATH", x: 5, y: 8, width: 5, height: 2, type: "secondary-path" }
        ],
        footprints: [
            { id: "front-fence-west", label: "FENCE", x: 8, y: 5, width: 1, height: 4, type: "future-structure" },
            { id: "front-fence-east", label: "FENCE", x: 15, y: 5, width: 1, height: 4, type: "future-structure" }
        ],
        markers: [
            { id: "front-town-view", label: "TOWN ENTRANCE VISIBLE", x: 10, y: 1, width: 4, height: 2, type: "important" },
            { id: "front-signpost", label: "SIGNPOST", x: 9, y: 8, width: 1, height: 1, type: "asset-marker" },
            { id: "front-tree-cluster-west", label: "TREE_CLUSTER", x: 5, y: 3, width: 3, height: 3, type: "asset-marker" },
            { id: "front-tree-cluster-east", label: "TREE_CLUSTER", x: 16, y: 4, width: 3, height: 3, type: "asset-marker" },
            { id: "front-bush", label: "BUSH", x: 16, y: 13, width: 2, height: 1, type: "asset-marker" },
            { id: "front-rock", label: "ROCK", x: 7, y: 15, width: 1, height: 1, type: "asset-marker" },
            { id: "front-future-encounter", label: "ENCOUNTER_AREA / RESERVED", x: 14, y: 14, width: 4, height: 3, type: "reserved" }
        ],
        spawns: [
            { id: "player-start", spawnId: "player-start", label: "PLAYER_START", x: 10, y: 13, width: 2, height: 1, type: "spawn", facing: "north" },
            { id: "spawn-from-town-south", spawnId: "spawn-from-town-south", label: "SPAWN_FROM_TOWN_PART_1", x: 11, y: 2, width: 2, height: 1, type: "spawn", facing: "south", arrivalWarpId: "warp-to-town-south" },
            { id: "spawn-from-deep-forest", spawnId: "spawn-from-deep-forest", label: "SPAWN_FROM_FOREST", x: 6, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-deep-forest" }
            ,{ id: "spawn-from-old-forest-road", spawnId: "spawn-from-old-forest-road", label: "SPAWN_FROM_OLD_FOREST_ROAD", x: 18, y: 10, width: 1, height: 1, type: "spawn", facing: "west", arrivalWarpId: "warp-to-old-forest-road" }
        ],
        warps: [
            { id: "warp-to-town-south", label: "WARP: TOWN_PART_1", x: 10, y: 0, width: 4, height: 1, type: "warp", destinationMapId: "town-south", destinationSpawnId: "spawn-from-front-forest" },
            { id: "warp-to-deep-forest", label: "WARP: FOREST", x: 5, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "deep-forest", destinationSpawnId: "spawn-from-front-forest" }
            ,{ id: "warp-to-old-forest-road", label: "WARP: OLD FOREST ROAD", x: 23, y: 9, width: 1, height: 3, type: "warp", destinationMapId: "old-forest-road", destinationSpawnId: "spawn-from-front-forest" }
        ]
    }
});
