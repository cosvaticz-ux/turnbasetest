import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GreyboxMapRenderer } from '../src/scenes/map/LaneMapRenderer.js';
import { EXPLORATION_MAPS } from '../src/data/explorationMaps.js';
import {
    getEnvironmentMaterials,
    ENVIRONMENT_MATERIALS,
    ENVIRONMENT_PRESENTATIONS
} from '../src/data/environmentMaterials.js';
import { getLukeExplorationIdleData, getLukeExplorationFrameData } from '../src/data/explorationCharacters.js';
import { getArrivalMarkers, getExplorationExits, getTransitionPolygons, getGreyboxReference } from '../src/data/greyboxWarpCalibration.js';
import { ENVIRONMENT_ARTWORKS, getEnvironmentArtwork } from '../src/data/environmentArtworks.js';

test('gameplay and registration match the release geometry snapshot exactly', () => {
    const baseline = JSON.parse(readFileSync(new URL('./fixtures/environment-main-geometry.json', import.meta.url), 'utf8'));
    const placements = JSON.parse(readFileSync(new URL('./fixtures/phase1-runtime-placements.json', import.meta.url), 'utf8'));
    for (const [id, map] of Object.entries(EXPLORATION_MAPS)) {
        const current = {
            walkablePolygons: map.walkablePolygons, blockedPolygons: map.blockedPolygons,
            spawnPoint: map.spawnPoint, spawnPoints: map.spawnPoints,
            exits: getExplorationExits(map), transitions: getTransitionPolygons(map), arrivals: getArrivalMarkers(map),
            reference: getGreyboxReference(map), structuralGeometry: map.structuralGeometry, camera: map.camera,
            encounterZones: map.encounterZones
        };
        // This older art-pass fixture predates Mara, the relocated sign and patrol,
        // and chibi metadata. Preserve its geometry; freeze current placements separately.
        // Its Deep Forest return marker includes the public-release walkability fix.
        const { enemies, interactables, ...originalGeometry } = baseline[id];
        assert.deepEqual(JSON.parse(JSON.stringify(current)), originalGeometry, id);
        assert.deepEqual(JSON.parse(JSON.stringify({ enemies: map.enemies, interactables: map.interactables })),
            placements.maps[id], `${id} current actor/interaction placements and art`);
    }
});

