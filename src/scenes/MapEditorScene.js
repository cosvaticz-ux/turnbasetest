import { MAP_NODE_GRID } from "../data/maps/mapNodeSchema.js";
import { getMapNode, MAP_NODE_IDS } from "../data/maps/mapNodeRegistry.js";
import {
    MAP_EDITOR_ASSET_CATALOG,
    MAP_EDITOR_GROUND_CATALOG,
    getEditorAssetDefinition,
    getEditorGroundDefinition
} from "../data/maps/mapEditorAssets.js";

const WORLD_WIDTH = MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize;
const WORLD_HEIGHT = MAP_NODE_GRID.rows * MAP_NODE_GRID.cellSize;
const PAINT_CELL_SIZE = 32;
const STORAGE_PREFIX = "litania-map-editor:v1:";
const HISTORY_LIMIT = 40;

let elements = null;
let active = false;
let activeTool = "select";
let selectedAssetId = MAP_EDITOR_ASSET_CATALOG[0]?.id || null;
let selectedGroundId = "dirt";
let selectedInstanceId = null;
let mapId = "town-south";
let state = null;
let pointerSession = null;
let mockupObjectUrl = null;
let instanceCounter = 0;
let undoStack = [];
let redoStack = [];
let spacePanActive = false;
let zoomSaveTimer = null;
const groundNodes = new Map();
const visibleAnchorCache = new Map();

function getElements() {
    return {
        screen: document.getElementById("map-editor-screen"),
        viewport: document.getElementById("map-editor-viewport"),
        shell: document.getElementById("map-editor-canvas-shell"),
        canvas: document.getElementById("map-editor-canvas"),
        baseLayer: document.getElementById("map-editor-base-layer"),
        groundLayer: document.getElementById("map-editor-ground-layer"),
        mockup: document.getElementById("map-editor-mockup"),
        guideLayer: document.getElementById("map-editor-guide-layer"),
        assetLayer: document.getElementById("map-editor-asset-layer"),
        gridLayer: document.getElementById("map-editor-grid-layer"),
        mapSelect: document.getElementById("map-editor-map-select"),
        baseGroundSelect: document.getElementById("map-editor-base-ground"),
        assetPalette: document.getElementById("map-editor-asset-palette"),
        groundPalette: document.getElementById("map-editor-ground-palette"),
        status: document.getElementById("map-editor-status"),
        snapToggle: document.getElementById("map-editor-snap-toggle"),
        snapSize: document.getElementById("map-editor-snap-size"),
        gridToggle: document.getElementById("map-editor-grid-toggle"),
        guidesToggle: document.getElementById("map-editor-guides-toggle"),
        mockupToggle: document.getElementById("map-editor-mockup-toggle"),
        mockupFile: document.getElementById("map-editor-mockup-file"),
        mockupOpacity: document.getElementById("map-editor-mockup-opacity"),
        zoom: document.getElementById("map-editor-zoom"),
        exportButton: document.getElementById("map-editor-export"),
        copyButton: document.getElementById("map-editor-copy"),
        importButton: document.getElementById("map-editor-import-button"),
        importFile: document.getElementById("map-editor-import-file"),
        clearButton: document.getElementById("map-editor-clear"),
        undoButton: document.getElementById("map-editor-undo"),
        redoButton: document.getElementById("map-editor-redo"),
        toolButtons: Array.from(document.querySelectorAll("[data-map-editor-tool]")),
        inspectorEmpty: document.getElementById("map-editor-inspector-empty"),
        inspectorFields: document.getElementById("map-editor-inspector-fields"),
        inspectorName: document.getElementById("map-editor-selected-name"),
        inspectorX: document.getElementById("map-editor-selected-x"),
        inspectorY: document.getElementById("map-editor-selected-y"),
        inspectorScale: document.getElementById("map-editor-selected-scale"),
        inspectorScaleValue: document.getElementById("map-editor-selected-scale-value"),
        inspectorRotation: document.getElementById("map-editor-selected-rotation"),
        inspectorOrientationButtons: Array.from(document.querySelectorAll("[data-map-editor-orientation]")),
        inspectorFlip: document.getElementById("map-editor-selected-flip"),
        inspectorDuplicate: document.getElementById("map-editor-selected-duplicate"),
        inspectorDelete: document.getElementById("map-editor-selected-delete")
    };
}

function createDefaultState(targetMapId) {
    return {
        version: 1,
        mapId: targetMapId,
        baseGround: targetMapId.startsWith("town-") ? "dirt" : "grass",
        snapEnabled: true,
        snapSize: 16,
        gridVisible: true,
        guidesVisible: true,
        mockupVisible: true,
        mockupOpacity: 0.38,
        zoom: 0.75,
        ground: {},
        assets: []
    };
}

function storageKey(targetMapId = mapId) {
    return `${STORAGE_PREFIX}${targetMapId}`;
}

