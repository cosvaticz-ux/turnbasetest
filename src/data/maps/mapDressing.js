import { getMapNode } from "./mapNodeRegistry.js";
import { AssetResolver } from "../../core/AssetResolver.js";

export const MAP_GROUND_ASSETS = Object.freeze({
    grass: AssetResolver.map("ground/grass/ground_grass_01.png"),
    dirt: AssetResolver.map("ground/dirt/ground_dirt_01.png"),
    stone: AssetResolver.map("ground/stone/ground_stone_01.png"),
    grassDirt: AssetResolver.map("ground/mix/ground_grass-dirt_01.png")
});


export function getMapBaseGroundAsset(mapNodeId) {
    return String(mapNodeId || "").startsWith("town-")
        ? MAP_GROUND_ASSETS.stone
        : MAP_GROUND_ASSETS.grass;
}

const TREE_ASSETS = Object.freeze([
    AssetResolver.map("tree/Broadleaf1.png"),
    AssetResolver.map("tree/Broadleaf2.png"),
    AssetResolver.map("tree/Old%20%20Twisted1.png"),
    AssetResolver.map("tree/Tall%20Narrow2.png")
]);

const FOREST_POINTS = Object.freeze({
    "front-forest": [[4.6, 5.8], [5.4, 7.4], [18.7, 6.3], [19.4, 9.2], [4.7, 15.2], [19.2, 16.4], [8.5, 5.8], [15.4, 5.6]],
    "deep-forest": [[4.7, 4.5], [5.2, 12.8], [9.6, 4.2], [11.8, 5.5], [18.8, 4.8], [19.3, 10.4], [10.7, 15.5], [18.7, 17.1], [4.6, 18.2]]
});

const TOWN_ASSET_BY_LABEL = Object.freeze({
    HOUSE: AssetResolver.map("town/town-home1.png"),
    GENERAL_STORE: AssetResolver.map("town/town-shop.png"),
    POTION_SHOP: AssetResolver.map("town/town-potionshop-1.png"),
    WEAPON_SHOP: AssetResolver.map("town/town-weaponshop-1.png"),
    TOWN_GATE: AssetResolver.map("town/town-gate-1.png"),
    NORTH_TOWN_GATE: AssetResolver.map("town/town-gate-1.png"),
    ADVENTURER_GUILD: AssetResolver.map("town/town-shop.png"),
    "TOWN SERVICE": AssetResolver.map("town/town-shop.png"),
    "LARGE PUBLIC BUILDING": AssetResolver.map("town/town-weaponshop-1.png")
});

export function getMapGroundStamps(mapNode) {
    const isTown = mapNode?.id?.startsWith("town-");
    return (mapNode?.groups?.paths || []).map((path, index) => ({
        id: `${path.id}-surface`, sourceId: path.id, sourceDefinition: path,
        asset: isTown ? MAP_GROUND_ASSETS.stone : MAP_GROUND_ASSETS.dirt,
        context: isTown ? "town" : "forest", kind: "core",
        orientation: path.height > path.width ? "vertical" : "horizontal",
        x: path.x, y: path.y, width: path.width, height: path.height,
        rotation: 0, opacity: isTown ? 0.78 : 0.88,
        backgroundSize: isTown ? 300 : 340, variant: index % 3
    }));
}

// Reuse legacy art positions, seating roots inside existing blocked terrain.
// This adjusts only decorative anchors, never gameplay collision rectangles.
function seatTreeInBlockedTerrain(mapNodeId, x, y) {
    const zones = getMapNode(mapNodeId)?.groups.zones.filter(zone => zone.type === 'blocked') || [];
    const candidates = zones.map(zone => ({
        x: Math.max(zone.x + .25, Math.min(zone.x + zone.width - .25, x)),
        y: Math.max(zone.y + .25, Math.min(zone.y + zone.height - .25, y))
    }));
    return candidates.sort((a,b) => Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0] || {x,y};
}

export function getMapVegetation(mapNodeId) {
    return (FOREST_POINTS[mapNodeId] || []).map(([x, y], index) => ({
        id: `${mapNodeId}-tree-${index + 1}`, type: "tree", family: "forest",
        asset: TREE_ASSETS[index % TREE_ASSETS.length], ...seatTreeInBlockedTerrain(mapNodeId, x, y),
        height: 220 + (index % 3) * 34, flip: index % 2 ? -1 : 1,
        rotation: (index % 3 - 1) * 2, opacity: 0.96, rootOffset: 0,
        shadow: true, forestRole: index < 4 ? "edge" : "interior"
    }));
}

export function getForestMassRegions(mapNodeId) {
    if (!['front-forest','deep-forest'].includes(mapNodeId)) return [];
    return getMapNode(mapNodeId).groups.zones.filter(zone => zone.type === 'blocked').map((zone,index) => ({
        ...zone, id: zone.id + '-mass', sourceZoneId: zone.id, edge: 'all', variant: index % 3
    }));
}

export function getMapTownProps(mapNodeId) {
    if (!mapNodeId?.startsWith('town-')) return [];
    return getMapNode(mapNodeId).groups.footprints.filter(footprint => TOWN_ASSET_BY_LABEL[footprint.label]).map(footprint => ({
        id: footprint.id + '-visual', sourceId: footprint.id,
        kind: footprint.label.toLowerCase().replace(/[^a-z]+/g, '-'),
        asset: TOWN_ASSET_BY_LABEL[footprint.label],
        x: footprint.x + footprint.width / 2, y: footprint.y + footprint.height,
        height: /GATE/.test(footprint.label) ? 300 : footprint.type === 'important-building' ? 240 : 210,
        footprintWidth: footprint.width, footprintHeight: footprint.height,
        anchorX: .5, anchorY: 1, depthOffset: 0,
        contactWidth: 130, contactDepth: 14, rootOffset: 0, scaleCategory: footprint.label
    }));
}

export function getForestDressingMetrics(mapNodeId) {
    const vegetation = getMapVegetation(mapNodeId);
    return Object.freeze({
        beforeTreeCount: vegetation.length,
        renderedTreeCount: vegetation.length,
        grassCount: 0,
        regionCount: getForestMassRegions(mapNodeId).length
    });
}