// Small DOM double: exercise the real renderer construction/update, not a
// separate reimplementation of its material binding or geometry algorithms.
class Element {
    constructor(name) {
        this.name = name; this.children = []; this.attrs = {}; this.dataset = {};
        const priorities = {};
        this.style = new Proxy({
            setProperty(key, value, priority = '') { this[key] = value; priorities[key] = priority; },
            getPropertyPriority(key) { return priorities[key] || ''; }
        }, { get(target, key) { return target[key] ?? ''; } });
        this.classList = {
            add: (...values) => { this.className = [...new Set([...this.classes(), ...values])].join(' '); },
            toggle: (value, on) => { this.className = this.classes().filter(x => x !== value).concat(on ? [value] : []).join(' '); },
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
        const classes = selector.split(',').map(x => x.trim().slice(1));
        return this.children.flatMap(child => [
            ...(classes.some(x => child.classes().includes(x)) ? [child] : []),
            ...child.querySelectorAll(selector)
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
};
const geometry = root => root.children.flatMap(node => [
    ...(node.attrs.points || node.attrs.cx ? [{ ...node.attrs }] : []), ...geometry(node)
]);
const withDOM = fn => {
    const previous = globalThis.document;
    globalThis.document = { createElement: name => new Element(name), createElementNS: (_, name) => new Element(name) };
    try { fn(); } finally { globalThis.document = previous; }
};

test('all maps decorate current geometry and restore debug/reference without data mutation', () => withDOM(() => {
    for (const id of Object.keys(EXPLORATION_MAPS)) {
        const map = freeze(structuredClone(EXPLORATION_MAPS[id]));
        const before = JSON.stringify(map);
        const renderer = new GreyboxMapRenderer(new Element('div'), map, [], true);
        const points = geometry(renderer.root);
        const ground = renderer.surface.querySelector('.greybox-walkable');
        const originalFill = ground.style.fill;
        const registration = JSON.stringify(renderer.referenceCamera);
        const count = renderer.materialLayer.patterns.size;
        assert.ok(renderer.materialLayer, id);
        assert.equal(renderer.referenceImage.style.display, 'block');
        assert.ok(renderer.artworkImage, id);
        for (let cycle = 0; cycle < 3; cycle++) {
            renderer.setDebugVisible(false);
            assert.equal(renderer.referenceImage.style.display, 'none');
            assert.equal(renderer.artworkImage.style.display, 'block');
            assert.match(ground.style.fill, /^url\(#environment-material-/);
            for (const node of renderer.surface.querySelectorAll('.greybox-transition-walkable')) {
                assert.equal(node.style.fill, ground.style.fill);
                assert.equal(node.style.getPropertyPriority('fill'), 'important');
                assert.equal(node.style.stroke, 'none');
            }
            for (const node of renderer.surface.querySelectorAll('.greybox-exit, .greybox-arrival-marker, .greybox-player-anchor')) {
                assert.equal(node.style.display, 'none');
            }
            for (const surface of [renderer.surface, renderer.backgroundSurface, renderer.foregroundSurface]) {
                assert.equal(surface.getAttribute('hidden'), '');
            }
            assert.deepEqual(geometry(renderer.root), points);
            renderer.setDebugVisible(true);
            assert.equal(renderer.referenceImage.style.display, 'block');
            assert.equal(renderer.artworkImage.style.display, 'none');
            assert.equal(ground.style.fill, originalFill);
            assert.equal(ground.style.getPropertyPriority('fill'), '');
            for (const node of renderer.surface.querySelectorAll('.greybox-exit, .greybox-arrival-marker, .greybox-player-anchor')) {
                assert.equal(node.style.display, '');
            }
        }
        assert.equal(renderer.materialLayer.patterns.size, count);
        assert.equal(JSON.stringify(renderer.referenceCamera), registration);
        assert.equal(JSON.stringify(map), before);
    }
}));

test('every map has calibrated final artwork matching its reference dimensions', () => {
    assert.deepEqual(new Set(Object.keys(ENVIRONMENT_ARTWORKS)), new Set(Object.keys(EXPLORATION_MAPS)));
    for (const id of Object.keys(EXPLORATION_MAPS)) {
        const artwork = getEnvironmentArtwork(id);
        const reference = getGreyboxReference(id);
        const buffer = readFileSync(new URL('../' + artwork.src, import.meta.url));
        assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', id);
        assert.equal(buffer.readUInt32BE(16), reference.nativeWidth, id + ' width');
        assert.equal(buffer.readUInt32BE(20), reference.nativeHeight, id + ' height');
        assert.equal(buffer.subarray(-8, -4).toString('ascii'), 'IEND', id + ' complete PNG');
    }
});

test('each map opts into a distinct coherent presentation profile', () => {
    assert.deepEqual(
        new Set(Object.keys(ENVIRONMENT_PRESENTATIONS)),
        new Set(Object.keys(EXPLORATION_MAPS))
    );
    assert.equal(getEnvironmentMaterials('front-forest').ground, 'forestGround');
    assert.equal(getEnvironmentMaterials('deep-forest').ground, 'deepForestGround');
    assert.equal(getEnvironmentMaterials('town-south').ground, 'packedEarth');
    assert.equal(getEnvironmentMaterials('town-north').ground, 'townStone');
    assert.equal(getEnvironmentMaterials('unknown'), null);
    assert.equal(getEnvironmentMaterials('town-south').roles['gate-tower'], 'townStone');
    assert.equal(getEnvironmentMaterials('town-north').structures['north-shop-mass'], 'timber');
});

test('material-enabled renderer keeps all eight Luke walk/idle directions and registration', () => withDOM(() => {
    const map = freeze(structuredClone(EXPLORATION_MAPS['front-forest']));
    const renderer = new GreyboxMapRenderer(new Element('div'), map, []);
    for (const facing of ['south','southeast','east','northeast','north','northwest','west','southwest']) {
        const player = { position: map.spawnPoint, facing, moving: true };
        renderer.update(player, map.camera, .016, []);
        assert.equal(renderer.playerImage.src, getLukeExplorationFrameData(facing, 1).src);
        const transform = renderer.player.style.transform;
        player.moving = false;
        renderer.update(player, map.camera, .016, []);
        assert.equal(renderer.playerImage.src, getLukeExplorationIdleData(facing).src);
        assert.equal(renderer.player.style.transform.split(' scaleX')[0], transform.split(' scaleX')[0]);
        assert.ok(renderer.player.style.transform.endsWith('scaleX(' + (getLukeExplorationIdleData(facing).mirror ? -1 : 1) + ')'));
        assert.equal(renderer.lastPlayerFacing, facing);
        assert.equal(renderer.player.dataset.animationState, 'idle');
    }
}));

test('ported textures are local SVG assets with solid fallback materials', () => {
    for (const material of Object.values(ENVIRONMENT_MATERIALS)) {
        assert.match(readFileSync(new URL('../' + material.texture, import.meta.url), 'utf8'), /<svg/);
        assert.match(material.color, /^#[0-9a-f]{6}$/);
    }
});