function normalizeState(candidate, targetMapId) {
    const fallback = createDefaultState(targetMapId);
    if (!candidate || typeof candidate !== "object") return fallback;
    return {
        ...fallback,
        ...candidate,
        mapId: targetMapId,
        ground: candidate.ground && typeof candidate.ground === "object" ? { ...candidate.ground } : {},
        assets: Array.isArray(candidate.assets)
            ? candidate.assets
                .filter(item => item && getEditorAssetDefinition(item.assetId))
                .map(item => ({
                    id: String(item.id || createInstanceId(item.assetId)),
                    assetId: item.assetId,
                    x: Number(item.x) || 0,
                    y: Number(item.y) || 0,
                    scale: Math.max(0.05, Number(item.scale) || 0.5),
                    flip: Number(item.flip) === -1 ? -1 : 1,
                    rotation: Number(item.rotation) || 0
                }))
            : []
    };
}

function loadSavedState(targetMapId) {
    try {
        const raw = globalThis.localStorage?.getItem(storageKey(targetMapId));
        if (!raw) return createDefaultState(targetMapId);
        return normalizeState(JSON.parse(raw), targetMapId);
    } catch (error) {
        console.warn("[MapEditor] Could not load local draft:", error);
        return createDefaultState(targetMapId);
    }
}

function saveState(message = "Draft saved locally") {
    try {
        globalThis.localStorage?.setItem(storageKey(), JSON.stringify(state));
        setStatus(message);
    } catch (error) {
        console.warn("[MapEditor] Could not save local draft:", error);
        setStatus("Local save failed");
    }
    updateHistoryButtons();
}

function snapshot() {
    return JSON.stringify(state);
}

function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
}

function restoreSnapshot(serialized) {
    state = normalizeState(JSON.parse(serialized), mapId);
    selectedInstanceId = null;
    renderAll();
    saveState("History restored");
}

function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshot());
    restoreSnapshot(undoStack.pop());
    return true;
}

function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshot());
    restoreSnapshot(redoStack.pop());
    return true;
}

function updateHistoryButtons() {
    if (elements?.undoButton) elements.undoButton.disabled = undoStack.length === 0;
    if (elements?.redoButton) elements.redoButton.disabled = redoStack.length === 0;
}

function setStatus(message) {
    if (elements?.status) elements.status.textContent = message || "";
}

function createInstanceId(assetId) {
    instanceCounter += 1;
    return `${assetId}-${Date.now().toString(36)}-${instanceCounter}`;
}

function snapValue(value) {
    if (!state.snapEnabled) return Math.round(value);
    const size = Math.max(1, Number(state.snapSize) || 16);
    return Math.round(value / size) * size;
}

function clampToWorld(value, axis) {
    return Math.max(0, Math.min(axis === "x" ? WORLD_WIDTH : WORLD_HEIGHT, value));
}

function canvasPoint(event) {
    const rect = elements.canvas.getBoundingClientRect();
    const zoom = Math.max(0.1, Number(state.zoom) || 1);
    return {
        x: clampToWorld((event.clientX - rect.left) / zoom, "x"),
        y: clampToWorld((event.clientY - rect.top) / zoom, "y")
    };
}

function setTool(tool) {
    activeTool = tool;
    elements.toolButtons.forEach(button => {
        const selected = button.dataset.mapEditorTool === tool;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    elements.canvas.dataset.activeTool = tool;
    setStatus(tool === "select"
        ? "Select: drag placed assets"
        : tool === "paint"
            ? "Paint: drag across the map"
            : tool === "asset"
                ? "Asset: click the map to place"
                : "Eraser: drag ground or click an asset");
}

function renderMapOptions() {
    elements.mapSelect.replaceChildren(...MAP_NODE_IDS.map(id => {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = getMapNode(id)?.name || id;
        return option;
    }));
    elements.mapSelect.value = mapId;

    const baseOptions = MAP_EDITOR_GROUND_CATALOG
        .filter(item => item.category === "ground")
        .map(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.label;
            return option;
        });
    elements.baseGroundSelect.replaceChildren(...baseOptions);
    elements.baseGroundSelect.value = state.baseGround;
}

function createPaletteButton(item, type) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-editor-palette-item";
    button.dataset.catalogType = type;
    button.dataset.catalogId = item.id;

    const preview = document.createElement("span");
    preview.className = "map-editor-palette-preview";
    preview.style.backgroundImage = `url("${item.asset}")`;

    const label = document.createElement("span");
    label.textContent = item.label;
    button.append(preview, label);

    button.addEventListener("click", () => {
        if (type === "asset") {
            selectedAssetId = item.id;
            setTool("asset");
        } else {
            selectedGroundId = item.id;
            setTool("paint");
        }
        updatePaletteSelection();
    });
    return button;
}

function renderPalettes() {
    elements.assetPalette.replaceChildren(
        ...MAP_EDITOR_ASSET_CATALOG.map(item => createPaletteButton(item, "asset"))
    );
    elements.groundPalette.replaceChildren(
        ...MAP_EDITOR_GROUND_CATALOG.map(item => createPaletteButton(item, "ground"))
    );
    updatePaletteSelection();
}

