import { MapNodeManager } from "../core/MapNodeManager.js";
import {
    MAP_NODE_GRID,
    MAP_NODE_LAYER_ORDER
} from "../data/maps/mapNodeSchema.js";
import {
    getMapNode,
    MAP_NODE_IDS
} from "../data/maps/mapNodeRegistry.js";

const LAYER_IDS = Object.freeze({
    zones: "map-blockout-zone-layer",
    paths: "map-blockout-path-layer",
    footprints: "map-blockout-footprint-layer",
    markers: "map-blockout-marker-layer",
    spawns: "map-blockout-spawn-layer",
    warps: "map-blockout-warp-layer"
});

const TRANSITION_MS = 140;
const mapNodeManager = new MapNodeManager({ initialMapId: "front-forest" });
let elements = null;
let transitionTimer = null;

function getElements() {
    const layers = {};
    for (const groupId of MAP_NODE_LAYER_ORDER) {
        layers[groupId] = document.getElementById(LAYER_IDS[groupId]);
    }
    return {
        screen: document.getElementById("map-blockout-screen"),
        viewport: document.getElementById("map-blockout-viewport"),
        canvas: document.getElementById("map-blockout-canvas"),
        grid: document.getElementById("map-blockout-grid"),
        tabs: document.getElementById("map-blockout-node-tabs"),
        title: document.getElementById("map-blockout-title"),
        role: document.getElementById("map-blockout-role"),
        spawn: document.getElementById("map-blockout-current-spawn"),
        layers
    };
}

function safeClassToken(value) {
    return String(value || "marker").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function createGridCell(index) {
    const cell = document.createElement("span");
    cell.className = "map-blockout-grid-cell";
    cell.dataset.gridX = String(index % MAP_NODE_GRID.columns);
    cell.dataset.gridY = String(Math.floor(index / MAP_NODE_GRID.columns));
    return cell;
}

function waitForTransition() {
    return new Promise(resolve => {
        if (transitionTimer !== null) clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => {
            transitionTimer = null;
            resolve();
        }, TRANSITION_MS);
    });
}

function setFading(fading) {
    elements?.canvas?.classList.toggle("is-fading", fading);
    if (elements?.screen) elements.screen.dataset.movementLocked = fading ? "true" : "false";
}

function createMarker(groupId, definition) {
    const marker = document.createElement(groupId === "warps" ? "button" : "article");
    marker.className = `map-blockout-object map-blockout-group-${safeClassToken(groupId)} map-blockout-type-${safeClassToken(definition.type)}`;
    marker.dataset.mapObjectId = definition.id;
    marker.dataset.mapGroup = groupId;
    marker.style.setProperty("--blockout-left", `${definition.x * MAP_NODE_GRID.cellSize}px`);
    marker.style.setProperty("--blockout-top", `${definition.y * MAP_NODE_GRID.cellSize}px`);
    marker.style.setProperty("--blockout-width", `${definition.width * MAP_NODE_GRID.cellSize}px`);
    marker.style.setProperty("--blockout-height", `${definition.height * MAP_NODE_GRID.cellSize}px`);

    const label = document.createElement("span");
    label.className = "map-blockout-object-label";
    label.textContent = `[${definition.label}]`;
    marker.appendChild(label);

    if (groupId === "warps") {
        marker.type = "button";
        marker.disabled = definition.active === false;
        marker.setAttribute("aria-label", definition.active === false
            ? `${definition.label}, reserved for a future area`
            : `${definition.label}, preview map transition`);
        marker.addEventListener("click", () => previewWarp(definition.id));
        marker.addEventListener("pointerleave", () => mapNodeManager.releaseArrivalGuard(definition.id));
    }
    return marker;
}

function createNodeTab(nodeId) {
    const node = getMapNode(nodeId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-blockout-node-tab";
    button.dataset.mapNodeId = node.id;
    button.textContent = node.shortName;
    button.setAttribute("aria-pressed", node.id === mapNodeManager.currentMapId ? "true" : "false");
    button.addEventListener("click", () => selectMapNode(node.id));
    return button;
}

function renderMapNode(node = mapNodeManager.getCurrentNode()) {
    if (!node || !elements?.canvas || !elements.grid) return false;
    const width = MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize;
    const height = MAP_NODE_GRID.rows * MAP_NODE_GRID.cellSize;
    elements.canvas.style.width = `${width}px`;
    elements.canvas.style.height = `${height}px`;
    elements.canvas.style.setProperty("--blockout-cell-size", `${MAP_NODE_GRID.cellSize}px`);
    elements.canvas.style.setProperty("--blockout-columns", String(MAP_NODE_GRID.columns));
    elements.canvas.style.setProperty("--blockout-rows", String(MAP_NODE_GRID.rows));
    elements.canvas.dataset.mapNodeId = node.id;

    for (const groupId of MAP_NODE_LAYER_ORDER) {
        const layer = elements.layers[groupId];
        if (!layer) continue;
        layer.replaceChildren(...node.groups[groupId].map(definition => createMarker(groupId, definition)));
    }

    const cellCount = MAP_NODE_GRID.columns * MAP_NODE_GRID.rows;
    elements.grid.replaceChildren(...Array.from({ length: cellCount }, (_, index) => createGridCell(index)));
    if (elements.title) elements.title.textContent = node.name;
    if (elements.role) elements.role.textContent = node.role;
    if (elements.spawn) elements.spawn.textContent = `[CURRENT SPAWN: ${mapNodeManager.currentSpawnId}]`;
    if (elements.tabs) elements.tabs.replaceChildren(...MAP_NODE_IDS.map(createNodeTab));
    return true;
}

function selectMapNode(nodeId, spawnId = null) {
    if (mapNodeManager.movementLocked || !mapNodeManager.load(nodeId, spawnId)) return false;
    return renderMapNode();
}

async function previewWarp(warpId) {
    return mapNodeManager.transitionThrough(warpId, {
        fadeOut: async () => {
            setFading(true);
            await waitForTransition();
        },
        load: async node => {
            renderMapNode(node);
            elements.viewport.scrollTop = 0;
            elements.viewport.scrollLeft = Math.max(0, ((MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize) - (Number(elements.viewport.clientWidth) || 0)) / 2);
        },
        fadeIn: async () => {
            setFading(false);
            await waitForTransition();
        }
    });
}

export const MapBlockoutScene = {
    enter() {
        elements = getElements();
        if (!elements.screen || !elements.viewport || !elements.canvas || !elements.grid) return false;
        renderMapNode();
        elements.screen.hidden = false;
        elements.viewport.scrollTop = 0;
        const canvasWidth = Number(elements.canvas.offsetWidth) || MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize;
        const viewportWidth = Number(elements.viewport.clientWidth) || 0;
        elements.viewport.scrollLeft = Math.max(0, (canvasWidth - viewportWidth) / 2);
        elements.viewport.focus?.({ preventScroll: true });
        return true;
    },

    exit() {
        if (transitionTimer !== null) clearTimeout(transitionTimer);
        transitionTimer = null;
        setFading(false);
        if (elements?.screen) elements.screen.hidden = true;
        return true;
    },

    renderMapNode,
    selectMapNode,
    previewWarp,
    getCurrentMapNodeId: () => mapNodeManager.currentMapId
};

export { MAP_NODE_GRID, MAP_NODE_LAYER_ORDER, mapNodeManager };
