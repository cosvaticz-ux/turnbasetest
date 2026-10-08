import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPLORATION_MAPS } from '../src/data/explorationMaps.js';
import {
    deriveWarpCirclePresentations,
    EXPLORATION_PLAYER_SHADOW_PROFILE,
    EXPLORATION_WARP_PROFILES
} from '../src/data/explorationPresentation.js';
import {
    getArrivalMarkers,
    getExplorationExits,
    getTransitionPolygons
} from '../src/data/greyboxWarpCalibration.js';
import { projectGround } from '../src/core/ExplorationProjection.js';
import {
    EXPLORATION_ACTOR_METRICS,
    getLukeExplorationFrameData,
    getLukeExplorationIdleData
} from '../src/data/explorationCharacters.js';
import {
    GreyboxMapRenderer,
    resolveExplorationActorScales
} from '../src/scenes/map/LaneMapRenderer.js';
import { EXPLORATION_PLAYER_SHADOW_NUDGE_Y } from '../src/scenes/map/ExplorationActorShadow.js';

class Element {
    constructor(name) {
        this.name = name;
        this.children = [];
        this.attrs = {};
        this.dataset = {};
        this.style = {
            setProperty(key, value) { this[key] = value; },
            getPropertyPriority() { return ''; }
        };
        this.classList = {
            add: (...values) => { this.className = [...new Set([...this.classes(), ...values])].join(' '); },
            toggle: (value, on) => { this.className = this.classes().filter(item => item !== value).concat(on ? [value] : []).join(' '); },
            contains: value => this.classes().includes(value)
        };
    }
    classes() { return (this.className || this.attrs.class || '').split(' ').filter(Boolean); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    toggleAttribute(key, on) { if (on) this.attrs[key] = ''; else delete this.attrs[key]; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.append(node); }
    addEventListener() {}
    remove() {}
    querySelectorAll(selector) {
        const classes = selector.split(',').map(value => value.trim().slice(1));
        return this.children.flatMap(child => [
            ...(classes.some(value => child.classes().includes(value)) ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
};

const withDOM = callback => {
    const previous = globalThis.document;
    globalThis.document = {
        createElement: name => new Element(name),
        createElementNS: (_, name) => new Element(name)
    };
    try { callback(); } finally { globalThis.document = previous; }
};

test('every authoritative exit derives one non-mutating warp-circle presentation', () => {
    assert.deepEqual(new Set(Object.keys(EXPLORATION_WARP_PROFILES)), new Set(Object.keys(EXPLORATION_MAPS)));
    for (const [mapId, source] of Object.entries(EXPLORATION_MAPS)) {
        const map = freeze(structuredClone(source));
        const before = JSON.stringify(map);
        const exitsBefore = JSON.stringify(getExplorationExits(map));
        const markers = deriveWarpCirclePresentations(map);
        const exits = getExplorationExits(map);
        assert.equal(markers.length, exits.length, mapId);
        assert.deepEqual(markers.map(marker => marker.exitId), exits.map(exit => exit.id), mapId);
        markers.forEach(marker => {
            assert.deepEqual(marker.projected, projectGround(marker.world));
            assert.ok(marker.width >= 42 && marker.height >= 14);
        });
        assert.equal(JSON.stringify(getExplorationExits(map)), exitsBefore, mapId);
        assert.equal(JSON.stringify(map), before, mapId);
    }
});

test('map graph, geometry, spawns and arrivals match the release snapshot', () => {
    const baseline = JSON.parse(readFileSync(new URL('./fixtures/environment-main-geometry.json', import.meta.url), 'utf8'));
    for (const [mapId, map] of Object.entries(EXPLORATION_MAPS)) {
        assert.deepEqual(map.walkablePolygons, baseline[mapId].walkablePolygons, `${mapId} walkable`);
        assert.deepEqual(map.blockedPolygons, baseline[mapId].blockedPolygons, `${mapId} blocked`);
        assert.deepEqual(map.spawnPoint, baseline[mapId].spawnPoint, `${mapId} spawn`);
        assert.deepEqual(map.spawnPoints, baseline[mapId].spawnPoints, `${mapId} named spawns`);
        assert.deepEqual(getExplorationExits(map), baseline[mapId].exits, `${mapId} exits`);
        assert.deepEqual(getTransitionPolygons(map), baseline[mapId].transitions, `${mapId} transitions`);
        assert.deepEqual(getArrivalMarkers(map), baseline[mapId].arrivals, `${mapId} arrivals`);
    }
});

test('renderer keeps debug exits and creates reusable shadows for all supported units', () => withDOM(() => {
    for (const [mapId, source] of Object.entries(EXPLORATION_MAPS)) {
        const map = freeze(structuredClone(source));
        const before = JSON.stringify(map);
        const renderer = new GreyboxMapRenderer(new Element('div'), map, map.enemies || [], false);
        const exits = getExplorationExits(map);
        assert.equal(renderer.exitPresentation.markers.length, exits.length, mapId);
        assert.equal(renderer.surface.querySelectorAll('.greybox-exit').length, exits.length, mapId);
        assert.deepEqual(
            renderer.exitPresentation.markers.map(marker => marker.node.dataset.exitId),
            exits.map(exit => exit.id),
            mapId
        );
        const expectedShadows = 2 + (map.enemies?.length || 0)
            + map.interactables.filter(item => item.type === 'npc').length;
        assert.equal(renderer.actorShadows.nodes.size, expectedShadows, mapId);
        renderer.setDebugVisible(true);
        for (const node of renderer.surface.querySelectorAll('.greybox-exit, .greybox-arrival-marker')) {
            assert.notEqual(node.style.display, 'none', mapId);
        }
        assert.equal(JSON.stringify(map), before, mapId);
    }
}));

test('Luke uses the compact player-specific shadow profile without changing other unit shadows', () => withDOM(() => {
    const map = freeze(structuredClone(EXPLORATION_MAPS['front-forest']));
    const renderer = new GreyboxMapRenderer(new Element('div'), map, map.enemies || [], false);
    const playerShadow = renderer.actorShadows.nodes.get('player:luke');
    assert.equal(playerShadow.style.width, `${EXPLORATION_PLAYER_SHADOW_PROFILE.width}px`);
    assert.equal(playerShadow.style.height, `${EXPLORATION_PLAYER_SHADOW_PROFILE.height}px`);
    assert.equal(playerShadow.style.opacity, String(EXPLORATION_PLAYER_SHADOW_PROFILE.opacity));
    assert.equal(playerShadow.style['--shadow-offset-y'], `${EXPLORATION_PLAYER_SHADOW_PROFILE.offsetY}px`);
}));


test('Luke shadow follows the rendered visual foot anchor for idle and walk facings', () => withDOM(() => {
    const map = freeze(structuredClone(EXPLORATION_MAPS['front-forest']));
    const renderer = new GreyboxMapRenderer(new Element('div'), map, map.enemies || [], false);
    const player = { position: map.spawnPoint, facing: 'south', moving: false };
    const shadow = renderer.actorShadows.nodes.get('player:luke');
    const ground = projectGround(player.position);
    const stageScale = renderer.syncReferenceStage();
    const renderCamera = renderer.referenceCamera || map.camera;
    const actorScale = (map.camera.actorScale || 1) / (renderCamera.zoom * stageScale);
    const playerScale = resolveExplorationActorScales(actorScale).player;

    const expectedTop = frameData => {
        const profile = frameData.renderProfile;
        const footAnchorY = profile?.targetFootAnchorY ?? profile?.footAnchorY ?? 1;
        return ground.y
            + EXPLORATION_ACTOR_METRICS.height * (footAnchorY - 1) * playerScale
            + EXPLORATION_PLAYER_SHADOW_NUDGE_Y;
    };

    for (const facing of ['south', 'southeast', 'east', 'northeast', 'north', 'northwest', 'west', 'southwest']) {
        player.facing = facing;
        player.moving = true;
        renderer.update(player, map.camera, .016, []);
        const walkData = getLukeExplorationFrameData(facing, 1);
        assert.equal(shadow.style.left, `${ground.x}px`);
        assert.equal(shadow.style.top, `${expectedTop(walkData)}px`);

        player.moving = false;
        renderer.update(player, map.camera, .016, []);
        const idleData = getLukeExplorationIdleData(facing);
        assert.equal(shadow.style.left, `${ground.x}px`);
        assert.equal(shadow.style.top, `${expectedTop(idleData)}px`);
        assert.deepEqual(player.position, map.spawnPoint);
    }
}));
