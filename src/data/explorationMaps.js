import { getGreyboxMapGeometry } from './greyboxMapGeometry.js';

const rect = (xMin, yMin, xMax, yMax) => [
    { x: xMin, y: yMin }, { x: xMax, y: yMin },
    { x: xMax, y: yMax }, { x: xMin, y: yMax }
];
const exit = (id, xMin, yMin, xMax, yMax, targetMap, target) => ({ id, xMin, yMin, xMax, yMax, targetMap, target });
const npc = (id, name, x, y, dialogueId, type = 'npc') => ({ id, name, x, y, dialogueId, type });
const structural = (id, xMin, yMin, xMax, yMax, height = 90, options = {}) => ({
    id,
    polygon: rect(xMin, yMin, xMax, yMax),
    height,
    layer: 'background',
    role: 'structure',
    ...options
});

export const EXPLORATION_DEBUG_GEOMETRY = true;

function map(definition) {
    const greybox = getGreyboxMapGeometry(definition.id);
    const defaultSpawn = greybox?.spawnPoint || definition.spawnPoint;
    const spawnPoints = Object.freeze({
        default: Object.freeze({ ...defaultSpawn }),
        ...(definition.spawnPoints || {})
    });
    const camera = Object.freeze({
        pitch: 40,
        yaw: 45,
        zoom: 1.12,
        actorScale: 1.28,
        focus: defaultSpawn,
        ...(definition.camera || {})
    });
    return Object.freeze({
        gridSize: 80,
        enemies: [], encounterZones: [], interactables: [], structuralGeometry: [],
        ...definition,
        ...(greybox ? {
            greyboxReference: greybox.reference,
            walkablePolygons: greybox.walkablePolygons,
            blockedPolygons: greybox.blockedPolygons,
            spawnPoint: defaultSpawn
        } : {}),
        camera,
        spawnPoint: defaultSpawn,
        spawnPoints
    });
}

