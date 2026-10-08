import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    EXPLORATION_DEBUG_GEOMETRY,
    EXPLORATION_MAPS as maps,
    normalizeExplorationPosition
} from '../src/data/explorationMaps.js';
import { isWalkable, moveWithinWalkable, pointInRegion } from '../src/core/WalkableGeometry.js';
import { projectGround } from '../src/core/ExplorationProjection.js';
import { WalkablePlayerController } from '../src/scenes/map/LanePlayerController.js';
import { WalkableEncounterController } from '../src/scenes/map/LaneEncounterController.js';
import { FixedExplorationCamera } from '../src/scenes/map/LaneCameraController.js';
import { resolveExplorationActorScales } from '../src/scenes/map/LaneMapRenderer.js';
import { EXPLORATION_ACTOR_METRICS } from '../src/data/explorationCharacters.js';
import {
    GREYBOX_REFERENCES,
    getExplorationExits,
    getTraversalPolygons
} from '../src/data/greyboxWarpCalibration.js';
import { ENCOUNTER_DEFINITIONS } from '../src/data/encounters.js';
import { DIALOGUE_DEFINITIONS } from '../src/data/worldContent.js';

const front = maps['front-forest'];
const town = maps['town-south'];
const townNorth = maps['town-north'];
const styles = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/scenes/map/LaneMapRenderer.js', import.meta.url), 'utf8');
const mapSceneSource = readFileSync(new URL('../src/scenes/MapScene.js', import.meta.url), 'utf8');

