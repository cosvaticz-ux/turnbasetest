// Presentation only. Never attach these settings to the gameplay map definitions.
const material = (file, color, tileSize) => Object.freeze({
    texture: `./assets/images/map/materials/${file}.svg`, color, tileSize,
    outline: '#393b30'
});

export const ENVIRONMENT_MATERIALS = Object.freeze({
    forestGround: material('forest-ground', '#665a43', 192),
    dirtPath: material('dirt-path', '#776448', 192),
    grass: material('grass', '#626747', 160),
    rock: material('rock', '#68665b', 128),
    treeBark: material('tree-bark', '#514a3d', 96),
    treeFoliage: material('tree-foliage', '#454f38', 144),
    weatheredWood: material('weathered-wood', '#716047', 96),
    agedStone: material('aged-stone', '#737064', 128),
    deepForestGround: material('deep-forest-ground', '#413f31', 176),
    darkStone: material('dark-stone', '#505149', 128),
    packedEarth: material('packed-earth', '#76634a', 176),
    townStone: material('town-stone', '#777166', 128),
    timber: material('timber', '#604d39', 96),
    wornPlaster: material('worn-plaster', '#8a806c', 144)
});

const FRONT_FOREST_MATERIALS = Object.freeze({
    ground: 'forestGround',
    defaultStructure: 'rock',
    // Current runtime has generic boundary masses, not separate tree/fence meshes.
    structures: Object.freeze({
        'town-threshold-a': 'agedStone',
        'town-threshold-b': 'agedStone'
    }),
    roles: Object.freeze({
        rock: 'rock', tree: 'treeBark', 'tree-trunk': 'treeBark',
        'tree-foliage': 'treeFoliage', fence: 'weatheredWood', sign: 'weatheredWood',
        'wooden-structure': 'weatheredWood', 'city-wall': 'agedStone',
        'gate-tower': 'agedStone', 'gate-lintel': 'agedStone'
    }),
    interactables: Object.freeze({ sign: 'weatheredWood', chest: 'weatheredWood' })
});

const DEEP_FOREST_MATERIALS = Object.freeze({
    ground: 'deepForestGround',
    defaultStructure: 'darkStone',
    structures: Object.freeze({
        'front-threshold-a': 'weatheredWood',
        'front-threshold-b': 'weatheredWood',
        'town-fork-a': 'darkStone',
        'town-fork-b': 'darkStone',
        'town-fork-c': 'darkStone'
    }),
    roles: Object.freeze({
        boundary: 'darkStone', rock: 'darkStone', tree: 'treeBark',
        'tree-trunk': 'treeBark', 'tree-foliage': 'treeFoliage',
        fence: 'weatheredWood', sign: 'weatheredWood'
    }),
    interactables: Object.freeze({ sign: 'weatheredWood', chest: 'weatheredWood' })
});

const TOWN_SOUTH_MATERIALS = Object.freeze({
    ground: 'packedEarth',
    defaultStructure: 'wornPlaster',
    structures: Object.freeze({
        'south-gate-wall': 'townStone',
        'south-gate-tower-a': 'townStone',
        'south-gate-tower-b': 'townStone',
        'south-gate-lintel': 'townStone',
        'forest-boundary': 'weatheredWood'
    }),
    roles: Object.freeze({
        'city-wall': 'townStone', 'gate-tower': 'townStone',
        'gate-lintel': 'townStone', 'wall-section': 'weatheredWood',
        'building-mass': 'wornPlaster', 'shop-footprint': 'timber',
        fence: 'weatheredWood', sign: 'weatheredWood'
    }),
    interactables: Object.freeze({ sign: 'weatheredWood', chest: 'timber' })
});

const TOWN_NORTH_MATERIALS = Object.freeze({
    ground: 'townStone',
    defaultStructure: 'wornPlaster',
    structures: Object.freeze({
        'west-gate-left-tower': 'agedStone',
        'west-gate-right-tower': 'agedStone',
        'west-gate-lintel': 'agedStone',
        'west-gate-connecting-wall': 'agedStone',
        'west-gate-connecting-wall-far': 'agedStone',
        'north-shop-mass': 'timber',
        'south-shop-mass': 'timber'
    }),
    roles: Object.freeze({
        'city-wall': 'agedStone', 'gate-tower': 'agedStone',
        'gate-lintel': 'agedStone', 'building-mass': 'wornPlaster',
        'shop-footprint': 'timber', fence: 'weatheredWood',
        sign: 'weatheredWood'
    }),
    interactables: Object.freeze({ sign: 'weatheredWood', chest: 'timber' })
});

export const ENVIRONMENT_PRESENTATIONS = Object.freeze({
    'front-forest': FRONT_FOREST_MATERIALS,
    'deep-forest': DEEP_FOREST_MATERIALS,
    'town-south': TOWN_SOUTH_MATERIALS,
    'town-north': TOWN_NORTH_MATERIALS
});

export function getEnvironmentMaterials(mapId) {
    return ENVIRONMENT_PRESENTATIONS[mapId] || null;
}
