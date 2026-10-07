import { projectGround } from '../core/ExplorationProjection.js';
import { getExplorationExits } from './greyboxWarpCalibration.js';

const freezeProfile = profile => Object.freeze({ ...profile });

export const EXPLORATION_WARP_PROFILES = Object.freeze({
    'front-forest': freezeProfile({ ring: '#d3b36c', glow: '#e2c887', dust: '#a98b51', opacity: .58 }),
    'deep-forest': freezeProfile({ ring: '#8fa879', glow: '#b1c49b', dust: '#6f8762', opacity: .5 }),
    'town-south': freezeProfile({ ring: '#d7bc78', glow: '#ead79e', dust: '#a9915d', opacity: .58 }),
    'town-north': freezeProfile({ ring: '#d9cfaa', glow: '#eee7c9', dust: '#aaa483', opacity: .55 })
});

export const EXPLORATION_SHADOW_PROFILE = Object.freeze({
    width: 58,
    height: 18,
    opacity: .34,
    offsetX: 0,
    offsetY: 2
});

export const EXPLORATION_PLAYER_SHADOW_PROFILE = Object.freeze({
    width: 48,
    height: 14,
    opacity: .26,
    offsetX: 0,
    offsetY: 0
});

const exitPolygon = exit => exit.polygon || [
    { x: exit.xMin, y: exit.yMin },
    { x: exit.xMax, y: exit.yMin },
    { x: exit.xMax, y: exit.yMax },
    { x: exit.xMin, y: exit.yMax }
];

function polygonCentroid(points) {
    let crossSum = 0;
    let xSum = 0;
    let ySum = 0;
    for (let index = 0; index < points.length; index += 1) {
        const current = points[index];
        const next = points[(index + 1) % points.length];
        const cross = current.x * next.y - next.x * current.y;
        crossSum += cross;
        xSum += (current.x + next.x) * cross;
        ySum += (current.y + next.y) * cross;
    }
    if (Math.abs(crossSum) < 1e-6) {
        return points.reduce((center, point) => ({
            x: center.x + point.x / points.length,
            y: center.y + point.y / points.length
        }), { x: 0, y: 0 });
    }
    return { x: xSum / (3 * crossSum), y: ySum / (3 * crossSum) };
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function deriveWarpCirclePresentations(map) {
    const profile = EXPLORATION_WARP_PROFILES[map?.id];
    if (!profile) return [];
    return getExplorationExits(map).map(exit => {
        const polygon = exitPolygon(exit);
        const center = polygonCentroid(polygon);
        const projected = polygon.map(point => projectGround(point));
        const xs = projected.map(point => point.x);
        const ys = projected.map(point => point.y);
        return Object.freeze({
            exitId: exit.id,
            targetMap: exit.targetMap,
            world: Object.freeze({ ...center }),
            projected: Object.freeze(projectGround(center)),
            width: clamp((Math.max(...xs) - Math.min(...xs)) * .72, 42, 150),
            height: clamp((Math.max(...ys) - Math.min(...ys)) * .55, 14, 42),
            profile
        });
    });
}