function updatePaletteSelection() {
    for (const button of document.querySelectorAll(".map-editor-palette-item")) {
        const activeId = button.dataset.catalogType === "asset" ? selectedAssetId : selectedGroundId;
        button.classList.toggle("is-selected", button.dataset.catalogId === activeId);
    }
}

function setZoom(value) {
    state.zoom = Math.max(0.25, Math.min(2, Number(value) || 0.75));
    elements.canvas.style.transform = `scale(${state.zoom})`;
    elements.shell.style.width = `${WORLD_WIDTH * state.zoom}px`;
    elements.shell.style.height = `${WORLD_HEIGHT * state.zoom}px`;
    if (elements.zoom) elements.zoom.value = String(state.zoom);
}

function scheduleViewSave() {
    if (zoomSaveTimer !== null) clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(() => {
        zoomSaveTimer = null;
        saveState(`Zoom ${Math.round(state.zoom * 100)}%`);
    }, 140);
}

function zoomAtPointer(event) {
    if (!active || !elements?.viewport || !elements?.shell) return false;
    event.preventDefault();

    const oldZoom = Math.max(0.25, Number(state.zoom) || 0.75);
    const zoomFactor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(0.25, Math.min(2, oldZoom * zoomFactor));
    if (Math.abs(nextZoom - oldZoom) < 0.001) return false;

    const oldShellRect = elements.shell.getBoundingClientRect();
    const worldX = (event.clientX - oldShellRect.left) / oldZoom;
    const worldY = (event.clientY - oldShellRect.top) / oldZoom;

    setZoom(nextZoom);

    const newShellRect = elements.shell.getBoundingClientRect();
    const nextClientX = newShellRect.left + worldX * nextZoom;
    const nextClientY = newShellRect.top + worldY * nextZoom;
    elements.viewport.scrollLeft += nextClientX - event.clientX;
    elements.viewport.scrollTop += nextClientY - event.clientY;

    scheduleViewSave();
    return true;
}

function beginViewportPan(event) {
    const middleMouse = event.button === 1;
    const spaceDrag = spacePanActive && event.button === 0;
    if (!active || (!middleMouse && !spaceDrag)) return false;

    event.preventDefault();
    pointerSession = {
        type: "pan",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: elements.viewport.scrollLeft,
        startScrollTop: elements.viewport.scrollTop
    };
    elements.viewport.classList.add("is-panning");
    elements.viewport.setPointerCapture?.(event.pointerId);
    setStatus("Pan: drag to move around the map");
    return true;
}

function updateViewportPan(event) {
    if (pointerSession?.type !== "pan" || pointerSession.pointerId !== event.pointerId) return false;
    event.preventDefault();
    elements.viewport.scrollLeft = pointerSession.startScrollLeft - (event.clientX - pointerSession.startClientX);
    elements.viewport.scrollTop = pointerSession.startScrollTop - (event.clientY - pointerSession.startClientY);
    return true;
}

function endViewportPan(event) {
    if (pointerSession?.type !== "pan" || pointerSession.pointerId !== event.pointerId) return false;
    pointerSession = null;
    elements.viewport.classList.remove("is-panning");
    elements.viewport.releasePointerCapture?.(event.pointerId);
    setStatus("Pan complete · Mouse wheel zooms");
    return true;
}

function updateCanvasSettings() {
    const base = getEditorGroundDefinition(state.baseGround) || getEditorGroundDefinition("grass");
    elements.baseLayer.style.backgroundImage = base ? `url("${base.asset}")` : "none";
    elements.gridLayer.hidden = !state.gridVisible;
    elements.guideLayer.hidden = !state.guidesVisible;
    elements.mockup.hidden = !state.mockupVisible || !elements.mockup.src;
    elements.mockup.style.opacity = String(state.mockupOpacity);
    elements.snapToggle.checked = state.snapEnabled;
    elements.snapSize.value = String(state.snapSize);
    elements.gridToggle.checked = state.gridVisible;
    elements.guidesToggle.checked = state.guidesVisible;
    elements.mockupToggle.checked = state.mockupVisible;
    elements.mockupOpacity.value = String(state.mockupOpacity);
    elements.baseGroundSelect.value = state.baseGround;
    setZoom(state.zoom);
}

function groundKey(column, row) {
    return `${column},${row}`;
}

function groundCellFromPoint(point) {
    return {
        column: Math.max(0, Math.min(Math.floor(WORLD_WIDTH / PAINT_CELL_SIZE) - 1, Math.floor(point.x / PAINT_CELL_SIZE))),
        row: Math.max(0, Math.min(Math.floor(WORLD_HEIGHT / PAINT_CELL_SIZE) - 1, Math.floor(point.y / PAINT_CELL_SIZE)))
    };
}

function createGroundNode(key, groundId) {
    const definition = getEditorGroundDefinition(groundId);
    if (!definition) return null;
    const [column, row] = key.split(",").map(Number);
    const node = document.createElement("div");
    node.className = `map-editor-ground-cell map-editor-ground-${definition.category}`;
    node.dataset.groundKey = key;
    node.dataset.groundId = groundId;
    node.style.left = `${column * PAINT_CELL_SIZE}px`;
    node.style.top = `${row * PAINT_CELL_SIZE}px`;
    node.style.width = `${PAINT_CELL_SIZE}px`;
    node.style.height = `${PAINT_CELL_SIZE}px`;
    node.style.backgroundImage = `url("${definition.asset}")`;
    return node;
}

