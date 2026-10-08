import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, bootstrap, battleScene, entityHud, actorPresentation, effectPresentation] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../game.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/BattleScene.js", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/EntityHUD.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/battle/BattleActorPresentation.js", import.meta.url), "utf8"),
    readFile(new URL("../src/scenes/battle/BattleEffectPresentation.js", import.meta.url), "utf8")
]);
const game = `${bootstrap}\n${battleScene}\n${actorPresentation}\n${effectPresentation}`;

const cameraStart = html.indexOf('id="battle-camera"');
const cameraEnd = html.indexOf('id="battle-hud"');
const enemyHud = html.indexOf('id="enemy-hud-layer"');
assert.ok(cameraStart >= 0 && cameraEnd > cameraStart && enemyHud > cameraEnd, "enemy HUD is outside the transformed camera subtree");
assert.ok(html.indexOf('id="battle-world-background"') > cameraStart && html.indexOf('id="battle-world-background"') < cameraEnd, "background belongs to the world camera layer");
assert.match(css, /\.battle-state-header\s*\{[^}]*justify-self:\s*center;[^}]*width:\s*clamp\(/s, "Battle State is a compact top-center rectangle");
assert.match(css, /#party-hud-layer\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s, "Party Status is a fixed left-side list");
assert.match(css, /\.player-entity-hud\s*\{[^}]*position:\s*relative;[^}]*transform:\s*none/s, "Party Status cards never inherit character anchor movement");
assert.match(css, /\.enemy-entity-hud\[data-hud-anchor="above-head"\][^{]*\{[^}]*translate3d\(/s, "enemy Status Bars use GPU-friendly anchor tracking");
assert.match(css, /\.entity-hud-group\s*\{[^}]*transition:\s*none/s, "enemy HUD does not add delayed position easing");
assert.match(css, /\.character-hud-anchor\s*\{[^}]*position:\s*absolute/s, "world layer exposes invisible HUD anchor markers");
assert.match(game, /getBoundingClientRect\?\.\(\)/, "HUD positions derive from transformed anchor screen rectangles");
assert.match(game, /hud\.hidden\s*=\s*!visible/, "HUD hides when its marker leaves the battle viewport");
assert.match(game, /globalThis\.addEventListener\?\.\("resize", updateAllCharacterHuds\)/, "window resize recalculates anchor-based HUD positions");
assert.match(game, /elements\.battleHud\.appendChild\(elements\.battleMenu\)/, "Action Bar is separate from fixed Party Status cards");
assert.match(css, /#battle-menu\s*\{[^}]*translate3d\(var\(--action-screen-x/s, "Action Bar follows only the active character marker");
assert.match(css, /\.entity-hud-group > \.status-list\s*\{[^}]*top:\s*calc\(100% \+ 6px\);[^}]*flex-wrap:\s*wrap/s, "status icons wrap in a sibling container outside the base Status frame");
assert.match(entityHud, /hud\.append\(card, statuses\)/, "status icon container is a sibling of the bordered Status card");
assert.match(css, /\.entity-hud-card \.hud-title-row h2\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap/s, "long enemy names truncate inside the panel");
assert.match(css, /#damage-number\.damage-critical[^{]*\{[^}]*font-size:/s, "Critical damage has stronger text feedback");
assert.match(css, /#damage-number\.damage-fatal[^{]*\{[^}]*font-size:/s, "Fatal damage has the strongest text feedback");
assert.match(css, /#status-tooltip\s*\{[^}]*position:\s*fixed;[^}]*z-index:\s*40/s, "status tooltip is a fixed HUD overlay");
assert.match(css, /data-camera-mode="player-focus"[^}]*\.enemy-slot \.combatant-sprite/s, "player focus depth affects enemy sprites");
assert.doesNotMatch(css, /data-camera-mode="player-focus"[^}]*entity-hud/s, "player focus never blurs or scales HUD cards");
assert.equal((game.match(/announceTurn\(/g) || []).length, 6, "announcements exist only at prepare/player-side, enemy-side, next player-side, and explicit Prepare-reopen transitions");
assert.doesNotMatch(game, /\.name\.toUpperCase\(\) \+ " TURN!"/, "same-side character changes do not announce individual turns");

console.log("HUD/camera layout assertions passed.");
