import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXPLORATION_MAPS } from '../src/data/explorationMaps.js';
import {
    GREYBOX_REFERENCES,
    getExplorationExits,
    getTransitionPolygons,
    getTraversalPolygons,
    greyboxPixelToWorld,
    worldToGreyboxPixel
} from '../src/data/greyboxWarpCalibration.js';
import { isWalkable, pointInPolygon, pointInRegion } from '../src/core/WalkableGeometry.js';

const center = polygon => polygon.reduce((sum, point) => ({
    x: sum.x + point.x / polygon.length,
    y: sum.y + point.y / polygon.length
}), { x: 0, y: 0 });

function readPngDimensions(mapId) {
    const buffer = readFileSync(new URL(`../assets/images/background/map/${mapId}.png`, import.meta.url));
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${mapId} is a PNG`);
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const polygonArea = polygon => Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point.x * next.y - next.x * point.y;
}, 0) / 2);

const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function segmentsCross(a, b, c, d) {
    const abC = orientation(a, b, c);
    const abD = orientation(a, b, d);
    const cdA = orientation(c, d, a);
    const cdB = orientation(c, d, b);
    const onSegment = (point, start, end) => point.x >= Math.min(start.x, end.x) - 1e-7
        && point.x <= Math.max(start.x, end.x) + 1e-7
        && point.y >= Math.min(start.y, end.y) - 1e-7
        && point.y <= Math.max(start.y, end.y) + 1e-7;
    if (Math.abs(abC) < 1e-7 && onSegment(c, a, b)) return true;
    if (Math.abs(abD) < 1e-7 && onSegment(d, a, b)) return true;
    if (Math.abs(cdA) < 1e-7 && onSegment(a, c, d)) return true;
    if (Math.abs(cdB) < 1e-7 && onSegment(b, c, d)) return true;
    return abC * abD < 0 && cdA * cdB < 0;
}
function polygonsTouch(a, b) {
    return a.some(point => pointInPolygon(point, b))
        || b.some(point => pointInPolygon(point, a))
        || a.some((point, index) => b.some((other, otherIndex) => segmentsCross(
            point, a[(index + 1) % a.length], other, b[(otherIndex + 1) % b.length]
        )));
}

test('every map records its own actual native Greybox PNG size', () => {
    for (const [mapId, reference] of Object.entries(GREYBOX_REFERENCES)) {
        assert.deepEqual(readPngDimensions(mapId), {
            width: reference.nativeWidth,
            height: reference.nativeHeight
        });
    }
});

test('named calibration landmarks reproduce the measured image positions', () => {
    for (const [mapId, reference] of Object.entries(GREYBOX_REFERENCES)) {
        assert.ok(reference.landmarks.length >= 3, `${mapId} has at least three calibration landmarks`);
        for (const landmark of reference.landmarks) {
            assert.ok(
                distance(worldToGreyboxPixel(mapId, landmark.world), landmark.image) < 0.03,
                `${mapId} ${landmark.name} is registered`
            );
            assert.ok(
                distance(greyboxPixelToWorld(mapId, landmark.image), landmark.world) < 0.04,
                `${mapId} ${landmark.name} inverse registration is stable`
            );
        }
    }
});

test('runtime graph preserves only the active visible Greybox connections in both directions', () => {
    const graph = Object.fromEntries(Object.entries(EXPLORATION_MAPS).map(([mapId, map]) => [
        mapId,
        getExplorationExits(map).map(exit => exit.targetMap)
    ]));
    assert.deepEqual(graph, {
        'town-south': ['front-forest', 'town-north'],
        'town-north': ['town-south'],
        'front-forest': ['town-south', 'deep-forest'],
        'deep-forest': ['front-forest']
    });
    for (const [source, targets] of Object.entries(graph)) {
        for (const target of targets) {
            assert.ok(graph[target].includes(source), `${source} -> ${target} has a reverse route`);
        }
    }
});

test('the runtime warp polygon is the calibrated image polygon and stays inside the PNG', () => {
    for (const [mapId, map] of Object.entries(EXPLORATION_MAPS)) {
        const reference = GREYBOX_REFERENCES[mapId];
        for (const exit of getExplorationExits(map)) {
            assert.ok(exit.polygon.length >= 3);
            exit.imagePolygon.forEach(point => {
                assert.ok(point.x >= 0 && point.x <= reference.nativeWidth, `${mapId} ${exit.id} x is in image`);
                assert.ok(point.y >= 0 && point.y <= reference.nativeHeight, `${mapId} ${exit.id} y is in image`);
            });
            const worldCenter = center(exit.polygon);
            const imageCenter = center(exit.imagePolygon);
            assert.ok(distance(worldToGreyboxPixel(mapId, worldCenter), imageCenter) < 1e-6);
            assert.ok(isWalkable(worldCenter, getTraversalPolygons(map)), `${mapId} ${exit.id} is reachable`);
        }
    }
});

test('calibrated walkable polygons stay on-image and connect every spawn to every warp', () => {
    for (const mapId of ['front-forest', 'town-south', 'town-north']) {
        const map = EXPLORATION_MAPS[mapId];
        const reference = GREYBOX_REFERENCES[mapId];
        const polygons = getTraversalPolygons(map);
        map.walkablePolygons.flat().forEach(point => {
            const image = worldToGreyboxPixel(mapId, point);
            assert.ok(image.x >= 0 && image.x <= reference.nativeWidth, `${mapId} walkable x stays in image`);
            assert.ok(image.y >= 0 && image.y <= reference.nativeHeight, `${mapId} walkable y stays in image`);
        });

        const start = polygons.findIndex(polygon => pointInPolygon(map.spawnPoint, polygon));
        assert.notEqual(start, -1, `${mapId} spawn belongs to traversal geometry`);
        const reached = new Set([start]);
        const queue = [start];
        while (queue.length) {
            const current = queue.shift();
            polygons.forEach((candidate, index) => {
                if (!reached.has(index) && polygonsTouch(polygons[current], candidate)) {
                    reached.add(index);
                    queue.push(index);
                }
            });
        }
        for (const exit of getExplorationExits(map)) {
            const exitCenter = center(exit.polygon);
            assert.ok(
                polygons.some((polygon, index) => reached.has(index) && pointInPolygon(exitCenter, polygon)),
                `${mapId} spawn can reach ${exit.id}`
            );
        }
    }
});

for (const map of Object.values(EXPLORATION_MAPS)) {
    for (const exit of getExplorationExits(map)) {
        test(`${map.id} -> ${exit.targetMap}: arrival is walkable, faces inward and cannot retrigger`, () => {
            const targetMap = EXPLORATION_MAPS[exit.targetMap];
            assert.ok(targetMap);
            assert.ok(['north', 'south', 'east', 'west'].includes(exit.targetFacing));
            assert.ok(isWalkable(exit.target, getTraversalPolygons(targetMap)), `${exit.id} arrival is walkable`);
            assert.ok(distance(worldToGreyboxPixel(targetMap.id, exit.target), exit.targetImage) < 1e-6);
            assert.ok(
                !getExplorationExits(targetMap).some(targetExit => pointInRegion(exit.target, targetExit)),
                `${exit.id} arrival is outside all destination triggers`
            );
        });
    }
}

test('Town North uses one minimal transition-only corridor for its upper opening', () => {
    for (const [mapId, map] of Object.entries(EXPLORATION_MAPS)) {
        const corridors = getTransitionPolygons(map);
        assert.equal(corridors.length, mapId === 'town-north' ? 1 : 0);
    }
    const map = EXPLORATION_MAPS['town-north'];
    const corridor = getTransitionPolygons(map)[0];
    const imageCorridor = corridor.map(point => worldToGreyboxPixel(map.id, point));
    assert.ok(polygonArea(imageCorridor) < 50000, 'transition corridor remains a local exception');
    const exitCenter = center(getExplorationExits(map)[0].polygon);
    assert.ok(pointInRegion(exitCenter, { polygon: corridor }), 'corridor contains the exact runtime trigger');
    assert.equal(getTraversalPolygons(map).length, map.walkablePolygons.length + 1);
});

test('viewport resize changes only contain scaling, never image/world registration', () => {
    const viewports = [[1920, 1080], [1280, 720], [1365, 768]];
    for (const [mapId, reference] of Object.entries(GREYBOX_REFERENCES)) {
        for (const landmark of reference.landmarks) {
            const nativePixel = worldToGreyboxPixel(mapId, landmark.world);
            for (const [width, height] of viewports) {
                const scale = Math.min(width / reference.nativeWidth, height / reference.nativeHeight);
                const offset = {
                    x: (width - reference.nativeWidth * scale) / 2,
                    y: (height - reference.nativeHeight * scale) / 2
                };
                const fromWorld = {
                    x: offset.x + nativePixel.x * scale,
                    y: offset.y + nativePixel.y * scale
                };
                const fromImage = {
                    x: offset.x + landmark.image.x * scale,
                    y: offset.y + landmark.image.y * scale
                };
                assert.ok(distance(fromWorld, fromImage) < 0.03);
            }
        }
    }
});
