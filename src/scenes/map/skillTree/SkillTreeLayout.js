export const SKILL_TREE_LAYOUT = Object.freeze({
    "quick-strike": Object.freeze({ x: 50, y: 16, icon: "›", effect: "A fast physical strike costing no AP." }),
    "guard-stance": Object.freeze({ x: 27, y: 31, icon: "◇", effect: "Reduces damage from the next incoming attack." }),
    "power-strike": Object.freeze({ x: 52, y: 39, icon: "◆", effect: "Deals increased physical damage." }),
    counterstep: Object.freeze({ x: 76, y: 30, icon: "↶", effect: "Passively reduces incoming damage." }),
    "armor-break": Object.freeze({ x: 23, y: 53, icon: "◈", effect: "Damages and temporarily lowers enemy defense." }),
    "second-wind": Object.freeze({ x: 49, y: 58, icon: "+", effect: "Restores 30% maximum HP once per battle." }),
    "precision-strike": Object.freeze({ x: 77, y: 52, icon: "◎", effect: "Improves critical chance and pierces armor." }),
    riposte: Object.freeze({ x: 34, y: 75, icon: "↗", effect: "Guarding primes a stronger return strike." }),
    "execution-window": Object.freeze({ x: 66, y: 75, icon: "†", effect: "Increases damage against low-HP enemies." }),
    "veterans-instinct": Object.freeze({ x: 50, y: 91, icon: "✦", effect: "Grants a modest critical and defensive benefit." })
});

export const SKILL_TREE_ROOT = Object.freeze({ x: 50, y: 3, label: "Combat Training" });

export function findSpatialSkill(skills, currentId, direction) {
    const current = SKILL_TREE_LAYOUT[currentId];
    if (!current) return skills[0]?.id || null;
    const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    if (!vector) return currentId;
    let best = null;
    for (const skill of skills) {
        if (skill.id === currentId) continue;
        const point = SKILL_TREE_LAYOUT[skill.id];
        if (!point) continue;
        const dx = point.x - current.x;
        const dy = point.y - current.y;
        const forward = dx * vector[0] + dy * vector[1];
        if (forward <= 0) continue;
        const perpendicular = Math.abs(dx * vector[1] - dy * vector[0]);
        const score = forward + perpendicular * 1.65;
        if (!best || score < best.score) best = { id: skill.id, score };
    }
    return best?.id || currentId;
}