function renderGround() {
    groundNodes.clear();
    const nodes = [];
    for (const [key, groundId] of Object.entries(state.ground)) {
        const node = createGroundNode(key, groundId);
        if (!node) continue;
        nodes.push(node);
        groundNodes.set(key, node);
    }
    elements.groundLayer.replaceChildren(...nodes);
}

function updateGroundCell(key) {
    groundNodes.get(key)?.remove();
    groundNodes.delete(key);
    const groundId = state.ground[key];
    if (!groundId) return;
    const node = createGroundNode(key, groundId);
    if (!node) return;
    groundNodes.set(key, node);
    elements.groundLayer.appendChild(node);
}

function paintGroundAt(point, erase = false) {
    const { column, row } = groundCellFromPoint(point);
    const key = groundKey(column, row);
    if (erase) {
        if (!state.ground[key]) return false;
        delete state.ground[key];
        updateGroundCell(key);
        return true;
    }
    if (state.ground[key] === selectedGroundId) return false;
    state.ground[key] = selectedGroundId;
    updateGroundCell(key);
    return true;
}

function createGuide(definition, kind) {
    const node = document.createElement("div");
    node.className = `map-editor-guide map-editor-guide-${kind}`;
    node.style.left = `${definition.x * MAP_NODE_GRID.cellSize}px`;
    node.style.top = `${definition.y * MAP_NODE_GRID.cellSize}px`;
    node.style.width = `${definition.width * MAP_NODE_GRID.cellSize}px`;
    node.style.height = `${definition.height * MAP_NODE_GRID.cellSize}px`;
    node.title = definition.label || definition.id;

    const label = document.createElement("span");
    label.textContent = definition.label || definition.id;
    node.appendChild(label);
    return node;
}

function renderGuides() {
    const mapNode = getMapNode(mapId);
    if (!mapNode) return;
    const nodes = [
        ...mapNode.groups.zones
            .filter(item => item.type === "blocked")
            .map(item => createGuide(item, "blocked")),
        ...mapNode.groups.footprints.map(item => createGuide(item, "footprint")),
        ...mapNode.groups.spawns.map(item => createGuide(item, "spawn")),
        ...mapNode.groups.warps.map(item => createGuide(item, item.active === false ? "warp-reserved" : "warp"))
    ];
    elements.guideLayer.replaceChildren(...nodes);
}

function findAssetInstance(instanceId) {
    return state.assets.find(item => item.id === instanceId) || null;
}

function getAssetTransform(instance, definition) {
    const anchorTranslate = definition?.category === "Edge"
        ? "translate(-50%, -50%)"
        : "translate(-50%, -100%)";
    return `${anchorTranslate} rotate(${instance.rotation || 0}deg) scale(${instance.scale}) scaleX(${instance.flip})`;
}

function detectVisibleAnchor(image, definition) {
    if (!image?.naturalWidth || !image?.naturalHeight) return null;

    const cacheKey = definition?.asset || image.currentSrc || image.src;
    if (visibleAnchorCache.has(cacheKey)) return visibleAnchorCache.get(cacheKey);

    try {
        const maxSample = 256;
        const scale = Math.min(1, maxSample / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return null;

        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const alpha = pixels[((y * width) + x) * 4 + 3];
                if (alpha < 24) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < minX || maxY < minY) return null;

        const isEdge = definition?.category === "Edge";
        const sampleX = (minX + maxX) / 2;
        const sampleY = isEdge
            ? (minY + maxY) / 2
            : Math.max(minY, maxY - Math.min(4, Math.max(1, Math.round((maxY - minY) * 0.04))));

        const detected = {
            x: sampleX / width,
            y: sampleY / height
        };
        visibleAnchorCache.set(cacheKey, detected);
        return detected;
    } catch (error) {
        console.warn("[MapEditor] Visible asset bounds unavailable:", definition?.id, error);
        return null;
    }
}

function positionSelectionHandle(anchor, instance, definition, image) {
    if (!anchor || !image?.naturalWidth || !image?.naturalHeight) return false;

    const visibleAnchor = detectVisibleAnchor(image, definition);
    if (!visibleAnchor) {
        anchor.style.opacity = "0";
        anchor.closest(".map-editor-asset")?.classList.remove("has-visual-anchor");
        return false;
    }

    const isEdge = definition?.category === "Edge";
    const originX = image.naturalWidth * 0.5;
    const originY = image.naturalHeight * (isEdge ? 0.5 : 1);
    const targetX = image.naturalWidth * visibleAnchor.x;
    const targetY = image.naturalHeight * visibleAnchor.y;

    const scale = Number(instance.scale) || 1;
    const flip = Number(instance.flip) === -1 ? -1 : 1;
    const rotation = (Number(instance.rotation) || 0) * (Math.PI / 180);
    const localX = (targetX - originX) * scale * flip;
    const localY = (targetY - originY) * scale;
    const rotatedX = (localX * Math.cos(rotation)) - (localY * Math.sin(rotation));
    const rotatedY = (localX * Math.sin(rotation)) + (localY * Math.cos(rotation));

    anchor.style.transform = `translate(${rotatedX}px, ${rotatedY}px)`;
    anchor.style.opacity = "";
    anchor.closest(".map-editor-asset")?.classList.add("has-visual-anchor");
    return true;
}

