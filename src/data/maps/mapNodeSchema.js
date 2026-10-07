const freezeEntries = entries => Object.freeze(entries.map(entry => Object.freeze({ ...entry })));

export const MAP_NODE_GRID = Object.freeze({
    cellSize: 64,
    columns: 24,
    rows: 20
});

export const MAP_NODE_LAYER_ORDER = Object.freeze([
    "zones",
    "paths",
    "footprints",
    "markers",
    "spawns",
    "warps"
]);

export function defineMapNode(definition) {
    const groups = {};
    for (const groupId of MAP_NODE_LAYER_ORDER) {
        groups[groupId] = freezeEntries(definition.groups?.[groupId] || []);
    }
    return Object.freeze({
        id: definition.id,
        name: definition.name,
        shortName: definition.shortName,
        role: definition.role,
        grid: MAP_NODE_GRID,
        defaultSpawnId: definition.defaultSpawnId,
        groups: Object.freeze(groups)
    });
}

export function getMapNodeObjects(node) {
    return MAP_NODE_LAYER_ORDER.flatMap(groupId => node.groups[groupId]);
}