test('greybox debug remains available while final artwork owns normal presentation', () => {
    assert.equal(EXPLORATION_DEBUG_GEOMETRY, true);
    assert.match(styles, /\.greybox-surface\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
    assert.match(rendererSource, /constructor\(viewport, map, enemies, debugGeometry = false\)/);
    assert.match(rendererSource, /normalGeometryVisible = Boolean\(this\.materialLayer && !this\.artworkImage\)/);
    assert.match(rendererSource, /surface\.toggleAttribute\('hidden', !this\.debugVisible && !normalGeometryVisible\)/);
    assert.match(rendererSource, /this\.artworkImage\.style\.display = this\.debugVisible \? 'none' : 'block'/);
    assert.match(mapSceneSource, /const initialDebug = false;/);
    assert.match(mapSceneSource, /key === 'f2'/);
    assert.doesNotMatch(mapSceneSource, /key === 'g'/);
    assert.doesNotMatch(mapSceneSource, /key === 'l'/);
});

test('all four exploration maps retain the uploaded greybox references for calibration and debug', () => {
    for (const [id, reference] of Object.entries(GREYBOX_REFERENCES)) {
        assert.doesNotThrow(() => readFileSync(new URL(`../${reference.src.slice(2)}`, import.meta.url)));
        assert.equal(reference.src, `./assets/images/background/map/${id}.png`);
    }
    assert.match(rendererSource, /getGreyboxReference\(map\)/);
    assert.match(rendererSource, /this\.referenceImage = this\.createReferenceImage\(\)/);
    assert.match(rendererSource, /className = 'exploration-greybox-reference'/);
    assert.match(rendererSource, /objectFit: 'contain'/);
    assert.match(rendererSource, /this\.referenceImage\?\.remove\(\)/);
});

test('Town Part 1 keeps the earlier projection-registered environment image as a fallback', () => {
    assert.deepEqual(Object.entries(maps).filter(([, map]) => map.environmentImage).map(([id]) => id), ['town-south']);
    assert.equal(town.environmentImage.src, './assets/images/map/town/town-south-environment-poc.svg');
    assert.deepEqual(town.environmentImage.projectionFrame, { x: -850, y: -150, width: 1850, height: 1150 });
    assert.doesNotThrow(() => readFileSync(new URL('../assets/images/map/town/town-south-environment-poc.svg', import.meta.url), 'utf8'));
    assert.match(rendererSource, /this\.environmentLayer = this\.createEnvironmentLayer\(\)/);
    assert.match(rendererSource, /if \(this\.referenceImage \|\| !this\.map\.environmentImage\) return null;/);
    assert.match(rendererSource, /this\.root\.append\(image\)/);
    assert.match(rendererSource, /this\.backgroundSurface = this\.createSurface/);
    assert.match(rendererSource, /this\.player = this\.actor/);
    assert.match(styles, /\.exploration-environment-image\s*\{[^}]*z-index:\s*0;/s);
    assert.match(styles, /\.greybox-ground-layer\s*\{\s*z-index:\s*1;/);
    assert.match(styles, /\.greybox-foreground-occluders\s*\{\s*z-index:\s*30000;/);
});

test('environment and geometry share the fixed camera transform at desktop sizes', () => {
    for (const [width, height] of [[1920, 1080], [1280, 720]]) {
        const camera = new FixedExplorationCamera(town);
        camera.update(town.spawnPoint, width, height);
        const worldPoint = { x: 720, y: 570 };
        const projected = projectGround(worldPoint);
        const fromGeometry = {
            x: camera.x + projected.x * camera.zoom,
            y: camera.y + projected.y * camera.zoom
        };
        const frame = town.environmentImage.projectionFrame;
        const imageLocal = { x: projected.x - frame.x, y: projected.y - frame.y };
        const fromImage = {
            x: camera.x + (frame.x + imageLocal.x) * camera.zoom,
            y: camera.y + (frame.y + imageLocal.y) * camera.zoom
        };
        assert.deepEqual(fromImage, fromGeometry);
        assert.equal(frame.width / frame.height, 1850 / 1150, 'the image frame preserves its authored aspect ratio');
    }
});

test('continuous projected movement is frame-rate independent', () => {
    for (const hz of [30, 60, 144]) {
        const player = new WalkablePlayerController(town, { mapId: town.id, x: 700, y: 550 });
        const start = projectGround(player.position);
        for (let frame = 0; frame < hz; frame += 1) player.update(1 / hz, { x: 1, y: 0 });
        const end = projectGround(player.position);
        assert.ok(
            Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - 235) < 1e-6,
            `projected speed is frame-rate independent at ${hz}Hz`
        );
    }
});

test('four directions and diagonals move freely without a diagonal speed boost', () => {
    for (const input of [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
    ]) {
        const player = new WalkablePlayerController(town, { mapId: town.id, x: 700, y: 550 });
        const start = projectGround(player.position);
        player.update(0.25, input);
        const end = projectGround(player.position);
        assert.ok(
            Math.abs(Math.hypot(end.x - start.x, end.y - start.y) - 58.75) < 1e-6,
            `input ${input.x},${input.y} has normalized visible speed`
        );
        assert.ok(isWalkable(player.position, town.walkablePolygons));
    }
});

test('visible walkable polygons constrain movement into black space', () => {
    const player = new WalkablePlayerController(front, { mapId: front.id, x: 70, y: 550 });
    for (let frame = 0; frame < 120; frame += 1) player.update(1 / 60, { x: -1, y: 0 });
    assert.ok(isWalkable(player.position, front.walkablePolygons));
    assert.ok(player.position.x >= 60, 'the player remains inside the visible west boundary');
});

test('polygon collision preserves sliding along a valid edge axis', () => {
    const polygons = [[
        { x: 0, y: 0 }, { x: 100, y: 0 },
        { x: 100, y: 100 }, { x: 0, y: 100 }
    ]];
    const moved = moveWithinWalkable({ x: 95, y: 50 }, { x: 20, y: 25 }, polygons);
    assert.equal(moved.x, 95, 'blocked horizontal motion stays constrained');
    assert.equal(moved.y, 75, 'unblocked vertical motion slides along the edge');
});

test('Front Forest Road Sign aligns with the right-side artwork signpost', () => {
    const sign = front.interactables.find(item => item.id === 'sign');
    assert.ok(sign);
    assert.deepEqual({ x: sign.x, y: sign.y }, { x: 720, y: 400 });
    assert.equal(sign.dialogueId, 'laneSign');
    assert.equal(sign.type, 'sign');
    assert.ok(
        isWalkable(sign, front.walkablePolygons, front.blockedPolygons),
        'Road Sign interaction anchor remains reachable on walkable ground'
    );
    assert.match(rendererSource, /else if \(item\.type !== 'sign'\)/,
        'sign interactions do not render the generic marker glyph');
    assert.match(rendererSource, /if \(item\.type !== 'sign'\) \{\s*const label/s,
        'sign interactions do not render an in-world name label');
    assert.match(styles, /\.greybox-interactable-sign\s*\{[^}]*width:\s*0;[^}]*height:\s*0;[^}]*background:\s*transparent;[^}]*border:\s*0;/s,
        'the Road Sign keeps an invisible interaction anchor');
    assert.match(mapSceneSource, /item\?\.type === 'sign' \? 'Interact' : item\?\.name/,
        'nearby sign prompt is generic rather than repeating the Road Sign name');
});

