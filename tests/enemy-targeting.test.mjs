import assert from "node:assert/strict";
import { selectEnemyActionTarget } from "../src/battle/TargetManager.js";

const alive = (id, extras = {}) => ({ id, targetable: true, isAlive: () => true, ...extras });
const dead = id => ({ id, targetable: true, isAlive: () => false });
const luke = alive("luke");
const dummy = alive("dummy");
const hidden = alive("reserve", { targetable: false });

assert.equal(selectEnemyActionTarget({ targets: [dead("fallen"), hidden] }), null, "dead and untargetable members are excluded");
assert.equal(selectEnemyActionTarget({ targets: [luke] }), luke, "a single valid target is selected without ambiguity");
assert.equal(selectEnemyActionTarget({ targets: [luke, dummy], randomSource: () => 0 }), luke, "the low RNG bound selects the first valid member");
assert.equal(selectEnemyActionTarget({ targets: [luke, dummy], randomSource: () => 0.999 }), dummy, "the high RNG bound can select another living member");
assert.equal(selectEnemyActionTarget({
    targets: [luke, dummy],
    action: { targetId: "dummy" },
    forcedTargetId: "luke",
    randomSource: () => 0
}), dummy, "an explicit scripted target overrides forced and random targeting");
assert.equal(selectEnemyActionTarget({
    targets: [luke, dummy],
    forcedTargetId: "dummy",
    randomSource: () => 0
}), dummy, "a forced target overrides random selection");
assert.equal(selectEnemyActionTarget({
    targets: [luke, dummy],
    action: { selectTarget: candidates => candidates.at(-1) },
    randomSource: () => 0
}), dummy, "a scripted selector may return a valid target object");

console.log("Enemy targeting: validity, RNG spread, and override priority passed.");
