export const FORMATION_SLOTS = Object.freeze({
    player: Object.freeze([
        Object.freeze({ id: "P1", side: "player", x: 20, y: 43, hudAnchorX: 56, hudAnchorY: 43, hudOffsetX: 28, hudOffsetY: -34, actionFocusX: 34, actionFocusY: -7, actionFocusScale: 1.55 }),
        Object.freeze({ id: "P2", side: "player", x: 36, y: 58, hudAnchorX: 56, hudAnchorY: 43, hudOffsetX: 28, hudOffsetY: -34, actionFocusX: 17, actionFocusY: -18, actionFocusScale: 1.55 }),
        Object.freeze({ id: "P3", side: "player", x: 49, y: 43, hudAnchorX: 56, hudAnchorY: 43, hudOffsetX: 28, hudOffsetY: -34, actionFocusX: 4, actionFocusY: -7, actionFocusScale: 1.55 })
    ]),
    enemy: Object.freeze([
        Object.freeze({ id: "E1", side: "enemy", x: 60, y: 12, hudAnchorX: 50, hudAnchorY: 5, hudOffsetY: 12, hudAnchor: "above-head", focusX: -9, focusY: 4, focusScale: 1.16 }),
        Object.freeze({ id: "E2", side: "enemy", x: 78, y: 28, hudAnchorX: 50, hudAnchorY: 5, hudOffsetY: 12, hudAnchor: "above-head", focusX: -20, focusY: 0, focusScale: 1.16 }),
        Object.freeze({ id: "E3", side: "enemy", x: 90, y: 11, hudAnchorX: 50, hudAnchorY: 5, hudOffsetY: 10, hudAnchor: "above-head", focusX: -25, focusY: 4, focusScale: 1.16 }),
        Object.freeze({ id: "E4", side: "enemy", x: 69, y: 44, hudAnchorX: 50, hudAnchorY: 5, hudOffsetY: 10, hudAnchor: "above-head", focusX: -14, focusY: -7, focusScale: 1.16 })
    ])
});

export const ALL_FORMATION_SLOTS = Object.freeze([
    ...FORMATION_SLOTS.player,
    ...FORMATION_SLOTS.enemy
]);

export function getFormationSlot(slotId) {
    return ALL_FORMATION_SLOTS.find(slot => slot.id === slotId) || null;
}

export function assignFormation(side, entities = []) {
    const slots = FORMATION_SLOTS[side];
    if (!slots) return [];
    return slots.map((slot, index) => ({
        slot,
        entity: entities[index] || null
    }));
}

export function getLivingEntities(entities = []) {
    return entities.filter(entity => entity?.isAlive?.());
}

export function findNextLivingIndex(entities, currentIndex, { requireAp = false } = {}) {
    for (let index = currentIndex + 1; index < entities.length; index += 1) {
        const entity = entities[index];
        if (entity?.isAlive?.() && (!requireAp || entity.ap > 0)) return index;
    }
    return -1;
}

export function moveTargetIndex(entities, selectedId, direction) {
    const living = getLivingEntities(entities);
    if (living.length === 0 || !Number.isInteger(direction) || direction === 0) return -1;
    const currentIndex = Math.max(0, living.findIndex(entity => entity.id === selectedId));
    const nextIndex = (currentIndex + Math.sign(direction) + living.length) % living.length;
    return entities.indexOf(living[nextIndex]);
}

export function moveTargetSpatially(entities, selectedId, direction, getPosition = entity => entity) {
    const living = getLivingEntities(entities);
    if (living.length < 2 || !direction || (!direction.x && !direction.y)) return -1;
    const current = living.find(entity => entity.id === selectedId) || living[0];
    const origin = getPosition(current);
    if (!origin) return -1;

    let best = null;
    for (const candidate of living) {
        if (candidate === current) continue;
        const position = getPosition(candidate);
        if (!position) continue;
        const deltaX = position.x - origin.x;
        const deltaY = position.y - origin.y;
        const forward = deltaX * direction.x + deltaY * direction.y;
        if (forward <= 0) continue;
        const sideways = Math.abs(deltaX * direction.y - deltaY * direction.x);
        const score = forward + sideways * 0.45;
        if (!best || score < best.score) best = { candidate, score };
    }
    return best ? entities.indexOf(best.candidate) : -1;
}
