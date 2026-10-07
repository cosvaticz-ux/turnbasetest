import { createCombatantHud } from "./EntityHUD.js";

export function createEnemyHud(slot, entity) {
    if (slot?.side !== "enemy") throw new TypeError("EnemyHUD requires an enemy formation slot.");
    return createCombatantHud(slot, entity);
}
