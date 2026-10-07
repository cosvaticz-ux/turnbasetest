import { constrainToWalkable, moveWithinWalkable, pointInRegion } from '../../core/WalkableGeometry.js';
import { screenInputVelocity } from '../../core/ExplorationProjection.js';
import { getTraversalPolygons } from '../../data/greyboxWarpCalibration.js';

export const inZone = pointInRegion;

const OCTANT_FACINGS = Object.freeze([
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
    'north',
    'northeast'
]);

export function facingFromInput(input = { x: 0, y: 0 }) {
    const x = Number(input?.x) || 0;
    const y = Number(input?.y) || 0;
    if (Math.hypot(x, y) < 0.001) return null;
    const octant = Math.round(Math.atan2(y, x) / (Math.PI / 4));
    const index = ((octant % 8) + 8) % 8;
    return OCTANT_FACINGS[index];
}

export class WalkablePlayerController {
    constructor(map, position) {
        this.map = map;
        this.traversalPolygons = getTraversalPolygons(map);
        this.blockedPolygons = map.blockedPolygons || [];
        const start = constrainToWalkable(position, this.traversalPolygons, this.blockedPolygons);
        this.position = { mapId: map.id, x: start.x, y: start.y };
        this.facing = 'south';
        this.moving = false;
        this.speed = 235;
    }

    pose() { return { x: this.position.x, y: this.position.y, depth: this.position.x + this.position.y }; }

    update(dt, input = { x: 0, y: 0 }) {
        if (typeof input === 'number') input = { x: input, y: 0 };
        const velocity = screenInputVelocity(input, this.speed);
        const intended = { x: velocity.x * dt, y: velocity.y * dt };
        const distance = Math.hypot(intended.x, intended.y);
        const steps = Math.max(1, Math.ceil(distance / 8));
        const before = { x: this.position.x, y: this.position.y };
        for (let step = 0; step < steps; step += 1) {
            const next = moveWithinWalkable(
                this.position,
                { x: intended.x / steps, y: intended.y / steps },
                this.traversalPolygons,
                this.blockedPolygons
            );
            this.position.x = next.x;
            this.position.y = next.y;
        }
        const screenDistance = Math.hypot(this.position.x - before.x, this.position.y - before.y);
        this.moving = screenDistance > 0.001;
        const nextFacing = facingFromInput(input);
        if (nextFacing) this.facing = nextFacing;
        return screenDistance;
    }
}

export const LanePlayerController = WalkablePlayerController;
