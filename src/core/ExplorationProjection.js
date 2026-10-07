export const EXPLORATION_PROJECTION = Object.freeze({ xScale: 0.72, yScale: 0.36 });

export function projectGround(point, projection = EXPLORATION_PROJECTION) {
    return { x: (point.x - point.y) * projection.xScale, y: (point.x + point.y) * projection.yScale };
}

export function inverseProjectVector(vector, projection = EXPLORATION_PROJECTION) {
    return {
        x: vector.x / (2 * projection.xScale) + vector.y / (2 * projection.yScale),
        y: vector.y / (2 * projection.yScale) - vector.x / (2 * projection.xScale)
    };
}

export function inverseProjectPoint(point, projection = EXPLORATION_PROJECTION) {
    return inverseProjectVector(point, projection);
}

export function screenInputVelocity(input, speed, projection = EXPLORATION_PROJECTION) {
    const length = Math.hypot(input.x, input.y);
    if (!length) return { x: 0, y: 0 };
    const world = inverseProjectVector({ x: input.x / length, y: input.y / length }, projection);
    return { x: world.x * speed, y: world.y * speed };
}

export function projectedBounds(polygons, projection = EXPLORATION_PROJECTION) {
    const points = polygons.flat().map(point => projectGround(point, projection));
    return points.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x), maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y), maxY: Math.max(bounds.maxY, point.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}
