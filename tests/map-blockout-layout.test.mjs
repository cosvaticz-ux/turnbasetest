import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MapNodeManager } from "../src/core/MapNodeManager.js";
import { resolveInitialScene } from "../src/core/InitialSceneResolver.js";
import {
    MAP_NODE_GRID,
    MAP_NODE_LAYER_ORDER,
    getMapNodeObjects
} from "../src/data/maps/mapNodeSchema.js";
import {
    getMapNode,
    getMapNodeSpawn,
    MAP_NODE_IDS,
    MAP_NODE_REGISTRY
} from "../src/data/maps/mapNodeRegistry.js";

class MockClassList {
    constructor() { this.values = new Set(); }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const enabled = force ?? !this.values.has(name);
        if (enabled) this.values.add(name);
        else this.values.delete(name);
        return enabled;
    }
}

class MockStyle {
    constructor() { this.values = new Map(); }
    setProperty(name, value) { this.values.set(name, String(value)); }
    getPropertyValue(name) { return this.values.get(name) || ""; }
}

class MockElement {
    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.dataset = {};
        this.style = new MockStyle();
        this.classList = new MockClassList();
        this.attributes = new Map();
        this.listeners = new Map();
        this.hidden = false;
        this.disabled = false;
        this.textContent = "";
        this.scrollTop = 0;
        this.scrollLeft = 0;
        this.clientWidth = 800;
        this.focused = false;
    }
    set className(value) { this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classList.values].join(" "); }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    focus() { this.focused = true; }
    get offsetWidth() { return Number.parseFloat(this.style.width) || 0; }
}

const layerIds = Object.fromEntries(MAP_NODE_LAYER_ORDER.map(groupId => [groupId, `map-blockout-${groupId.replace(/s$/, "")}-layer`]));
const ids = [
    "map-blockout-screen", "map-blockout-viewport", "map-blockout-canvas", "map-blockout-grid",
    "map-blockout-node-tabs", "map-blockout-title", "map-blockout-role", "map-blockout-current-spawn",
    ...Object.values(layerIds)
];
const elements = new Map(ids.map(id => [id, new MockElement("div", id)]));
elements.get("map-blockout-screen").hidden = true;

globalThis.document = {
    createElement: tagName => new MockElement(tagName),
    getElementById: id => elements.get(id) || null
};

const { MapBlockoutScene, mapNodeManager } = await import("../src/scenes/MapBlockoutScene.js");
assert.equal(MapBlockoutScene.enter(), true);
assert.equal(elements.get("map-blockout-screen").hidden, false);
assert.equal(elements.get("map-blockout-viewport").focused, true);
assert.equal(MapBlockoutScene.getCurrentMapNodeId(), "front-forest", "Front Forest is the initial development map");
assert.equal(elements.get("map-blockout-grid").children.length, MAP_NODE_GRID.columns * MAP_NODE_GRID.rows);
assert.equal(elements.get("map-blockout-node-tabs").children.length, 17, "all prototype, local, and campaign map nodes are directly inspectable");
assert.equal(elements.get("map-blockout-canvas").style.width, `${MAP_NODE_GRID.columns * MAP_NODE_GRID.cellSize}px`);
assert.equal(elements.get("map-blockout-canvas").style.height, `${MAP_NODE_GRID.rows * MAP_NODE_GRID.cellSize}px`);
assert.equal(elements.get("map-blockout-current-spawn").textContent, "[CURRENT SPAWN: player-start]");

const playerStartMarker = elements.get("map-blockout-spawn-layer").children.find(marker => marker.dataset.mapObjectId === "player-start");
assert.ok(playerStartMarker, "Front Forest renders the player start marker");
assert.equal(playerStartMarker.children[0].textContent, "[PLAYER_START]");
assert.equal(MapBlockoutScene.selectMapNode("town-south"), true);
assert.equal(elements.get("map-blockout-title").textContent, "Town Part 1 — South District");
assert.ok(elements.get("map-blockout-footprint-layer").children.find(marker => marker.dataset.mapObjectId === "south-guild"));
assert.equal(MapBlockoutScene.selectMapNode("front-forest"), true);

assert.deepEqual(MAP_NODE_IDS, [
    "mountain-start", "mountain-path", "anno-encounter", "pursuit-area",
    "road-foothill", "kalin-village", "kalin-investigation", "ghoul-nest",
    "old-forest-road", "abandoned-farmstead", "woodcutter-camp", "northern-crossroads", "old-graveyard",
    "deep-forest", "front-forest", "town-south", "town-north"
]);
assert.equal(MAP_NODE_GRID.cellSize, 64);
assert.equal(MAP_NODE_GRID.columns, 24);
assert.equal(MAP_NODE_GRID.rows, 20);