test('encounters use two-dimensional ground distance and polygon zones', () => {
    const encounters = new WalkableEncounterController(front, [], () => 0);
    encounters.cooldown = 0;
    const farPlayer = new WalkablePlayerController(front, { mapId: front.id, x: 300, y: 550 });
    assert.equal(encounters.update(0.01, farPlayer, 0), null);
    const contactPlayer = new WalkablePlayerController(front, { mapId: front.id, x: 890, y: 430 });
    assert.equal(encounters.update(0.01, contactPlayer, 0).id, 'lane-front-guard');
    assert.equal(new WalkableEncounterController(front, ['lane-front-guard']).enemies.length, 0);
    const zonePlayer = new WalkablePlayerController(front, { mapId: front.id, x: 1200, y: 650 });
    assert.equal(encounters.update(0.1, zonePlayer, 300).random, true);
    assert.equal(encounters.update(0.1, farPlayer, 10000), null);
});

test('patrol enemies retain their existing exploration behavior in two dimensions', () => {
    const forest = maps['deep-forest'];
    const encounters = new WalkableEncounterController(forest);
    const start = { x: encounters.enemies[0].x, y: encounters.enemies[0].y };
    encounters.update(0.5, new WalkablePlayerController(forest, forest.spawnPoint), 0);
    assert.notDeepEqual({ x: encounters.enemies[0].x, y: encounters.enemies[0].y }, start);
});

test('deep-forest patrol enemies never leave walkable geometry', () => {
    const forest = maps['deep-forest'];
    const authoredPatrol = forest.enemies.find(enemy => enemy.id === 'lane-deep-patrol');
    assert.deepEqual(
        { x: authoredPatrol.x, y: authoredPatrol.y },
        { x: 710, y: 660 },
        'the visible patrol starts away from the walkable edge'
    );
    assert.deepEqual(
        authoredPatrol.patrol,
        [{ x: 640, y: 660 }, { x: 780, y: 660 }],
        'the patrol route stays in the interior corridor rather than skimming scenery'
    );

    const encounters = new WalkableEncounterController(forest);
    const player = new WalkablePlayerController(forest, forest.spawnPoint);

    for (const enemy of encounters.enemies) {
        assert.ok(
            isWalkable(enemy, forest.walkablePolygons, forest.blockedPolygons),
            `${enemy.id} starts on walkable ground`
        );
        for (const target of enemy.patrol || []) {
            assert.ok(
                isWalkable(target, forest.walkablePolygons, forest.blockedPolygons),
                `${enemy.id} patrol waypoint is walkable`
            );
        }
    }

    for (let frame = 0; frame < 1200; frame += 1) {
        encounters.update(1 / 60, player, 0);
        for (const enemy of encounters.enemies) {
            assert.ok(
                isWalkable(enemy, forest.walkablePolygons, forest.blockedPolygons),
                `${enemy.id} remains on walkable ground at frame ${frame}`
            );
        }
    }
});

test('fixed cameras fit map geometry and do not follow arbitrary player positions', () => {
    const camera = new FixedExplorationCamera(front);
    camera.update(front.spawnPoint, 1280, 720);
    const initial = { x: camera.x, y: camera.y, zoom: camera.zoom };
    camera.update({ x: 1e6, y: -1e6 }, 1280, 720);
    assert.deepEqual({ x: camera.x, y: camera.y, zoom: camera.zoom }, initial);
    assert.ok(camera.zoom > 0);
    camera.update(front.spawnPoint, 800, 500);
    assert.ok(camera.zoom > 0, 'camera remains valid at a smaller viewport');

    camera.update(front.spawnPoint, 1920, 1080);
    assert.ok(camera.zoom > 1, 'large screens use a closer cinematic composition instead of a 1x tactical cap');
});