function createAssetNode(instance) {
    const definition = getEditorAssetDefinition(instance.assetId);
    if (!definition) return null;

    const node = document.createElement("div");
    node.className = "map-editor-asset";
    node.classList.toggle("is-center-anchored", definition.category === "Edge");
    node.dataset.assetCategory = definition.category || "Other";
    node.dataset.instanceId = instance.id;
    node.style.left = `${instance.x}px`;
    node.style.top = `${instance.y}px`;
    node.style.zIndex = String(Math.round(instance.y));

    const image = document.createElement("img");
    image.src = definition.asset;
    image.alt = definition.label;
    image.draggable = false;
    image.style.transform = getAssetTransform(instance, definition);

    const anchor = document.createElement("span");
    anchor.className = "map-editor-foot-anchor";
    anchor.setAttribute("aria-hidden", "true");

    const syncSelectionHandle = () => positionSelectionHandle(anchor, instance, definition, image);
    image.addEventListener("load", syncSelectionHandle, { once: true });
    if (image.complete && image.naturalWidth) queueMicrotask(syncSelectionHandle);

    node.append(image, anchor);
    node.classList.toggle("is-selected", instance.id === selectedInstanceId);
    node.addEventListener("pointerdown", event => beginAssetPointer(event, instance.id));
    return node;
}

function renderAssets() {
    elements.assetLayer.replaceChildren(
        ...state.assets.map(createAssetNode).filter(Boolean)
    );
    renderInspector();
}

function updateAssetNode(instance) {
    const node = elements.assetLayer.querySelector(`[data-instance-id="${CSS.escape(instance.id)}"]`);
    if (!node) {
        renderAssets();
        return;
    }
    node.style.left = `${instance.x}px`;
    node.style.top = `${instance.y}px`;
    node.style.zIndex = String(Math.round(instance.y));
    const image = node.querySelector("img");
    const anchor = node.querySelector(".map-editor-foot-anchor");
    const definition = getEditorAssetDefinition(instance.assetId);
    if (image) {
        image.style.transform = getAssetTransform(instance, definition);
        positionSelectionHandle(anchor, instance, definition, image);
    }
}

function selectInstance(instanceId) {
    selectedInstanceId = instanceId;
    for (const node of elements.assetLayer.querySelectorAll(".map-editor-asset")) {
        node.classList.toggle("is-selected", node.dataset.instanceId === instanceId);
    }
    renderInspector();
}

function placeAsset(point) {
    const definition = getEditorAssetDefinition(selectedAssetId);
    if (!definition) return false;
    pushHistory();
    const instance = {
        id: createInstanceId(definition.id),
        assetId: definition.id,
        x: snapValue(point.x),
        y: snapValue(point.y),
        scale: definition.defaultScale || 0.5,
        flip: 1,
        rotation: 0
    };
    state.assets.push(instance);
    selectInstance(instance.id);
    renderAssets();
    saveState(`${definition.label} placed`);
    return true;
}

function deleteSelected() {
    if (!selectedInstanceId) return false;
    const index = state.assets.findIndex(item => item.id === selectedInstanceId);
    if (index < 0) return false;
    pushHistory();
    state.assets.splice(index, 1);
    selectedInstanceId = null;
    renderAssets();
    saveState("Asset deleted");
    return true;
}

function duplicateSelected() {
    const source = findAssetInstance(selectedInstanceId);
    if (!source) return false;
    pushHistory();
    const copy = {
        ...source,
        id: createInstanceId(source.assetId),
        x: clampToWorld(source.x + state.snapSize * 2, "x"),
        y: clampToWorld(source.y + state.snapSize * 2, "y")
    };
    state.assets.push(copy);
    selectedInstanceId = copy.id;
    renderAssets();
    saveState("Asset duplicated");
    return true;
}

function flipSelected() {
    const instance = findAssetInstance(selectedInstanceId);
    if (!instance) return false;
    pushHistory();
    instance.flip = instance.flip === -1 ? 1 : -1;
    updateAssetNode(instance);
    renderInspector();
    saveState("Asset flipped");
    return true;
}

function beginAssetPointer(event, instanceId) {
    if (event.button === 1 || (spacePanActive && event.button === 0)) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    if (activeTool === "eraser") {
        selectInstance(instanceId);
        deleteSelected();
        return;
    }

    /*
     * Direct manipulation:
     * clicking an existing object always selects it and starts a mouse drag,
     * regardless of whether Paint or Asset was the previously active tool.
     * This keeps object movement feeling like a normal visual editor instead
     * of requiring the user to switch back to Select first.
     */
    if (activeTool !== "select") setTool("select");
    selectInstance(instanceId);

    const instance = findAssetInstance(instanceId);
    if (!instance) return;
    pushHistory();
    pointerSession = {
        type: "asset-drag",
        pointerId: event.pointerId,
        instanceId,
        startPoint: canvasPoint(event),
        startX: instance.x,
        startY: instance.y,
        moved: false
    };
    elements.canvas.classList.add("is-dragging-object");
    elements.canvas.setPointerCapture?.(event.pointerId);
}

