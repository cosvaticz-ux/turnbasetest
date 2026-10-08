import assert from "node:assert/strict";
import { resolveBattleVisualTransform } from "../src/core/BattleVisualTransform.js";

assert.deepEqual(resolveBattleVisualTransform(), {
    scale: 1,
    offsetX: 0,
    offsetY: 0
}, "missing visual metadata uses safe defaults");

const entity = {
    battleVisual: { scale: 1.25, offsetX: -2, offsetY: 3 }
};
const animation = {
    frameAspectRatio: 342 / 518,
    visual: { scale: 0.8, offsetX: 5, offsetY: -1 }
};
assert.deepEqual(resolveBattleVisualTransform(entity, animation), {
    scale: 1,
    offsetX: 3,
    offsetY: 2
}, "character and animation transforms compose predictably");

const otherNativeRatio = {
    ...animation,
    frameAspectRatio: 480 / 526
};
assert.deepEqual(
    resolveBattleVisualTransform(entity, otherNativeRatio),
    resolveBattleVisualTransform(entity, animation),
    "native frame aspect ratio remains independent from visual scale"
);

const doubledCharacterScale = {
    battleVisual: { ...entity.battleVisual, scale: 2.5 }
};
assert.equal(
    resolveBattleVisualTransform(doubledCharacterScale, animation).scale,
    resolveBattleVisualTransform(entity, animation).scale * 2,
    "character scale resizes every animation by the same factor"
);

assert.deepEqual(resolveBattleVisualTransform(
    { battleVisual: { scale: 0, offsetX: "invalid", offsetY: Infinity } },
    { visual: { scale: -1, offsetX: null, offsetY: "4" } }
), {
    scale: 1,
    offsetX: 0,
    offsetY: 4
}, "invalid scales and offsets fall back safely");

console.log("Battle visual transform: defaults, composition, native ratio independence and invalid data passed.");
