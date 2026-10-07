import {
    constrainToWalkable,
    distanceBetween,
    moveWithinWalkable,
    pointInRegion
} from '../../core/WalkableGeometry.js';

export class WalkableEncounterController {
    constructor(map, defeated = [], random = Math.random) {
        this.map = map;
        this.random = random;
        this.enemies = map.enemies
            .filter(enemy => !defeated.includes(enemy.id))
            .map(enemy => {
                const position = constrainToWalkable(
                    enemy,
                    map.walkablePolygons,
                    map.blockedPolygons
                );
                const patrol = enemy.patrol?.map(target => constrainToWalkable(
                    target,
                    map.walkablePolygons,
                    map.blockedPolygons
                ));
                return {
                    ...enemy,
                    ...position,
                    ...(patrol ? { patrol } : {}),
                    direction: 1,
                    patrolTarget: patrol?.length > 1 ? 1 : 0
                };
            });
        this.cooldown = 3;
        this.distance = 0;
        this.zone = null;
    }

    update(dt, player, travelled) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        for (const enemy of this.enemies) {
            if (enemy.mode !== 'patrol' || !enemy.patrol?.length) continue;
            const target = enemy.patrol[enemy.patrolTarget];
            const distance = distanceBetween(enemy, target);
            if (distance < 2) enemy.patrolTarget = (enemy.patrolTarget + 1) % enemy.patrol.length;
            else {
                const step = Math.min(distance, (enemy.speed || 60) * dt);
                const delta = {
                    x: (target.x - enemy.x) / distance * step,
                    y: (target.y - enemy.y) / distance * step
                };
                const next = moveWithinWalkable(
                    enemy,
                    delta,
                    this.map.walkablePolygons,
                    this.map.blockedPolygons
                );
                enemy.direction = target.x >= enemy.x ? 1 : -1;
                enemy.x = next.x;
                enemy.y = next.y;
            }
        }
        if (this.cooldown) return null;
        const enemy = this.enemies.find(candidate => distanceBetween(candidate, player.position) < 38);
        if (enemy) return enemy;
        const zone = this.map.encounterZones.find(candidate => pointInRegion(player.position, candidate));
        if (zone !== this.zone) { this.distance = 0; this.zone = zone; }
        if (!zone) return null;
        this.distance += Math.abs(travelled || 0);
        if (this.distance > 260) {
            this.distance = 0;
            if (this.random() < 0.45) return { id: zone.id, encounterId: zone.encounterPool[Math.floor(this.random() * zone.encounterPool.length)], random: true };
        }
        return null;
    }
}

export const LaneEncounterController = WalkableEncounterController;