function handleCanvasPointerDown(event) {
    if (!active || event.button !== 0) return;
    if (spacePanActive) return;
    if (event.target.closest?.(".map-editor-asset")) return;

    const point = canvasPoint(event);
    if (activeTool === "asset") {
        placeAsset(point);
        return;
    }

    if (activeTool === "select") {
        selectInstance(null);
        return;
    }

    if (activeTool === "paint" || activeTool === "eraser") {
        pushHistory();
        const changed = paintGroundAt(point, activeTool === "eraser");
        pointerSession = {
            type: "paint",
            pointerId: event.pointerId,
            erase: activeTool === "eraser",
            changed
        };
        elements.canvas.setPointerCapture?.(event.pointerId);
    }
}

function handleCanvasPointerMove(event) {
    if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
    if (pointerSession.type === "paint") {
        const changed = paintGroundAt(canvasPoint(event), pointerSession.erase);
        pointerSession.changed = pointerSession.changed || changed;
        return;
    }

    if (pointerSession.type === "asset-drag") {
        const instance = findAssetInstance(pointerSession.instanceId);
        if (!instance) return;
        const point = canvasPoint(event);
        const dx = point.x - pointerSession.startPoint.x;
        const dy = point.y - pointerSession.startPoint.y;
        instance.x = clampToWorld(snapValue(pointerSession.startX + dx), "x");
        instance.y = clampToWorld(snapValue(pointerSession.startY + dy), "y");
        pointerSession.moved = pointerSession.moved
            || Math.abs(dx) > 1
            || Math.abs(dy) > 1;
        updateAssetNode(instance);
        renderInspector();
    }
}

function handleCanvasPointerUp(event) {
    if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
    const session = pointerSession;
    pointerSession = null;
    elements.canvas.releasePointerCapture?.(event.pointerId);
    elements.canvas.classList.remove("is-dragging-object");

    if (session.type === "paint") {
        if (session.changed) saveState(session.erase ? "Ground erased" : "Ground painted");
        else undoStack.pop();
    } else if (session.type === "asset-drag") {
        if (session.moved) saveState("Asset moved");
        else {
            undoStack.pop();
            setStatus("Object selected · Hold left mouse and drag to move");
        }
    }
    updateHistoryButtons();
}

function renderInspector() {
    const instance = findAssetInstance(selectedInstanceId);
    elements.inspectorEmpty.hidden = Boolean(instance);
    elements.inspectorFields.hidden = !instance;
    if (!instance) return;

    const definition = getEditorAssetDefinition(instance.assetId);
    elements.inspectorName.textContent = definition?.label || instance.assetId;
    elements.inspectorX.value = String(Math.round(instance.x));
    elements.inspectorY.value = String(Math.round(instance.y));
    elements.inspectorScale.value = String(instance.scale);
    elements.inspectorScaleValue.textContent = `${Math.round(instance.scale * 100)}%`;
    elements.inspectorRotation.value = String(instance.rotation || 0);
    const cardinalRotation = ((Math.round((Number(instance.rotation) || 0) / 90) * 90) % 360 + 360) % 360;
    elements.inspectorOrientationButtons.forEach(button => {
        button.classList.toggle("is-active", Number(button.dataset.mapEditorOrientation) === cardinalRotation);
    });
}

function applyInspectorValue(property, rawValue) {
    const instance = findAssetInstance(selectedInstanceId);
    if (!instance) return;
    pushHistory();
    if (property === "x" || property === "y") {
        instance[property] = clampToWorld(snapValue(Number(rawValue) || 0), property);
    } else if (property === "scale") {
        instance.scale = Math.max(0.05, Math.min(2, Number(rawValue) || 0.5));
    } else if (property === "rotation") {
        instance.rotation = Math.max(-180, Math.min(180, Number(rawValue) || 0));
    }
    updateAssetNode(instance);
    renderInspector();
    saveState("Asset adjusted");
}

function setSelectedOrientation(rawDegrees) {
    const instance = findAssetInstance(selectedInstanceId);
    if (!instance) return false;
    const degrees = ((Number(rawDegrees) || 0) % 360 + 360) % 360;
    const cardinal = [0, 90, 180, 270].includes(degrees) ? degrees : 0;
    pushHistory();
    instance.rotation = cardinal === 270 ? -90 : cardinal;
    updateAssetNode(instance);
    renderInspector();
    saveState(`Object direction set to ${cardinal}°`);
    return true;
}

