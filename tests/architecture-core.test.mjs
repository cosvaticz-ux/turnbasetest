import assert from "node:assert/strict";
import { BattleManager } from "../src/battle/BattleManager.js";
import { TargetManager } from "../src/battle/TargetManager.js";
import { TurnManager } from "../src/battle/TurnManager.js";
import { SceneManager } from "../src/core/SceneManager.js";
import { SaveManager } from "../src/core/SaveManager.js";
import { rollChance } from "../src/utils/RNG.js";

const events = [];
const scenes = new SceneManager();
scenes.register("title", {
    enter: () => events.push("title:enter"),
    exit: () => events.push("title:exit")
});
scenes.register("battle", {
    enter: () => events.push("battle:enter"),
    exit: () => events.push("battle:exit")
});
assert.equal(scenes.transitionTo("title"), true);
assert.equal(scenes.transitionTo("battle"), true);
assert.deepEqual(events, ["title:enter", "title:exit", "battle:enter"]);

const living = id => ({ id, hp: 10, isAlive() { return this.hp > 0; } });
const party = [living("luke")];
const enemies = [living("e1"), living("e2")];
const battle = new BattleManager({ party, enemies });
battle.start();
assert.equal(battle.isActive(), true);
enemies.forEach(enemy => { enemy.hp = 0; });
assert.equal(battle.getOutcome(), "victory");
assert.equal(battle.finish("victory"), true);

const targets = new TargetManager(enemies);
enemies.forEach(enemy => { enemy.hp = 10; });
targets.reset();
assert.equal(targets.begin({ type: "attack" }, "luke"), true);
assert.equal(targets.changeLinear(1), true);
assert.equal(targets.getSelected().id, "e2");

const turns = new TurnManager();
turns.beginEnemySide(["e1", "e2"]);
assert.equal(turns.currentSide, "enemy");
assert.equal(turns.advanceEnemyAction(), true);
turns.beginPlayerSide(0);
assert.equal(turns.currentSide, "player");

assert.equal(rollChance(0.25, () => 0.2), true);
assert.equal(rollChance(0.25, () => 0.3), false);

const blockedStorage = {
    getItem() { throw new Error("storage blocked"); },
    setItem() { throw new Error("storage blocked"); }
};
const safeSaves = new SaveManager(blockedStorage);
assert.equal(safeSaves.load("autosave"), null, "blocked browser storage fails closed");
assert.equal(safeSaves.save("autosave", {}), false, "blocked browser storage never crashes the scene");

console.log("Architecture core: scene, battle, target, turn, and RNG assertions passed.");
