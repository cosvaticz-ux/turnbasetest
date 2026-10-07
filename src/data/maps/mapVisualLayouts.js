const MAP_VISUAL_LAYOUT_PATHS = Object.freeze({
    "town-south": "src/data/maps/layout/town-south-visual-layout.json"
});

// Visual map dressing is intentionally paused for now.
// Keep exported JSON files and editor tooling intact, but do not render them
// in the playable MapScene until the final asset-map workflow is decided.
const RUNTIME_VISUAL_LAYOUTS_ENABLED = false;

const layoutCache = new Map();
const pendingLoads = new Map();

function normalizeLayout(raw, expectedMapId) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.mapId !== expectedMapId) return null;

    const dimensions = raw.dimensions && typeof raw.dimensions === "object"
        ? raw.dimensions
        : {};
    const groundCells = Array.isArray(raw.groundCells)
        ? raw.groundCells.filter(cell => cell && typeof cell.groundId === "string")
        : [];
    const surfaces = Array.isArray(raw.surfaces)
        ? raw.surfaces.filter(surface => surface && typeof surface.groundId === "string")
        : [];
    const assets = Array.isArray(raw.assets)
        ? raw.assets.filter(asset => asset && typeof asset.assetId === "string")
        : [];

    return Object.freeze({
        editorVersion: Number(raw.editorVersion) || 1,
        mapId: expectedMapId,
        dimensions: Object.freeze({
            width: Math.max(1, Number(dimensions.width) || 1536),
            height: Math.max(1, Number(dimensions.height) || 1280),
            gameplayCellSize: Math.max(1, Number(dimensions.gameplayCellSize) || 64),
            paintCellSize: Math.max(1, Number(dimensions.paintCellSize) || 32)
        }),
        baseGround: String(raw.baseGround || "grass"),
        groundCells: Object.freeze(groundCells.map(cell => Object.freeze({
            column: Number(cell.column) || 0,
            row: Number(cell.row) || 0,
            x: Number.isFinite(Number(cell.x)) ? Number(cell.x) : (Number(cell.column) || 0) * (Number(dimensions.paintCellSize) || 32),
            y: Number.isFinite(Number(cell.y)) ? Number(cell.y) : (Number(cell.row) || 0) * (Number(dimensions.paintCellSize) || 32),
            groundId: cell.groundId
        }))),
        surfaces: Object.freeze(surfaces.map(surface => Object.freeze({
            id: String(surface.id || surface.groundId),
            groundId: surface.groundId,
            x: Number(surface.x) || 0,
            y: Number(surface.y) || 0,
            width: Math.max(1, Number(surface.width) || 1),
            height: Math.max(1, Number(surface.height) || 1),
            rotation: Number(surface.rotation) || 0,
            opacity: Math.max(0, Math.min(1, Number(surface.opacity) || 1)),
            borderRadius: String(surface.borderRadius || "28px"),
            clipPath: surface.clipPath ? String(surface.clipPath) : ""
        }))),
        assets: Object.freeze(assets.map(asset => Object.freeze({
            id: String(asset.id || asset.assetId),
            assetId: asset.assetId,
            x: Number(asset.x) || 0,
            y: Number(asset.y) || 0,
            scale: Math.max(0.01, Number(asset.scale) || 1),
            rotation: Number(asset.rotation) || 0,
            flip: Number(asset.flip) === -1 ? -1 : 1
        })))
    });
}

export function hasMapVisualLayout(mapId) {
    return RUNTIME_VISUAL_LAYOUTS_ENABLED && Boolean(MAP_VISUAL_LAYOUT_PATHS[mapId]);
}

export function getCachedMapVisualLayout(mapId) {
    return layoutCache.get(mapId) || null;
}

export async function loadMapVisualLayout(mapId) {
    if (!hasMapVisualLayout(mapId)) return null;
    if (layoutCache.has(mapId)) return layoutCache.get(mapId);
    if (pendingLoads.has(mapId)) return pendingLoads.get(mapId);

    const request = fetch(MAP_VISUAL_LAYOUT_PATHS[mapId], { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(raw => {
            const layout = normalizeLayout(raw, mapId);
            if (!layout) throw new Error("Invalid visual layout");
            layoutCache.set(mapId, layout);
            pendingLoads.delete(mapId);
            return layout;
        })
        .catch(error => {
            pendingLoads.delete(mapId);
            console.warn(`[MapVisualLayout] Failed to load ${mapId}:`, error);
            return null;
        });

    pendingLoads.set(mapId, request);
    return request;
}

export function clearMapVisualLayoutCache(mapId = null) {
    if (mapId) {
        layoutCache.delete(mapId);
        pendingLoads.delete(mapId);
        return;
    }
    layoutCache.clear();
    pendingLoads.clear();
}