test('Town Part 1 has a walk-through gate opening framed by towers and walls', () => {
    const gateExit = getExplorationExits(town).find(mapExit => mapExit.id === 'to-front-forest');
    assert.ok(gateExit);
    const openingCenter = gateExit.polygon.reduce((sum, point) => ({
        x: sum.x + point.x / gateExit.polygon.length,
        y: sum.y + point.y / gateExit.polygon.length
    }), { x: 0, y: 0 });
    assert.ok(pointInRegion(openingCenter, gateExit));
    assert.ok(isWalkable(openingCenter, town.walkablePolygons));

    const towers = town.structuralGeometry.filter(area => area.role === 'gate-tower');
    const walls = town.structuralGeometry.filter(area => area.role === 'city-wall');
    const lintel = town.structuralGeometry.find(area => area.role === 'gate-lintel');
    assert.equal(towers.length, 2);
    assert.equal(walls.length, 2);
    assert.ok(lintel?.baseElevation > 0, 'the connecting lintel leaves the passage open below');
    for (const area of [...towers, ...walls]) {
        const center = area.polygon.reduce((sum, point) => ({ x: sum.x + point.x / area.polygon.length, y: sum.y + point.y / area.polygon.length }), { x: 0, y: 0 });
        assert.equal(pointInRegion(center, gateExit), false, `${area.id} is structure rather than an exit trigger`);
    }
});

test('all four maps remain data-driven and form a traversable graph', () => {
    const baseline = JSON.parse(readFileSync(new URL('./fixtures/environment-main-geometry.json', import.meta.url), 'utf8'));
    assert.deepEqual(Object.keys(maps).sort(), ['deep-forest', 'front-forest', 'town-north', 'town-south']);
    for (const map of Object.values(maps)) {
        assert.deepEqual(map.walkablePolygons, baseline[map.id].walkablePolygons,
            `${map.id} preserves every authored contour; polygon count is not a complexity contract`);
        assert.ok(map.walkablePolygons.length > 0, `${map.id} has walkable geometry`);
        for (const polygon of map.walkablePolygons) {
            assert.ok(polygon.length >= 3 && polygon.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
                `${map.id} has finite polygon vertices`);
        }
        assert.ok(isWalkable(map.spawnPoint, map.walkablePolygons), `${map.id} default spawn is walkable`);
        assert.equal(map.backgroundImage, undefined);
        assert.equal(map.backgroundLayers, undefined);
        assert.ok(map.camera && Number.isFinite(map.camera.pitch) && Number.isFinite(map.camera.yaw));
        assert.ok(map.camera.pitch >= 35 && map.camera.pitch <= 45);
        assert.ok(map.camera.actorScale >= 1.25, `${map.id} uses readable chibi-scale actors`);
        assert.ok(Array.isArray(map.structuralGeometry));
        assert.ok(map.structuralGeometry.some(area => area.layer === 'background'));
        assert.ok(map.structuralGeometry.some(area => area.layer === 'foreground'));
        for (const mapExit of getExplorationExits(map)) {
            assert.ok(mapExit.polygon.length >= 3);
            const targetMap = maps[mapExit.targetMap];
            assert.ok(targetMap, `${map.id} exit target exists`);
        }
    }
    assert.ok(town.environmentImage, 'Town Part 1 retains the earlier environment-image proof of concept as fallback data');
    for (const id of ['front-forest', 'deep-forest', 'town-north']) {
        assert.equal(maps[id].environmentImage, undefined, `${id} keeps the existing gameplay geometry without an extra environment POC`);
    }
    const reached = new Set();
    function visit(id) {
        if (reached.has(id)) return;
        reached.add(id);
        getExplorationExits(maps[id]).forEach(mapExit => visit(mapExit.targetMap));
    }
    visit('front-forest');
    assert.equal(reached.size, 4);
});

// Keep arrival defects independent so one bad edge cannot hide other map contracts.
for (const map of Object.values(maps)) {
    for (const mapExit of getExplorationExits(map)) {
        test(`${map.id} -> ${mapExit.targetMap}: arrival is walkable and outside destination exits`, () => {
            const targetMap = maps[mapExit.targetMap];
            assert.ok(isWalkable(mapExit.target, getTraversalPolygons(targetMap)), `${map.id} arrival is walkable`);
            assert.ok(!getExplorationExits(targetMap).some(candidate => pointInRegion(mapExit.target, candidate)),
                `${map.id} arrival does not immediately exit`);
        });
    }
}