for (const nodeId of MAP_NODE_IDS) {
    const node = getMapNode(nodeId);
    assert.ok(node, `${nodeId} is registered`);
    assert.equal(node.grid, MAP_NODE_GRID, `${nodeId} uses the shared grid definition`);
    assert.ok(getMapNodeSpawn(nodeId, node.defaultSpawnId), `${nodeId} has a valid default spawn`);
    assert.ok(node.groups.zones.some(zone => zone.type === "walkable"), `${nodeId} defines walkable space`);
    assert.ok(node.groups.zones.some(zone => zone.type === "blocked"), `${nodeId} defines blocked space`);
    assert.ok(node.groups.paths.length > 0, `${nodeId} defines roads or trails`);
    assert.ok(node.groups.warps.length > 0, `${nodeId} defines a map exit`);

    const objects = getMapNodeObjects(node);
    assert.equal(new Set(objects.map(object => object.id)).size, objects.length, `${nodeId} object IDs are unique`);
    for (const object of objects) {
        assert.ok(object.label, `${nodeId}/${object.id} has readable marker text`);
        assert.ok(Number.isInteger(object.x) && Number.isInteger(object.y), `${nodeId}/${object.id} uses grid coordinates`);
        assert.ok(Number.isInteger(object.width) && object.width > 0, `${nodeId}/${object.id} has valid width`);
        assert.ok(Number.isInteger(object.height) && object.height > 0, `${nodeId}/${object.id} has valid height`);
        assert.ok(object.x >= 0 && object.x + object.width <= MAP_NODE_GRID.columns, `${nodeId}/${object.id} stays inside map width`);
        assert.ok(object.y >= 0 && object.y + object.height <= MAP_NODE_GRID.rows, `${nodeId}/${object.id} stays inside map height`);
    }

    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
    for (const path of node.groups.paths) {
        for (const blockedZone of node.groups.zones.filter(zone => zone.type === "blocked")) {
            assert.equal(overlaps(path, blockedZone), false, `${nodeId}/${path.id} is not covered by ${blockedZone.id}`);
        }
    }

    for (const warp of node.groups.warps.filter(candidate => candidate.active !== false)) {
        assert.ok(warp.y === 0 || warp.y + warp.height === MAP_NODE_GRID.rows || warp.x === 0 || warp.x + warp.width === MAP_NODE_GRID.columns,
            `${nodeId}/${warp.id} occupies a natural map edge`);
        assert.ok(getMapNode(warp.destinationMapId), `${nodeId}/${warp.id} has a registered destination`);
        assert.ok(getMapNodeSpawn(warp.destinationMapId, warp.destinationSpawnId), `${nodeId}/${warp.id} has a corresponding destination spawn`);
    }
}

assert.equal(getMapNode("front-forest").groups.spawns.filter(spawn => spawn.id === "player-start").length, 1);
assert.ok(getMapNode("deep-forest").groups.markers.some(marker => marker.label === "ENCOUNTER_AREA"));
for (const requiredLabel of ["TOWN_GATE", "ADVENTURER_GUILD", "WEAPON_SHOP", "POTION_SHOP", "GENERAL_STORE"]) {
    assert.ok(getMapNode("town-south").groups.footprints.some(marker => marker.label === requiredLabel), `Town Part 1 contains [${requiredLabel}]`);
}
assert.ok(getMapNode("town-north").groups.footprints.some(marker => marker.label === "NORTH_TOWN_GATE"));
assert.ok(getMapNode("town-north").groups.warps.some(warp => warp.label === "WARP_RESERVED: NORTH_ROAD" && warp.active === false));

const adjacency = Object.fromEntries(MAP_NODE_IDS.map(nodeId => [
    nodeId,
    getMapNode(nodeId).groups.warps.filter(warp => warp.active !== false).map(warp => warp.destinationMapId).sort()
]));
assert.deepEqual(adjacency, {
    "mountain-start": ["mountain-path"],
    "mountain-path": ["anno-encounter", "mountain-start"],
    "anno-encounter": ["mountain-path", "pursuit-area"],
    "pursuit-area": ["anno-encounter", "road-foothill"],
    "road-foothill": ["kalin-village", "pursuit-area"],
    "kalin-village": ["kalin-investigation", "road-foothill"],
    "kalin-investigation": ["ghoul-nest", "kalin-village"],
    "ghoul-nest": ["kalin-investigation"],
    "old-forest-road": ["abandoned-farmstead", "front-forest", "woodcutter-camp"],
    "abandoned-farmstead": ["northern-crossroads", "old-forest-road"],
    "woodcutter-camp": ["northern-crossroads", "old-forest-road"],
    "northern-crossroads": ["abandoned-farmstead", "old-graveyard", "woodcutter-camp"],
    "old-graveyard": ["northern-crossroads"],
    "deep-forest": ["front-forest"],
    "front-forest": ["deep-forest", "old-forest-road", "town-south"],
    "town-south": ["front-forest", "town-north"],
    "town-north": ["town-south"]
}, "world flow includes the campaign, local contract topology, and prototype maps");