export const EXPLORATION_MAPS = Object.freeze({
    'town-south': map({
        id: 'town-south', name: 'Town Part 1 · South District',
        environmentImage: Object.freeze({
            src: './assets/images/map/town/town-south-environment-poc.svg',
            projectionFrame: Object.freeze({ x: -850, y: -150, width: 1850, height: 1150 }),
            alt: 'Illustrated view of Town Part 1 South District'
        }),
        spawnPoint: { x: 420, y: 550 },
        spawnPoints: { west: { x: 180, y: 550 }, east: { x: 1390, y: 540 } },
        camera: { zoom: 1.16, actorScale: 1.34, focus: { x: 720, y: 570 }, offsetY: 0.16 },
        exits: [
            exit('to-deep-forest', 70, 480, 145, 620, 'deep-forest', { x: 1390, y: 780 }),
            exit('to-town-north', 1430, 460, 1510, 620, 'town-north', { x: 170, y: 560 })
        ],
        interactables: [
            { ...npc('villager', 'Townswoman', 570, 480, 'villager'), assetId: 'town-woman2', dialoguePortraitAssetId: 'town-woman' },
            npc('shop', 'Apothecary Iven', 770, 760, null, 'shop'),
            npc('south-door', 'Old House', 920, 360, 'laneDoor', 'door')
        ],
        structuralGeometry: [
            structural('west-gate-left-tower', 25, 285, 175, 465, 190, { role: 'gate-tower' }),
            structural('west-gate-right-tower', 25, 635, 175, 815, 190, { role: 'gate-tower', layer: 'foreground' }),
            structural('west-gate-lintel', 25, 465, 175, 635, 45, { role: 'gate-lintel', baseElevation: 145 }),
            structural('west-gate-connecting-wall', 35, 40, 125, 285, 125, { role: 'city-wall' }),
            structural('west-gate-connecting-wall-far', 35, 815, 125, 1060, 125, { role: 'city-wall', layer: 'foreground' }),
            structural('north-shop-mass', 390, 95, 650, 300, 135, { role: 'building-mass' }),
            structural('north-house-mass', 720, 80, 1010, 265, 150, { role: 'building-mass' }),
            structural('east-wall-mass', 1160, 205, 1390, 415, 120, { role: 'building-mass' }),
            structural('south-shop-mass', 330, 875, 570, 1070, 115, { role: 'shop-footprint', layer: 'foreground' }),
            structural('south-house-mass', 1040, 760, 1300, 990, 135, { role: 'building-mass', layer: 'foreground' })
        ]
    }),
    'town-north': map({
        id: 'town-north', name: 'Town Part 2',
        spawnPoint: { x: 180, y: 560 },
        spawnPoints: { town: { x: 170, y: 560 }, forest: { x: 230, y: 840 } },
        camera: { zoom: 1.14, actorScale: 1.3, focus: { x: 720, y: 575 }, offsetY: 0.04 },
        exits: [
            exit('to-town-south', 80, 480, 145, 635, 'town-south', { x: 1390, y: 540 }),
            exit('to-deep-forest', 145, 845, 250, 945, 'deep-forest', { x: 1380, y: 320 })
        ],
        interactables: [
            { ...npc('mara', 'Mara', 350, 650, 'mara'), assetId: 'town-mara2', dialoguePortraitAssetId: 'town-mara' },
            npc('hall', 'Town Hall', 1030, 360, 'laneTownHall', 'landmark')
        ],
        structuralGeometry: [
            structural('south-gate-wall', 35, 250, 120, 470, 120, { role: 'city-wall' }),
            structural('south-gate-tower-a', 25, 330, 165, 470, 175, { role: 'gate-tower' }),
            structural('south-gate-tower-b', 25, 635, 165, 775, 175, { role: 'gate-tower', layer: 'foreground' }),
            structural('south-gate-lintel', 25, 470, 165, 635, 40, { role: 'gate-lintel', baseElevation: 135 }),
            structural('north-hall-mass', 650, 45, 1030, 205, 145, { role: 'building-mass' }),
            structural('east-residence-mass', 1240, 160, 1490, 345, 125, { role: 'building-mass' }),
            structural('forest-boundary', 80, 900, 410, 1015, 80, { role: 'wall-section', layer: 'foreground' })
        ]
    }),
    'front-forest': map({
        id: 'front-forest', name: 'Front Forest',
        spawnPoint: { x: 180, y: 550 },
        spawnPoints: { west: { x: 180, y: 550 }, east: { x: 1390, y: 665 } },
        camera: { zoom: 1.13, actorScale: 1.3, focus: { x: 755, y: 540 }, offsetY: 0.04 },
        exits: [
            exit('to-town-south', 60, 475, 135, 630, 'town-south', { x: 1390, y: 540 }),
            exit('to-deep-forest', 1430, 590, 1510, 745, 'deep-forest', { x: 170, y: 560 })
        ],
        interactables: [
            npc('sign', 'Road Sign', 720, 400, 'laneSign', 'sign'),
            { ...npc('supplies', 'Abandoned Chest', 1030, 500, 'laneSupplies', 'chest'), onceFlag: 'lane-front-supplies', rewards: { items: [{ id: 'healing-draught', quantity: 1 }] } }
        ],
        enemies: [{ id: 'lane-front-guard', x: 890, y: 430, encounterId: 'highwayman-patrol', mode: 'static' }],
        encounterZones: [{ id: 'front-brush', polygon: rect(1120, 520, 1390, 790), encounterPool: ['highwayman-patrol'] }],
        structuralGeometry: [
            structural('town-threshold-a', 30, 305, 130, 455, 100, { role: 'boundary' }),
            structural('town-threshold-b', 30, 655, 130, 805, 100, { role: 'boundary', layer: 'foreground' }),
            structural('north-ridge-a', 390, 190, 690, 285, 75, { role: 'boundary' }),
            structural('north-ridge-b', 900, 185, 1190, 290, 75, { role: 'boundary' }),
            structural('south-ridge', 700, 790, 1110, 900, 70, { role: 'boundary', layer: 'foreground' }),
            structural('forest-threshold-a', 1440, 455, 1530, 570, 100, { role: 'boundary' }),
            structural('forest-threshold-b', 1440, 765, 1530, 870, 100, { role: 'boundary', layer: 'foreground' })
        ]
    }),
    'deep-forest': map({
        id: 'deep-forest', name: 'Forest',
        spawnPoint: { x: 180, y: 560 },
        spawnPoints: { front: { x: 170, y: 560 }, town: { x: 1390, y: 780 }, crossroads: { x: 1380, y: 320 } },
        camera: { zoom: 1.1, actorScale: 1.28, focus: { x: 760, y: 560 }, offsetY: 0.03 },
        exits: [
            exit('to-front-forest', 60, 480, 135, 635, 'front-forest', { x: 1390, y: 665 }),
            exit('to-town-south', 1430, 650, 1510, 810, 'town-south', { x: 180, y: 550 }),
            exit('to-town-north', 1430, 275, 1510, 430, 'town-north', { x: 230, y: 840 })
        ],
        interactables: [npc('shrine', 'Weathered Shrine', 950, 760, 'deepShrine', 'landmark')],
        enemies: [
            { id: 'lane-deep-patrol', x: 710, y: 660, encounterId: 'highwayman-patrol', mode: 'patrol', patrol: [{ x: 640, y: 660 }, { x: 780, y: 660 }], speed: 65 },
            { id: 'lane-deep-guard', x: 1080, y: 360, encounterId: 'highwayman-patrol', mode: 'static' }
        ],
        structuralGeometry: [
            structural('front-threshold-a', 30, 330, 125, 470, 100, { role: 'boundary' }),
            structural('front-threshold-b', 30, 650, 125, 790, 100, { role: 'boundary', layer: 'foreground' }),
            structural('north-mass-a', 390, 155, 720, 275, 85, { role: 'boundary' }),
            structural('north-mass-b', 930, 70, 1250, 210, 100, { role: 'boundary' }),
            structural('south-mass', 760, 915, 1210, 1030, 80, { role: 'boundary', layer: 'foreground' }),
            structural('town-fork-a', 1430, 150, 1530, 260, 110, { role: 'boundary' }),
            structural('town-fork-b', 1430, 445, 1530, 625, 110, { role: 'boundary' }),
            structural('town-fork-c', 1430, 825, 1530, 945, 110, { role: 'boundary', layer: 'foreground' })
        ]
    })
});

function laneFallback(laneId, x) {
    const yByLane = { far: 370, middle: 550, near: 730 };
    return { x: 80 + Math.max(0, Math.min(3200, Number(x) || 320)) * (1400 / 3200), y: yByLane[laneId] || 550 };
}

export function getExplorationSpawn(mapId, spawnId = 'default') {
    const map = EXPLORATION_MAPS[mapId] || EXPLORATION_MAPS['front-forest'];
    return map.spawnPoints[spawnId] || map.spawnPoint;
}

export function normalizeExplorationPosition(position = {}) {
    const mapId = EXPLORATION_MAPS[position.mapId || position.mapNodeId] ? (position.mapId || position.mapNodeId) : 'front-forest';
    const map = EXPLORATION_MAPS[mapId];
    if (Number.isFinite(position.x) && Number.isFinite(position.y) && !position.laneId) return { mapId, x: position.x, y: position.y };
    const migrated = position.laneId
        ? laneFallback(position.laneId, position.x)
        : getExplorationSpawn(mapId, position.spawnId);
    return { mapId, x: migrated.x, y: migrated.y };
}

export const normalizeLanePosition = normalizeExplorationPosition;