function buildExportData() {
    const groundCells = Object.entries(state.ground).map(([key, groundId]) => {
        const [column, row] = key.split(",").map(Number);
        return { column, row, x: column * PAINT_CELL_SIZE, y: row * PAINT_CELL_SIZE, groundId };
    });
    return {
        editorVersion: 1,
        mapId,
        dimensions: {
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            gameplayCellSize: MAP_NODE_GRID.cellSize,
            paintCellSize: PAINT_CELL_SIZE
        },
        baseGround: state.baseGround,
        groundCells,
        assets: state.assets.map(item => ({ ...item }))
    };
}

function exportJson() {
    const data = JSON.stringify(buildExportData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${mapId}-visual-layout.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("JSON exported");
}

async function copyJson() {
    const data = JSON.stringify(buildExportData(), null, 2);
    try {
        await navigator.clipboard.writeText(data);
        setStatus("JSON copied to clipboard");
    } catch {
        setStatus("Clipboard unavailable — use Export JSON");
    }
}

function importEditorData(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid editor JSON");
    const imported = createDefaultState(mapId);
    imported.baseGround = getEditorGroundDefinition(data.baseGround) ? data.baseGround : imported.baseGround;
    imported.assets = Array.isArray(data.assets) ? data.assets : [];

    if (Array.isArray(data.groundCells)) {
        imported.ground = Object.fromEntries(data.groundCells
            .filter(cell => getEditorGroundDefinition(cell.groundId))
            .map(cell => [groundKey(Number(cell.column) || 0, Number(cell.row) || 0), cell.groundId]));
    } else if (data.ground && typeof data.ground === "object") {
        imported.ground = { ...data.ground };
    }

    pushHistory();
    state = normalizeState(imported, mapId);
    selectedInstanceId = null;
    renderAll();
    saveState("JSON imported");
}

function loadMockupFile(file) {
    if (!file) return;
    if (mockupObjectUrl) URL.revokeObjectURL(mockupObjectUrl);
    mockupObjectUrl = URL.createObjectURL(file);
    elements.mockup.src = mockupObjectUrl;
    state.mockupVisible = true;
    elements.mockupToggle.checked = true;
    elements.mockup.hidden = false;
    setStatus("Mockup overlay loaded");
}

function clearMap() {
    if (!globalThis.confirm?.("Clear all painted ground and placed assets for this editor map?")) return;
    pushHistory();
    state.ground = {};
    state.assets = [];
    selectedInstanceId = null;
    renderGround();
    renderAssets();
    saveState("Editor map cleared");
}

function switchMap(nextMapId) {
    if (!getMapNode(nextMapId) || nextMapId === mapId) return;
    saveState();
    mapId = nextMapId;
    state = loadSavedState(mapId);
    selectedInstanceId = null;
    undoStack = [];
    redoStack = [];
    const params = new URLSearchParams(globalThis.location?.search || "");
    params.set("scene", "map-editor");
    params.set("map", mapId);
    globalThis.history?.replaceState?.({}, "", `?${params.toString()}`);
    renderAll();
    elements.viewport.scrollTop = 0;
    elements.viewport.scrollLeft = 0;
    setStatus(`${getMapNode(mapId)?.name || mapId} loaded`);
}

function renderAll() {
    renderMapOptions();
    renderPalettes();
    updateCanvasSettings();
    renderGround();
    renderGuides();
    renderAssets();
    updateHistoryButtons();
}

function handleKeyDown(event) {
    if (!active) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;

    const key = String(event.key || "").toLowerCase();
    if (key === " ") {
        spacePanActive = true;
        elements?.viewport?.classList.add("is-pan-ready");
        event.preventDefault();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        redo();
        return;
    }
    if (key === "delete" || key === "backspace") {
        if (selectedInstanceId) {
            event.preventDefault();
            deleteSelected();
        }
        return;
    }
    if (key === "escape") {
        selectInstance(null);
        setTool("select");
        return;
    }
    if (key === "v") setTool("select");
    else if (key === "b") setTool("paint");
    else if (key === "a") setTool("asset");
    else if (key === "e") setTool("eraser");
}

function handleKeyUp(event) {
    if (!active) return;
    if (String(event.key || "").toLowerCase() !== " ") return;
    spacePanActive = false;
    elements?.viewport?.classList.remove("is-pan-ready");
    if (pointerSession?.type !== "pan") setStatus("Mouse wheel: zoom · Middle drag or Space+drag: pan");
}

function bindEvents() {
    elements.toolButtons.forEach(button => {
        button.addEventListener("click", () => setTool(button.dataset.mapEditorTool));
    });
    elements.canvas.addEventListener("pointerdown", handleCanvasPointerDown);
    elements.canvas.addEventListener("pointermove", handleCanvasPointerMove);
    elements.canvas.addEventListener("pointerup", handleCanvasPointerUp);
    elements.canvas.addEventListener("pointercancel", handleCanvasPointerUp);
    elements.viewport.addEventListener("wheel", zoomAtPointer, { passive: false });
    elements.viewport.addEventListener("pointerdown", beginViewportPan);
    elements.viewport.addEventListener("pointermove", updateViewportPan);
    elements.viewport.addEventListener("pointerup", endViewportPan);
    elements.viewport.addEventListener("pointercancel", endViewportPan);

    elements.mapSelect.addEventListener("change", event => switchMap(event.target.value));
    elements.baseGroundSelect.addEventListener("change", event => {
        pushHistory();
        state.baseGround = event.target.value;
        updateCanvasSettings();
        saveState("Base ground changed");
    });
    elements.snapToggle.addEventListener("change", event => {
        state.snapEnabled = event.target.checked;
        saveState(state.snapEnabled ? "Snap enabled" : "Free placement enabled");
    });
    elements.snapSize.addEventListener("change", event => {
        state.snapSize = Math.max(1, Math.min(64, Number(event.target.value) || 16));
        event.target.value = String(state.snapSize);
        saveState("Snap size updated");
    });
    elements.gridToggle.addEventListener("change", event => {
        state.gridVisible = event.target.checked;
        updateCanvasSettings();
        saveState("Grid visibility updated");
    });
    elements.guidesToggle.addEventListener("change", event => {
        state.guidesVisible = event.target.checked;
        updateCanvasSettings();
        saveState("Gameplay guides updated");
    });
    elements.mockupToggle.addEventListener("change", event => {
        state.mockupVisible = event.target.checked;
        updateCanvasSettings();
        saveState("Mockup visibility updated");
    });
    elements.mockupFile.addEventListener("change", event => loadMockupFile(event.target.files?.[0]));
    elements.mockupOpacity.addEventListener("input", event => {
        state.mockupOpacity = Math.max(0, Math.min(1, Number(event.target.value) || 0));
        elements.mockup.style.opacity = String(state.mockupOpacity);
    });
    elements.mockupOpacity.addEventListener("change", () => saveState("Mockup opacity updated"));
    elements.zoom.addEventListener("input", event => setZoom(event.target.value));
    elements.zoom.addEventListener("change", () => saveState("Editor zoom updated"));

    elements.exportButton.addEventListener("click", exportJson);
    elements.copyButton.addEventListener("click", copyJson);
    elements.importButton.addEventListener("click", () => elements.importFile.click());
    elements.importFile.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            importEditorData(JSON.parse(await file.text()));
        } catch (error) {
            console.warn("[MapEditor] Import failed:", error);
            setStatus("Import failed: invalid JSON");
        }
        event.target.value = "";
    });
    elements.clearButton.addEventListener("click", clearMap);
    elements.undoButton.addEventListener("click", undo);
    elements.redoButton.addEventListener("click", redo);

    elements.inspectorX.addEventListener("change", event => applyInspectorValue("x", event.target.value));
    elements.inspectorY.addEventListener("change", event => applyInspectorValue("y", event.target.value));
    elements.inspectorScale.addEventListener("input", event => {
        const instance = findAssetInstance(selectedInstanceId);
        if (!instance) return;
        instance.scale = Math.max(0.05, Math.min(2, Number(event.target.value) || 0.5));
        updateAssetNode(instance);
        elements.inspectorScaleValue.textContent = `${Math.round(instance.scale * 100)}%`;
    });
    elements.inspectorScale.addEventListener("change", () => saveState("Asset scale updated"));
    elements.inspectorRotation.addEventListener("change", event => applyInspectorValue("rotation", event.target.value));
    elements.inspectorOrientationButtons.forEach(button => {
        button.addEventListener("click", () => setSelectedOrientation(button.dataset.mapEditorOrientation));
    });
    elements.inspectorFlip.addEventListener("click", flipSelected);
    elements.inspectorDuplicate.addEventListener("click", duplicateSelected);
    elements.inspectorDelete.addEventListener("click", deleteSelected);

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
}