const manager = new MapNodeManager();
const hookOrder = [];
assert.equal(manager.currentMapId, "front-forest");
assert.equal(manager.currentSpawnId, "player-start");
assert.equal(await manager.transitionThrough("warp-to-town-south", {
    fadeOut: async () => {
        hookOrder.push("fade-out");
        assert.equal(manager.movementLocked, true, "movement locks before fade-out");
    },
    load: async (node, spawn) => hookOrder.push(`load:${node.id}:${spawn.spawnId}`),
    fadeIn: async () => hookOrder.push("fade-in")
}), true);
assert.deepEqual(hookOrder, ["fade-out", "load:town-south:spawn-from-front-forest", "fade-in"]);
assert.equal(manager.currentMapId, "town-south");
assert.equal(manager.currentSpawnId, "spawn-from-front-forest");
assert.equal(manager.facing, "north", "warp preserves the player's incoming facing direction");
assert.equal(manager.movementLocked, false, "movement unlocks after fade-in");
assert.equal(manager.canUseWarp("warp-to-front-forest"), false, "arrival guard prevents an immediate return warp");
assert.equal(manager.releaseArrivalGuard("warp-to-front-forest"), true);
assert.equal(manager.canUseWarp("warp-to-front-forest"), true, "leaving the arrival zone releases the return warp");
assert.equal(manager.canUseWarp("unknown-warp"), false);

assert.equal(resolveInitialScene(""), "title");
assert.equal(resolveInitialScene("?scene=map-blockout"), "mapBlockout");
assert.equal(resolveInitialScene("?scene=unknown"), "title");

const sourcePaths = [
    "../src/data/maps/mapNodeSchema.js",
    "../src/data/maps/frontForest.js",
    "../src/data/maps/deepForest.js",
    "../src/data/maps/townSouth.js",
    "../src/data/maps/townNorth.js",
    "../src/data/maps/mapNodeRegistry.js"
];
const [html, css, sceneSource, managerSource, bootstrap, ...dataSources] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/MapBlockoutScene.js", import.meta.url), "utf8"),
    readFile(new URL("../src/core/MapNodeManager.js", import.meta.url), "utf8"),
    readFile(new URL("../game.js", import.meta.url), "utf8"),
    ...sourcePaths.map(path => readFile(new URL(path, import.meta.url), "utf8"))
]);
assert.match(html, /id="map-blockout-screen"[\s\S]*id="map-blockout-node-tabs"[\s\S]*id="map-blockout-grid"/, "blockout markup exposes node controls and visible grid");
for (const groupId of MAP_NODE_LAYER_ORDER) assert.match(sceneSource, new RegExp(groupId), `${groupId} uses the reusable layer renderer`);
assert.match(bootstrap, /register\("mapBlockout", MapBlockoutScene\)/, "blockout remains isolated from playable MapScene");
assert.doesNotMatch(dataSources.join("\n"), /assets\/|\.png|\.jpg|\.webp|sprite/i, "map-node data contains no production asset references");
assert.doesNotMatch(sceneSource, /collision|dialogue|keydown|requestAnimationFrame|AssetResolver|<img/i, "blockout renderer contains no movement, collision, dialogue, or asset systems");
assert.doesNotMatch(managerSource, /collision|encounter|dialogue|AssetResolver/i, "map-node manager only coordinates node transitions");

const cssStart = css.indexOf("/* Town map blockout development scene */");
const cssEnd = css.indexOf("/* End town map blockout development scene */");
const blockoutCss = css.slice(cssStart, cssEnd);
assert.ok(cssStart >= 0 && cssEnd > cssStart, "blockout styles remain isolated from playable-map styles");
assert.doesNotMatch(blockoutCss, /url\(|gradient\(/i, "blockout uses no image, texture, or gradient assets");
assert.match(blockoutCss, /\.map-blockout-grid-cell\s*\{[^}]*border-right:[^}]*border-bottom:/s, "grid lines use real CSS cell borders");
assert.match(blockoutCss, /\.map-blockout-type-walkable[\s\S]*\.map-blockout-type-blocked[\s\S]*\.map-blockout-group-warps/, "walkable, blocked, and warp states have distinct styles");

assert.equal(MapBlockoutScene.exit(), true);
assert.equal(elements.get("map-blockout-screen").hidden, true);
assert.equal(mapNodeManager.movementLocked, false);

console.log("Four-node map blockout: layout, bounds, flow, spawns, warp guards, and isolation assertions passed.");
