import assert from "node:assert/strict";
import { Player } from "../src/entities/Player.js";
import { Enemy } from "../src/entities/Enemy.js";
import {
    assignFormation,
    findNextLivingIndex,
    FORMATION_SLOTS,
    getFormationSlot,
    getLivingEntities,
    moveTargetIndex,
    moveTargetSpatially
} from "../src/battle/BattleFormation.js";

const luke = Object.assign(new Player("Luke", 100, 20, 5, 10, 3), { id: "luke" });
const dummy = Object.assign(new Player("Dummy", 100, 18, 5, 9, 3), { id: "dummy" });
const thirdMember = Object.assign(new Player("P3", 90, 17, 4, 8, 3), { id: "p3" });
const highwayman = Object.assign(new Enemy("Highwayman", 60, 15, 3, 8, 20), { id: "highwayman" });
const highland = Object.assign(new Enemy("Highland Man", 72, 16, 4, 7, 24), { id: "highland-man" });

assert.equal(FORMATION_SLOTS.player.length, 3, "player formation exposes P1-P3");
assert.equal(FORMATION_SLOTS.enemy.length, 4, "enemy formation exposes E1-E4");
assert.deepEqual(assignFormation("player", [luke, dummy]).map(entry => entry.entity?.id || null), ["luke", "dummy", null]);
assert.deepEqual(assignFormation("player", [luke]).filter(entry => entry.entity).map(entry => entry.entity.id), ["luke"], "one-member party renders one occupied HUD slot");
assert.deepEqual(assignFormation("player", [luke, dummy, thirdMember]).filter(entry => entry.entity).map(entry => entry.entity.id), ["luke", "dummy", "p3"], "three-member party renders three occupied HUD slots");
assert.deepEqual(assignFormation("enemy", [highwayman, highland]).map(entry => entry.entity?.id || null), ["highwayman", "highland-man", null, null]);
assert.equal(getFormationSlot("P3")?.side, "player");
assert.equal(getFormationSlot("E4")?.side, "enemy");
assert.equal(getFormationSlot("P1")?.actionFocusScale, 1.55, "player focus uses a deliberate medium-shot zoom");
assert.ok(FORMATION_SLOTS.player.every(slot => Number.isFinite(slot.hudAnchorX) && Number.isFinite(slot.hudAnchorY)), "P1-P3 expose world-space HUD anchors");
assert.ok(FORMATION_SLOTS.enemy.every(slot => slot.hudAnchor === "above-head"), "E1-E4 anchor Status Bars above their heads");
assert.ok(FORMATION_SLOTS.enemy.every(slot => Number.isFinite(slot.hudAnchorX) && slot.hudAnchorY < 12 && slot.hudOffsetY > 0), "enemy HUD anchors sit above sprite heads with vertical gaps");
const enemyHudCoordinates = FORMATION_SLOTS.enemy.map(slot => `${slot.x}:${slot.y}:${slot.hudAnchorX}:${slot.hudAnchorY}`);
assert.equal(new Set(enemyHudCoordinates).size, 4, "E1-E4 HUD anchors remain independently positioned");
function enemyHudRectangle(slot, viewportWidth, battlefieldHeight) {
    const width = Math.min(196, Math.max(158, viewportWidth * 0.12));
    const height = 60;
    const bottom = battlefieldHeight * (slot.y / 100 + 0.025) - slot.hudOffsetY;
    const center = viewportWidth * (slot.x / 100 + 0.095);
    return { left: center - width / 2, right: center + width / 2, top: bottom - height, bottom };
}
function rectanglesOverlap(first, second) {
    return first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;
}
const [e1, e2] = FORMATION_SLOTS.enemy;
assert.equal(rectanglesOverlap(enemyHudRectangle(e1, 1920, 720), enemyHudRectangle(e2, 1920, 720)), false, "E1/E2 Status Bars do not overlap at 16:9");
assert.equal(rectanglesOverlap(enemyHudRectangle(e1, 1024, 560), enemyHudRectangle(e2, 1024, 560)), false, "E1/E2 Status Bars do not overlap at 4:3");

luke.ap = 0;
assert.equal(findNextLivingIndex([luke, dummy], 0, { requireAp: true }), 1, "turn advances to the next living member with AP");
dummy.hp = 0;
assert.equal(findNextLivingIndex([luke, dummy], 0, { requireAp: true }), -1, "defeated members are skipped");
dummy.resetBattleState();

assert.equal(moveTargetIndex([highwayman, highland], "highwayman", 1), 1, "target moves right");
assert.equal(moveTargetIndex([highwayman, highland], "highland-man", 1), 0, "target navigation wraps among living targets");
const targetPositions = new Map([
    ["highwayman", { x: 60, y: 20 }],
    ["highland-man", { x: 76, y: 42 }]
]);
assert.equal(
    moveTargetSpatially([highwayman, highland], "highwayman", { x: 0, y: 1 }, target => targetPositions.get(target.id)),
    1,
    "spatial target navigation supports future vertical formations"
);
highland.hp = 0;
assert.deepEqual(getLivingEntities([highwayman, highland]).map(entity => entity.id), ["highwayman"]);
assert.equal(moveTargetIndex([highwayman, highland], "highwayman", 1), 0, "defeated targets are skipped");

console.log("Formation core: 20 assertions passed.");