test('all exploration characters use the city NPC visual height reference', () => {
    assert.equal(EXPLORATION_ACTOR_METRICS.standardVisualHeight, 112);

    const actorScale = 1.37;
    const scales = resolveExplorationActorScales(actorScale);
    const lukeBodyHeight = EXPLORATION_ACTOR_METRICS.height
        * EXPLORATION_ACTOR_METRICS.playerBodyHeightRatio
        * scales.player;
    const npcHeight = EXPLORATION_ACTOR_METRICS.standardVisualHeight * scales.standard;

    assert.ok(Math.abs(lukeBodyHeight - npcHeight) < 1e-9,
        'Luke visible body height matches the city NPC reference');
    assert.match(styles,
        /\.greybox-enemy\s*\{[^}]*height:\s*var\(--exploration-unit-visual-height,\s*112px\)/s,
        'Highwayman and other exploration enemies use the same height');
    assert.match(styles,
        /\.greybox-follower\s*\{[^}]*height:\s*var\(--exploration-unit-visual-height,\s*112px\)/s,
        'followers use the same height');
    assert.match(styles,
        /\.greybox-interactable img\s*\{[^}]*height:\s*var\(--exploration-unit-visual-height,\s*112px\)/s,
        'town NPC artwork remains the reference height');
});

test('new chibi NPC assignments replace the old town actors without changing map geometry', () => {
    const woman = town.interactables.find(item => item.id === 'villager');
    assert.equal(woman?.assetId, 'town-woman2');
    assert.equal(woman?.dialoguePortraitAssetId, 'town-woman');

    assert.equal(townNorth.interactables.some(item => item.id === 'resident'), false,
        'the old fountain resident is removed');
    const mara = townNorth.interactables.find(item => item.id === 'mara');
    assert.ok(mara, 'Mara is placed in Town Part 2');
    assert.equal(mara.assetId, 'town-mara2');
    assert.equal(mara.dialoguePortraitAssetId, 'town-mara');
    assert.equal(mara.dialogueId, 'mara');
    assert.equal(DIALOGUE_DEFINITIONS.mara[0].speaker, 'Mara');
    assert.deepEqual({ x: mara.x, y: mara.y }, { x: 350, y: 650 });
    assert.ok(isWalkable(mara, townNorth.walkablePolygons), 'Mara stands on walkable ground');
    assert.ok(townNorth.blockedPolygons.every(polygon => !pointInRegion(mara, polygon)),
        'Mara does not stand inside the fountain footprint');

    assert.equal(ENCOUNTER_DEFINITIONS['highwayman-patrol'].mapSpriteId, 'highwayman');
    assert.match(styles,
        /\.greybox-world:not\(\.greybox-debug-visible\) \.greybox-interactable-npc\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;/s,
        'standing NPC artwork renders without the blue debug box in normal play');
    assert.match(mapSceneSource, /dialoguePortraitAssetId/);
    assert.match(mapSceneSource, /AssetResolver\.npcSprite\(portraitAssetId\)/);
    assert.match(mapSceneSource, /openDialogue\(item\.dialogueId, dialoguePresentation\(item\)/);
});

test('native positions, default spawns, invalid maps, and legacy lane saves normalize safely', () => {
    assert.deepEqual(
        normalizeExplorationPosition({ mapId: 'town-south', x: 500, y: 600 }),
        { mapId: 'town-south', x: 500, y: 600 }
    );
    assert.deepEqual(normalizeExplorationPosition({ mapId: 'front-forest' }), {
        mapId: 'front-forest',
        ...front.spawnPoint
    });
    assert.deepEqual(normalizeExplorationPosition({ mapId: 'unknown-map' }), {
        mapId: 'front-forest',
        ...front.spawnPoint
    });
    const migrated = normalizeExplorationPosition({ mapId: 'deep-forest', laneId: 'far', x: 1200.25 });
    assert.equal(migrated.mapId, 'deep-forest');
    assert.ok(Number.isFinite(migrated.x) && Number.isFinite(migrated.y));
    const restored = new WalkablePlayerController(maps[migrated.mapId], migrated);
    assert.ok(isWalkable(restored.position, restored.map.walkablePolygons));
});
