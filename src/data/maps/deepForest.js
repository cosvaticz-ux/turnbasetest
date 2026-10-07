import { defineMapNode } from "./mapNodeSchema.js";

export const DEEP_FOREST_NODE = defineMapNode({
    id: "deep-forest",
    name: "Deep Forest",
    shortName: "Forest",
    role: "Dense wilderness with exploration branches, choke points, and reserved encounter spaces.",
    defaultSpawnId: "spawn-from-front-forest",
    groups: {
        zones: [
            { id: "deep-ground", label: "GROUND_GRASS / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
            { id: "deep-block-west", label: "DENSE_FOREST / BLOCKED", x: 0, y: 0, width: 5, height: 20, type: "blocked" },
            { id: "deep-block-east", label: "DENSE_FOREST / BLOCKED", x: 19, y: 0, width: 5, height: 20, type: "blocked" },
            { id: "deep-thicket-north-east", label: "DENSE_FOREST / BLOCKED", x: 10, y: 0, width: 9, height: 6, type: "blocked" },
            { id: "deep-thicket-center", label: "DENSE_FOREST / BLOCKED", x: 10, y: 8, width: 4, height: 4, type: "blocked" },
            { id: "deep-thicket-south-west", label: "DENSE_FOREST / BLOCKED", x: 5, y: 15, width: 6, height: 5, type: "blocked" },
            { id: "deep-clearing-west", label: "SMALL CLEARING / WALKABLE", x: 5, y: 7, width: 5, height: 5, type: "walkable" },
            { id: "deep-clearing-east", label: "SMALL CLEARING / WALKABLE", x: 14, y: 12, width: 5, height: 5, type: "walkable" }
        ],
        paths: [
            { id: "deep-entry-trail", label: "FOREST_PATH", x: 5, y: 0, width: 4, height: 9, type: "path" },
            { id: "deep-west-trail", label: "FOREST_PATH", x: 5, y: 8, width: 5, height: 3, type: "path" },
            { id: "deep-choke-trail", label: "CHOKE POINT", x: 10, y: 6, width: 4, height: 2, type: "secondary-path" },
            { id: "deep-east-trail", label: "SECONDARY PATH", x: 14, y: 6, width: 5, height: 8, type: "secondary-path" },
            { id: "deep-south-loop", label: "FOREST_PATH", x: 11, y: 12, width: 6, height: 5, type: "path" },
            { id: "deep-dead-end", label: "EXPLORATION BRANCH", x: 15, y: 17, width: 2, height: 3, type: "secondary-path" }
        ],
        footprints: [
            { id: "deep-fallen-tree", label: "FALLEN_TREE / BLOCKED", x: 10, y: 7, width: 4, height: 1, type: "future-structure" }
        ],
        markers: [
            { id: "deep-tree-cluster-west", label: "TREE_CLUSTER", x: 1, y: 4, width: 3, height: 3, type: "asset-marker" },
            { id: "deep-tree-cluster-east", label: "TREE_CLUSTER", x: 20, y: 8, width: 3, height: 3, type: "asset-marker" },
            { id: "deep-rock-choke", label: "ROCK", x: 13, y: 5, width: 1, height: 1, type: "asset-marker" },
            { id: "deep-bush-line", label: "BUSH", x: 15, y: 10, width: 3, height: 1, type: "asset-marker" },
            { id: "deep-encounter-west", label: "ENCOUNTER_AREA", x: 6, y: 9, width: 3, height: 2, type: "reserved" },
            { id: "deep-encounter-east", label: "ENCOUNTER_AREA", x: 15, y: 13, width: 3, height: 2, type: "reserved" },
            { id: "deep-point-interest", label: "POINT_OF_INTEREST", x: 15, y: 18, width: 2, height: 1, type: "important" }
        ],
        spawns: [
            { id: "spawn-from-front-forest", spawnId: "spawn-from-front-forest", label: "SPAWN_FROM_FRONT_FOREST", x: 6, y: 2, width: 2, height: 1, type: "spawn", facing: "south", arrivalWarpId: "warp-to-front-forest" }
        ],
        warps: [
            { id: "warp-to-front-forest", label: "WARP: FRONT_FOREST", x: 5, y: 0, width: 4, height: 1, type: "warp", destinationMapId: "front-forest", destinationSpawnId: "spawn-from-deep-forest" }
        ]
    }
});
