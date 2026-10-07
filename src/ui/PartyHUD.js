import { createCombatantHud } from "./EntityHUD.js";

export function createPartyHud(slot, entity) {
    if (slot?.side !== "player") throw new TypeError("PartyHUD requires a player formation slot.");

    const layer = document.getElementById("party-hud-layer");
    if (layer) {
        layer.style.width = "clamp(220px, 17vw, 280px)";
        layer.style.gap = "26px";
    }

    return createCombatantHud(slot, entity);
}
