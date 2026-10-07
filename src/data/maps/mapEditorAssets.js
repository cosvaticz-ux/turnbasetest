export const MAP_EDITOR_GROUND_CATALOG = Object.freeze([
    Object.freeze({ id: "grass", label: "Grass", asset: "assets/images/map/ground/grass/ground_grass_01.png", category: "ground" }),
    Object.freeze({ id: "dirt", label: "Dirt", asset: "assets/images/map/ground/dirt/ground_dirt_01.png", category: "ground" }),
    Object.freeze({ id: "stone", label: "Stone", asset: "assets/images/map/ground/stone/ground_stone_01.png", category: "ground" }),
    Object.freeze({ id: "edge-grass", label: "Edge of Grass", asset: "assets/images/map/ground/edge-of-grass.png", category: "edge" }),
    Object.freeze({ id: "edge-dirt", label: "Edge of Dirt", asset: "assets/images/map/ground/edge-of-dirt.png", category: "edge" }),
    Object.freeze({ id: "edge-stone", label: "Edge of Stone", asset: "assets/images/map/ground/edge-of-stone.png", category: "edge" }),
    Object.freeze({ id: "grass-dirt", label: "Grass + Dirt", asset: "assets/images/map/ground/mix/ground_grass-dirt_01.png", category: "mix" }),
    Object.freeze({ id: "dirt-stone-1", label: "Dirt + Stone A", asset: "assets/images/map/ground/mix/ground_dirt-stone_01.png", category: "mix" }),
    Object.freeze({ id: "dirt-stone-2", label: "Dirt + Stone B", asset: "assets/images/map/ground/mix/ground_dirt-stone_02.png", category: "mix" }),
    Object.freeze({ id: "grass-stone-1", label: "Grass + Stone A", asset: "assets/images/map/ground/mix/ground_grass-stone_01.png", category: "mix" }),
    Object.freeze({ id: "grass-stone-2", label: "Grass + Stone B", asset: "assets/images/map/ground/mix/ground_grass-stone-02.png", category: "mix" }),
    Object.freeze({ id: "triple-1", label: "Dirt + Stone + Grass A", asset: "assets/images/map/ground/mix/ground_dirt-stone-grass_01.png", category: "mix" }),
    Object.freeze({ id: "triple-4", label: "Dirt + Stone + Grass D", asset: "assets/images/map/ground/mix/ground_dirt-stone-grass_04.png", category: "mix" })
]);

export const MAP_EDITOR_ASSET_CATALOG = Object.freeze([
    Object.freeze({ id: "edge-object-grass", label: "Edge Grass", asset: "assets/images/map/ground/edge-of-grass.png", category: "Edge", defaultScale: 0.52, selectionOffsetX: 24, selectionOffsetY: 0 }),
    Object.freeze({ id: "edge-object-dirt", label: "Edge Dirt", asset: "assets/images/map/ground/edge-of-dirt.png", category: "Edge", defaultScale: 0.52, selectionOffsetX: 24, selectionOffsetY: 0 }),
    Object.freeze({ id: "edge-object-stone", label: "Edge Stone", asset: "assets/images/map/ground/edge-of-stone.png", category: "Edge", defaultScale: 0.52, selectionOffsetX: 24, selectionOffsetY: 0 }),

    Object.freeze({ id: "town-home", label: "House", asset: "assets/images/map/town/town-home1.png", category: "Town", defaultScale: 0.55 }),
    Object.freeze({ id: "town-shop", label: "General Shop", asset: "assets/images/map/town/town-shop.png", category: "Town", defaultScale: 0.55 }),
    Object.freeze({ id: "town-potion", label: "Potion Shop", asset: "assets/images/map/town/town-potionshop-1.png", category: "Town", defaultScale: 0.55 }),
    Object.freeze({ id: "town-weapon", label: "Weapon Shop", asset: "assets/images/map/town/town-weaponshop-1.png", category: "Town", defaultScale: 0.55 }),
    Object.freeze({ id: "town-market", label: "Market Stall", asset: "assets/images/map/town/town-market1.png", category: "Town", defaultScale: 0.42 }),
    Object.freeze({ id: "town-gate", label: "Town Gate", asset: "assets/images/map/town/town-gate-1.png", category: "Town", defaultScale: 0.62 }),
    Object.freeze({ id: "town-wall-x", label: "Town Wall Horizontal", asset: "assets/images/map/town/town-wall-x1.png", category: "Town", defaultScale: 0.62 }),
    Object.freeze({ id: "town-wall-y", label: "Town Wall Vertical", asset: "assets/images/map/town/town-wall-y1.png", category: "Town", defaultScale: 0.62 }),
    Object.freeze({ id: "town-barrel", label: "Barrel", asset: "assets/images/map/town/town-barrel.png", category: "Town", defaultScale: 0.22 }),

    Object.freeze({ id: "broadleaf-1", label: "Broadleaf 1", asset: "assets/images/map/tree/Broadleaf1.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "broadleaf-2", label: "Broadleaf 2", asset: "assets/images/map/tree/Broadleaf2.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "broadleaf-3", label: "Broadleaf 3", asset: "assets/images/map/tree/Broadleaf3.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "twisted-1", label: "Old Twisted 1", asset: "assets/images/map/tree/Old%20%20Twisted1.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "twisted-2", label: "Old Twisted 2", asset: "assets/images/map/tree/Old%20%20Twisted2.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "twisted-3", label: "Old Twisted 3", asset: "assets/images/map/tree/Old%20%20Twisted3.png", category: "Nature", defaultScale: 0.28 }),
    Object.freeze({ id: "tall-1", label: "Tall Narrow 1", asset: "assets/images/map/tree/Tall%20Narrow1.png", category: "Nature", defaultScale: 0.30 }),
    Object.freeze({ id: "tall-2", label: "Tall Narrow 2", asset: "assets/images/map/tree/Tall%20Narrow2.png", category: "Nature", defaultScale: 0.30 }),
    Object.freeze({ id: "tall-3", label: "Tall Narrow 3", asset: "assets/images/map/tree/Tall%20Narrow3.png", category: "Nature", defaultScale: 0.30 }),
    Object.freeze({ id: "grass-clump", label: "Grass Clump", asset: "assets/images/map/tree/grass1.png", category: "Nature", defaultScale: 0.18 })
]);

export function getEditorAssetDefinition(assetId) {
    return MAP_EDITOR_ASSET_CATALOG.find(item => item.id === assetId) || null;
}

export function getEditorGroundDefinition(groundId) {
    return MAP_EDITOR_GROUND_CATALOG.find(item => item.id === groundId) || null;
}
