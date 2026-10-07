const EPSILON = 1e-7;

export function pointInPolygon(point, polygon) {
    if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
        const onSegment = Math.abs(cross) < EPSILON
            && point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON
            && point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
        if (onSegment) return true;
        const crosses = (a.y > point.y) !== (b.y > point.y)
            && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

export function isWalkable(point, polygons = [], blockedPolygons = []) {
    return polygons.some(polygon => pointInPolygon(point, polygon))
        && !blockedPolygons.some(polygon => pointInPolygon(point, polygon));
}

export function pointInRegion(point, region) {
    if (!region) return false;
    if (region.polygon) return pointInPolygon(point, region.polygon);
    return point.x >= region.xMin && point.x <= region.xMax
        && point.y >= region.yMin && point.y <= region.yMax;
}

export function closestPointOnSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared
        ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
        : 0;
    return { x: a.x + dx * t, y: a.y + dy * t };
}

const polygonCenter = polygon => polygon.reduce((sum, vertex) => ({
    x: sum.x + vertex.x / polygon.length,
    y: sum.y + vertex.y / polygon.length
}), { x: 0, y: 0 });

const nudge = (candidate, awayFrom, amount = 0.01) => {
    const dx = candidate.x - awayFrom.x;
    const dy = candidate.y - awayFrom.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: candidate.x + dx / length * amount, y: candidate.y + dy / length * amount };
};

export function constrainToWalkable(point, polygons = [], blockedPolygons = []) {
    if (isWalkable(point, polygons, blockedPolygons)) return { ...point };
    let best = null;
    let bestDistance = Infinity;
    for (const polygon of polygons) {
        const center = polygonCenter(polygon);
        for (let index = 0; index < polygon.length; index += 1) {
            const edge = closestPointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length]);
            const candidate = nudge(edge, center, -0.01);
            const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
            if (distance < bestDistance && isWalkable(candidate, polygons, blockedPolygons)) {
                best = candidate;
                bestDistance = distance;
            }
        }
    }
    for (const polygon of blockedPolygons) {
        const center = polygonCenter(polygon);
        for (let index = 0; index < polygon.length; index += 1) {
            const edge = closestPointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length]);
            const candidate = nudge(edge, center);
            const distance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
            if (distance < bestDistance && isWalkable(candidate, polygons, blockedPolygons)) {
                best = candidate;
                bestDistance = distance;
            }
        }
    }
    return best || { ...point };
}

export function moveWithinWalkable(position, delta, polygons = [], blockedPolygons = []) {
    const desired = { x: position.x + delta.x, y: position.y + delta.y };
    if (isWalkable(desired, polygons, blockedPolygons)) return desired;
    const xOnly = { x: desired.x, y: position.y };
    const yOnly = { x: position.x, y: desired.y };
    const xValid = isWalkable(xOnly, polygons, blockedPolygons);
    const yValid = isWalkable(yOnly, polygons, blockedPolygons);
    if (xValid && yValid) return Math.abs(delta.x) >= Math.abs(delta.y) ? xOnly : yOnly;
    if (xValid) return xOnly;
    if (yValid) return yOnly;
    return constrainToWalkable(desired, polygons, blockedPolygons);
}

export const distanceBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