function unbindEvents() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
}

export const MapEditorScene = {
    enter() {
        elements = getElements();
        if (!elements.screen || !elements.canvas || !elements.viewport) return false;

        const params = new URLSearchParams(globalThis.location?.search || "");
        const requestedMapId = params.get("map");
        mapId = getMapNode(requestedMapId) ? requestedMapId : "town-south";
        state = loadSavedState(mapId);
        selectedInstanceId = null;
        undoStack = [];
        redoStack = [];
        active = true;

        elements.canvas.style.width = `${WORLD_WIDTH}px`;
        elements.canvas.style.height = `${WORLD_HEIGHT}px`;
        elements.screen.hidden = false;
        renderAll();
        bindEvents();
        setTool("select");
        setStatus("Map Editor ready · Click and drag any object with left mouse to move it");
        return true;
    },

    exit() {
        if (!active) return true;
        saveState();
        active = false;
        pointerSession = null;
        spacePanActive = false;
        elements?.viewport?.classList.remove("is-panning", "is-pan-ready");
        if (zoomSaveTimer !== null) {
            clearTimeout(zoomSaveTimer);
            zoomSaveTimer = null;
        }
        unbindEvents();
        if (mockupObjectUrl) {
            URL.revokeObjectURL(mockupObjectUrl);
            mockupObjectUrl = null;
        }
        if (elements?.screen) elements.screen.hidden = true;
        return true;
    },

    exportData: buildExportData,
    undo,
    redo
};

export { PAINT_CELL_SIZE };
