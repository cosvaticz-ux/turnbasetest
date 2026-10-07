import { defineMapNode } from "./mapNodeSchema.js";

export const LOCAL_MAP_NODES = Object.freeze({
    "old-forest-road": defineMapNode({
        id: "old-forest-road", name: "Old Forest Road", shortName: "Old Forest Road",
        role: "Southern contract road with wolf, boar, and highwayman encounter pockets.",
        defaultSpawnId: "spawn-from-front-forest",
        groups: {
            zones: [
                { id: "old-road-ground", label: "FOREST GROUND / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: "old-road-north-edge-west", label: "DENSE FOREST / BLOCKED", x: 0, y: 0, width: 5, height: 4, type: "blocked" },
                { id: "old-road-north-edge-east", label: "DENSE FOREST / BLOCKED", x: 8, y: 0, width: 16, height: 4, type: "blocked" },
                { id: "old-road-south-edge-west", label: "DENSE FOREST / BLOCKED", x: 0, y: 16, width: 16, height: 4, type: "blocked" },
                { id: "old-road-south-edge-east", label: "DENSE FOREST / BLOCKED", x: 19, y: 16, width: 5, height: 4, type: "blocked" },
                { id: "old-road-west-edge-north", label: "DENSE FOREST / BLOCKED", x: 0, y: 4, width: 4, height: 4, type: "blocked" },
                { id: "old-road-west-edge-south", label: "DENSE FOREST / BLOCKED", x: 0, y: 12, width: 4, height: 4, type: "blocked" },
                { id: "old-road-east-edge-north", label: "DENSE FOREST / BLOCKED", x: 20, y: 4, width: 4, height: 4, type: "blocked" },
                { id: "old-road-east-edge-south", label: "DENSE FOREST / BLOCKED", x: 20, y: 12, width: 4, height: 4, type: "blocked" }
            ],
            paths: [
                { id: "old-road-main", label: "MAIN ROAD", x: 0, y: 8, width: 24, height: 4, type: "road" },
                { id: "old-road-farm-trail", label: "SIDE TRAIL / FARMSTEAD", x: 5, y: 0, width: 3, height: 10, type: "secondary-path" },
                { id: "old-road-camp-trail", label: "SIDE TRAIL / CAMP", x: 16, y: 10, width: 3, height: 10, type: "secondary-path" }
            ],
            footprints: [
                { id: "old-road-cart", label: "ABANDONED CART / BLOCKED", x: 11, y: 7, width: 3, height: 1, type: "future-structure" }
            ],
            markers: [
                { id: "old-road-wolves", label: "WOLF CONTRACT POCKET", x: 8, y: 12, width: 4, height: 3, type: "important" },
                { id: "old-road-boar", label: "BOAR POCKET", x: 5, y: 5, width: 3, height: 3, type: "reserved" },
                { id: "old-road-highwaymen", label: "HIGHWAYMAN POCKET", x: 15, y: 5, width: 4, height: 3, type: "reserved" }
            ],
            spawns: [
                { id: "spawn-from-front-forest", spawnId: "spawn-from-front-forest", label: "FROM FRONT FOREST", x: 4, y: 9, width: 1, height: 2, type: "spawn", facing: "east", arrivalWarpId: "warp-to-front-forest" },
                { id: "spawn-from-abandoned-farmstead", spawnId: "spawn-from-abandoned-farmstead", label: "FROM FARMSTEAD", x: 6, y: 5, width: 1, height: 1, type: "spawn", facing: "south", arrivalWarpId: "warp-to-abandoned-farmstead" },
                { id: "spawn-from-woodcutter-camp", spawnId: "spawn-from-woodcutter-camp", label: "FROM WOODCUTTER CAMP", x: 17, y: 14, width: 1, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-woodcutter-camp" }
            ],
            warps: [
                { id: "warp-to-front-forest", label: "WARP: FRONT FOREST", x: 0, y: 8, width: 1, height: 4, type: "warp", destinationMapId: "front-forest", destinationSpawnId: "spawn-from-old-forest-road" },
                { id: "warp-to-abandoned-farmstead", label: "WARP: FARMSTEAD", x: 5, y: 0, width: 3, height: 1, type: "warp", destinationMapId: "abandoned-farmstead", destinationSpawnId: "spawn-from-old-forest-road" },
                { id: "warp-to-woodcutter-camp", label: "WARP: WOODCUTTER CAMP", x: 16, y: 19, width: 3, height: 1, type: "warp", destinationMapId: "woodcutter-camp", destinationSpawnId: "spawn-from-old-forest-road" }
            ]
        }
    }),
    "abandoned-farmstead": defineMapNode({
        id: "abandoned-farmstead", name: "Abandoned Farmstead", shortName: "Farmstead",
        role: "Abandoned holding for investigations, supplies, boars, and bandits.", defaultSpawnId: "spawn-from-old-forest-road",
        groups: {
            zones: [
                { id: "farm-ground", label: "OVERGROWN FARM / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: "farm-west-edge", label: "FOREST / BLOCKED", x: 0, y: 0, width: 3, height: 20, type: "blocked" },
                { id: "farm-east-edge-north", label: "FOREST / BLOCKED", x: 21, y: 0, width: 3, height: 9, type: "blocked" },
                { id: "farm-east-edge-south", label: "FOREST / BLOCKED", x: 21, y: 12, width: 3, height: 8, type: "blocked" }
            ],
            paths: [
                { id: "farm-yard-path", label: "FARM TRACK", x: 3, y: 9, width: 21, height: 3, type: "path" },
                { id: "farm-crossroad-track", label: "NORTH ROAD", x: 10, y: 10, width: 4, height: 10, type: "road" }
            ],
            footprints: [
                { id: "farm-house", label: "FARMHOUSE", x: 5, y: 3, width: 6, height: 4, type: "important-building" },
                { id: "farm-barn", label: "BARN", x: 14, y: 3, width: 5, height: 5, type: "important-building" },
                { id: "farm-fence-north", label: "FIELD FENCE", x: 4, y: 13, width: 5, height: 1, type: "wall" },
                { id: "farm-fence-west", label: "FIELD FENCE", x: 4, y: 13, width: 1, height: 5, type: "wall" }
            ],
            markers: [
                { id: "farm-well", label: "WELL", x: 12, y: 8, width: 1, height: 1, type: "asset-marker" },
                { id: "farm-investigation", label: "SUPPLY INVESTIGATION", x: 8, y: 8, width: 2, height: 1, type: "important" },
                { id: "farm-side-pocket", label: "OPTIONAL ENCOUNTER POCKET", x: 16, y: 13, width: 4, height: 4, type: "reserved" }
            ],
            spawns: [
                { id: "spawn-from-old-forest-road", spawnId: "spawn-from-old-forest-road", label: "FROM OLD ROAD", x: 19, y: 10, width: 1, height: 1, type: "spawn", facing: "west", arrivalWarpId: "warp-to-old-forest-road" },
                { id: "spawn-from-northern-crossroads", spawnId: "spawn-from-northern-crossroads", label: "FROM CROSSROADS", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-northern-crossroads" }
            ],
            warps: [
                { id: "warp-to-old-forest-road", label: "WARP: OLD ROAD", x: 23, y: 9, width: 1, height: 3, type: "warp", destinationMapId: "old-forest-road", destinationSpawnId: "spawn-from-abandoned-farmstead" },
                { id: "warp-to-northern-crossroads", label: "WARP: CROSSROADS", x: 10, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "northern-crossroads", destinationSpawnId: "spawn-from-abandoned-farmstead" }
            ]
        }
    }),
    "woodcutter-camp": defineMapNode({
        id: "woodcutter-camp", name: "Woodcutter Camp", shortName: "Woodcutter Camp",
        role: "Safe local hub with material hooks and danger along the forest edge.", defaultSpawnId: "spawn-from-old-forest-road",
        groups: {
            zones: [
                { id: "camp-ground", label: "CAMP CLEARING / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: "camp-north-edge", label: "FOREST / BLOCKED", x: 0, y: 0, width: 24, height: 3, type: "blocked" },
                { id: "camp-east-edge", label: "FOREST / BLOCKED", x: 21, y: 3, width: 3, height: 17, type: "blocked" }
            ],
            paths: [
                { id: "camp-old-road-trail", label: "OLD ROAD TRAIL", x: 0, y: 8, width: 10, height: 3, type: "path" },
                { id: "camp-crossroad-trail", label: "CROSSROADS TRAIL", x: 10, y: 10, width: 4, height: 10, type: "path" }
            ],
            footprints: [
                { id: "camp-tent-west", label: "TENT", x: 7, y: 5, width: 3, height: 2, type: "future-structure" },
                { id: "camp-tent-east", label: "TENT", x: 14, y: 5, width: 3, height: 2, type: "future-structure" },
                { id: "camp-log-pile", label: "TIMBER / LOG PILES", x: 16, y: 11, width: 4, height: 2, type: "future-structure" }
            ],
            markers: [
                { id: "camp-fire", label: "SAFE CAMPFIRE", x: 12, y: 9, width: 1, height: 1, type: "important" },
                { id: "camp-work-area", label: "WORK AREA", x: 6, y: 12, width: 4, height: 3, type: "asset-marker" },
                { id: "camp-danger-edge", label: "HIGHWAYMAN DANGER", x: 17, y: 15, width: 3, height: 3, type: "reserved" }
            ],
            spawns: [
                { id: "spawn-from-old-forest-road", spawnId: "spawn-from-old-forest-road", label: "FROM OLD ROAD", x: 3, y: 9, width: 1, height: 1, type: "spawn", facing: "east", arrivalWarpId: "warp-to-old-forest-road" },
                { id: "spawn-from-northern-crossroads", spawnId: "spawn-from-northern-crossroads", label: "FROM CROSSROADS", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-northern-crossroads" }
            ],
            warps: [
                { id: "warp-to-old-forest-road", label: "WARP: OLD ROAD", x: 0, y: 8, width: 1, height: 3, type: "warp", destinationMapId: "old-forest-road", destinationSpawnId: "spawn-from-woodcutter-camp" },
                { id: "warp-to-northern-crossroads", label: "WARP: CROSSROADS", x: 10, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "northern-crossroads", destinationSpawnId: "spawn-from-woodcutter-camp" }
            ]
        }
    }),
    "northern-crossroads": defineMapNode({
        id: "northern-crossroads", name: "Northern Crossroads", shortName: "Crossroads",
        role: "Regional transition hub for deserter, corruption, and future expansion hooks.", defaultSpawnId: "spawn-from-abandoned-farmstead",
        groups: {
            zones: [
                { id: "crossroads-ground", label: "ROADSIDE / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: "crossroads-corner-nw", label: "ROUGH GROUND / BLOCKED", x: 0, y: 0, width: 8, height: 7, type: "blocked" },
                { id: "crossroads-corner-ne", label: "ROUGH GROUND / BLOCKED", x: 16, y: 0, width: 8, height: 7, type: "blocked" },
                { id: "crossroads-corner-sw", label: "ROUGH GROUND / BLOCKED", x: 0, y: 13, width: 8, height: 7, type: "blocked" },
                { id: "crossroads-corner-se", label: "ROUGH GROUND / BLOCKED", x: 16, y: 13, width: 8, height: 7, type: "blocked" }
            ],
            paths: [
                { id: "crossroads-north-south", label: "NORTH / SOUTH ROAD", x: 9, y: 0, width: 6, height: 20, type: "road" },
                { id: "crossroads-east-west", label: "EAST / WEST ROAD", x: 0, y: 8, width: 24, height: 4, type: "road" }
            ],
            footprints: [
                { id: "crossroads-shrine", label: "RUINED ROADSIDE SHRINE", x: 15, y: 6, width: 2, height: 2, type: "future-structure" },
                { id: "crossroads-rest", label: "REST / GUARD AREA", x: 7, y: 6, width: 2, height: 2, type: "future-structure" }
            ],
            markers: [
                { id: "crossroads-signpost", label: "FOUR-WAY SIGNPOST", x: 12, y: 10, width: 1, height: 1, type: "important" },
                { id: "crossroads-danger", label: "DANGEROUS SIDE ROUTE", x: 17, y: 8, width: 4, height: 4, type: "reserved" },
                { id: "crossroads-future", label: "FUTURE NORTHERN ROUTE", x: 9, y: 0, width: 6, height: 2, type: "warp-reserved" }
            ],
            spawns: [
                { id: "spawn-from-abandoned-farmstead", spawnId: "spawn-from-abandoned-farmstead", label: "FROM FARMSTEAD", x: 3, y: 9, width: 1, height: 1, type: "spawn", facing: "east", arrivalWarpId: "warp-to-abandoned-farmstead" },
                { id: "spawn-from-woodcutter-camp", spawnId: "spawn-from-woodcutter-camp", label: "FROM CAMP", x: 20, y: 9, width: 1, height: 1, type: "spawn", facing: "west", arrivalWarpId: "warp-to-woodcutter-camp" },
                { id: "spawn-from-old-graveyard", spawnId: "spawn-from-old-graveyard", label: "FROM GRAVEYARD", x: 11, y: 3, width: 2, height: 1, type: "spawn", facing: "south", arrivalWarpId: "warp-to-old-graveyard" }
            ],
            warps: [
                { id: "warp-to-abandoned-farmstead", label: "WARP: FARMSTEAD", x: 0, y: 8, width: 1, height: 4, type: "warp", destinationMapId: "abandoned-farmstead", destinationSpawnId: "spawn-from-northern-crossroads" },
                { id: "warp-to-woodcutter-camp", label: "WARP: WOODCUTTER CAMP", x: 23, y: 8, width: 1, height: 4, type: "warp", destinationMapId: "woodcutter-camp", destinationSpawnId: "spawn-from-northern-crossroads" },
                { id: "warp-to-old-graveyard", label: "WARP: OLD GRAVEYARD", x: 9, y: 0, width: 6, height: 1, type: "warp", destinationMapId: "old-graveyard", destinationSpawnId: "spawn-from-northern-crossroads" }
            ]
        }
    }),
    "old-graveyard": defineMapNode({
        id: "old-graveyard", name: "Old Graveyard", shortName: "Old Graveyard",
        role: "Burial ground for undead contracts, investigation, and Grave Dust.", defaultSpawnId: "spawn-from-northern-crossroads",
        groups: {
            zones: [
                { id: "graveyard-ground", label: "CHURCHYARD / WALKABLE", x: 0, y: 0, width: 24, height: 20, type: "walkable" },
                { id: "graveyard-west-wall", label: "BOUNDARY WALL / BLOCKED", x: 0, y: 0, width: 2, height: 20, type: "blocked" },
                { id: "graveyard-east-wall", label: "BOUNDARY WALL / BLOCKED", x: 22, y: 0, width: 2, height: 20, type: "blocked" },
                { id: "graveyard-north-wall-west", label: "BOUNDARY WALL / BLOCKED", x: 2, y: 0, width: 8, height: 1, type: "blocked" },
                { id: "graveyard-north-wall-east", label: "BOUNDARY WALL / BLOCKED", x: 14, y: 0, width: 8, height: 1, type: "blocked" }
            ],
            paths: [
                { id: "graveyard-central-path", label: "CENTRAL PATH", x: 10, y: 0, width: 4, height: 20, type: "path" }
            ],
            footprints: [
                { id: "graveyard-chapel", label: "CHAPEL / MAUSOLEUM", x: 8, y: 2, width: 8, height: 4, type: "important-building" },
                { id: "grave-row-west-1", label: "GRAVE ROW", x: 4, y: 8, width: 4, height: 1, type: "future-structure" },
                { id: "grave-row-west-2", label: "GRAVE ROW", x: 4, y: 12, width: 4, height: 1, type: "future-structure" },
                { id: "grave-row-east-1", label: "GRAVE ROW", x: 16, y: 8, width: 4, height: 1, type: "future-structure" },
                { id: "grave-row-east-2", label: "GRAVE ROW", x: 16, y: 12, width: 4, height: 1, type: "future-structure" }
            ],
            markers: [
                { id: "graveyard-investigation", label: "INVESTIGATION POINT", x: 7, y: 15, width: 2, height: 2, type: "important" },
                { id: "graveyard-combat", label: "UNDEAD COMBAT POCKET", x: 15, y: 14, width: 5, height: 4, type: "reserved" }
            ],
            spawns: [
                { id: "spawn-from-northern-crossroads", spawnId: "spawn-from-northern-crossroads", label: "FROM CROSSROADS", x: 11, y: 17, width: 2, height: 1, type: "spawn", facing: "north", arrivalWarpId: "warp-to-northern-crossroads" }
            ],
            warps: [
                { id: "warp-to-northern-crossroads", label: "WARP: CROSSROADS", x: 10, y: 19, width: 4, height: 1, type: "warp", destinationMapId: "northern-crossroads", destinationSpawnId: "spawn-from-old-graveyard" }
            ]
        }
    })
});
