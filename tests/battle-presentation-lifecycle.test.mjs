import assert from "node:assert/strict";
import { MockElement, elements, documentEvents, windowEvents, tasks, snapshot, advance, now } from "./helpers/battle-dom.mjs";

const scene = await import("../src/scenes/BattleScene.js");
const { BattleScene, Game, BattleInputManager, commandCategoryDefinitions } = scene;
assert.deepEqual(Object.keys(BattleScene).sort(), ["enter", "exit"]);
assert.deepEqual(Object.keys(scene).sort(), [
    "BATTLE_INPUT_ACTION", "BATTLE_PHASE", "BATTLE_STATUS", "BattleCamera", "BattleInputManager", "BattleScene",
    "FORMATION_SLOTS", "Game", "TURN", "commandCategoryDefinitions", "dummy", "enemies", "enemy", "highlandMan", "party", "player", "skills"
].sort(), "all existing scene exports remain available");

async function assertStopped(label) {
    assert.equal(tasks.size, 0, `${label}: no pending timeouts, intervals or camera frames`);
    const before = snapshot();
    advance(10000);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(snapshot(), before, `${label}: delayed work cannot mutate retired DOM`);
    assert.equal(windowEvents.get("resize")?.size || 0, 0);
    assert.equal(documentEvents.get("keydown")?.size || 0, 1, "only the app-lifetime audio unlock listener remains");
    for (const id of ["previous-command-tab", "next-command-tab", "battle-summary-next"]) {
        assert.equal(elements.get(id).listeners.get("click")?.length || 0, 0, `${label}: ${id} listener removed`);
    }
}

BattleScene.enter();
assert.ok(tasks.size > 0, "intro starts real registered presentation work");
BattleScene.exit();
await assertStopped("exit during intro");

BattleScene.enter({ skipIntro: true });
Game.randomSource = () => 0.5;
assert.equal(documentEvents.get("keydown").size, 2, "one battle listener plus one persistent audio unlock listener");
assert.equal(windowEvents.get("resize").size, 1);
const attack = commandCategoryDefinitions[0].getCommands()[0];
assert.equal(attack.execute(new MockElement("button")), true);
assert.equal(Game.confirmTargetSelection(), true);
advance(100);
BattleScene.exit();
await assertStopped("exit during player action");

for (const result of ["victory", "defeat"]) {
    BattleScene.enter({ skipIntro: true });
    const combatFrames = [...tasks].filter(([, task]) => task.kind === "frame").map(([id]) => id);
    assert.equal(Game.finishBattle(result), true);
    assert.ok(combatFrames.every(id => !tasks.has(id)), "terminal state cancels the previous combat camera tracking");
    assert.ok([...tasks.values()].every(task => task.kind !== "interval"), "terminal state cancels sprite intervals");
    assert.equal(elements.get("turn-popup-text").textContent, result === "victory" ? "VICTORY!" : "DEFEAT");
    assert.equal(BattleInputManager.handler("confirm"), false, "result announcement locks player commands");
    advance(320);
    assert.ok([...tasks.values()].every(task => task.kind === "timeout"), "the result camera reset retains its bounded HUD tracking");
    BattleScene.exit();
    await assertStopped(`exit during ${result} announcement`);
}

let handoff = null;
BattleScene.enter({ skipIntro: true, mapReturnNodeId: "town-south", mapReturnPosition: { x: 80, y: 90 },
    sceneManager: { transitionTo(id, context) { handoff = { id, context }; return true; } }
});
Game.finishBattle("victory");
advance(1850);
assert.equal(Game.battleEndPhase, "summary");
assert.equal(elements.get("battle-summary").hidden, false);
assert.ok(elements.get("battle-summary-content").children.length > 0, "resolved rewards render in the existing summary DOM");
assert.ok(tasks.size > 0, "summary meter animation is scheduled through the scene queue");
assert.equal(Game.completeBattleSummary(), true);
assert.equal(tasks.size, 1, "only the summary-confirmation audio watchdog remains during handoff");
assert.equal([...tasks.values()][0].delay, 15000, "meter and scene tasks were cancelled");
assert.equal(handoff.id, "map");
assert.equal(handoff.context.resumeMapNodeId, "town-south");
assert.deepEqual(handoff.context.resumePosition, { x: 80, y: 90 });
BattleScene.exit();
await assertStopped("return to map");

// Exercise the reentrant cancellation boundary directly: impact cancels its own animation.
const { createBattleAnimationDirector } = await import("../src/scenes/battle/BattleAnimationDirector.js");
const actor = { id: "test", isAlive: () => true, animations: {
    idle: { frames: 1 }, attack: { frames: 3, impactFrame: 1, frameDurationMs: 50 }
} };
const sprite = new MockElement("img");
const director = createBattleAnimationDirector({
    party: [actor], enemies: [], getEntityView: () => ({ sprite }),
    getPlayerAnimation: (entity, action) => entity.animations[action], getPlayerFrame: (_entity, action, frame) => `${action}-${frame}`,
    getEnemyAnimation() {}, getEnemyFrame() {}, isBattleScene: () => true, isBattleActive: () => true
});
let impacts = 0;
let completions = 0;
director.playPlayerPunch(actor, () => { impacts++; director.stopPlayerAnimation(); }, () => completions++);
assert.equal(impacts, 1);
assert.equal(tasks.size, 0, "impact cancellation cannot resurrect a frame interval");
advance(1000);
assert.equal(completions, 0);
const start = now;
const events = [];
director.playPlayerPunch(actor, () => events.push(["impact", now - start]), () => events.push(["complete", now - start]));
advance(150);
assert.deepEqual(events, [["impact", 0], ["complete", 150]], "normal impact/completion ordering and frame durations are preserved");
director.stopPlayerAnimation();
assert.equal(tasks.size, 0);

const foe = { id: "foe", hp: 10, isAlive() { return this.hp > 0; }, animations: {
    idle: { frames: 1 }, attack: { frames: 3, impactFrame: 2, frameDurationsMs: [40, 70, 90] },
    hit: { frames: 2, frameDurationsMs: [60, 90] }, death: { frames: 1, holdDurationMs: 700 }
} };
const foeView = Object.fromEntries(["sprite", "frameBlendSprite", "slotElement", "hud"].map(key => [key, new MockElement()]));
const enemyDirector = createBattleAnimationDirector({
    party: [], enemies: [foe], getEntityView: () => foeView,
    getPlayerAnimation() {}, getPlayerFrame() {},
    getEnemyAnimation: (entity, action) => entity.animations[action], getEnemyFrame: (_entity, action, frame) => `${action}-${frame}`,
    isBattleScene: () => true, isBattleActive: () => true
});
const enemyStart = now;
const enemyEvents = [];
enemyDirector.playEnemyAttackAnimation(foe, {
    onImpact: () => enemyEvents.push(["impact", now - enemyStart]),
    onComplete: () => enemyEvents.push(["complete", now - enemyStart])
});
advance(200);
assert.deepEqual(enemyEvents, [["impact", 40], ["complete", 200]], "enemy frame-specific timing is preserved");
enemyDirector.playEnemyAttackAnimation(foe, {
    onImpact: () => enemyDirector.stopEnemyHitAnimations({ restoreIdle: false })
});
advance(40);
assert.equal(tasks.size, 0, "enemy impact cancellation stops the next frame");
let counterCompletions = 0;
enemyDirector.playEnemyAttackAnimation(foe, {
    onImpact: () => { foe.hp = 0; },
    onComplete: () => { counterCompletions++; }
});
advance(1000);
assert.equal(counterCompletions, 1, "a lethal counter must finish the enemy action and release the turn queue");
assert.equal(enemyDirector.hasDeathPose(foe.id), true, "counter-killed attacker keeps its corpse pose");
assert.equal(tasks.size, 0, "counter death leaves no attack timer pending");
foe.hp = 0;
let deathCompleted = false;
enemyDirector.playEnemyHitAnimation(foe, () => { deathCompleted = true; });
advance(150);
assert.equal(foeView.sprite.src, "death-1", "lethal recoil transitions to the corpse asset");
assert.equal(deathCompleted, false);
advance(700);
assert.equal(deathCompleted, true);
assert.equal(enemyDirector.hasDeathPose(foe.id), true);
assert.equal(foeView.slotElement.classList.contains("is-dead-pose"), true);
enemyDirector.playEnemyHitAnimation(foe);
advance(150);
enemyDirector.stopEnemyHitAnimations({ restoreIdle: false });
assert.equal(tasks.size, 0, "corpse hold timers are cancellable");

const { createBattleEffectPresentation } = await import("../src/scenes/battle/BattleEffectPresentation.js");
const effectElements = Object.fromEntries([
    "battleScreen", "battleCamera", "fireballEffect", "icePikeEffect", "poisonEffect", "damageNumber"
].map(key => [key, new MockElement()]));
let shakeCancellations = 0;
effectElements.battleScreen.animate = () => ({ cancel() { shakeCancellations++; } });
const effects = createBattleEffectPresentation({
    elements: effectElements, getEntityView: () => ({ sprite }), getEntityViews: () => [{ sprite }],
    getSelectedTarget: () => ({ formationSlot: "E1" }), hasActiveBattle: () => true, isBattleScene: () => true,
    resetCommandTransition() {}, statusTooltipView: { hide() {} }, TURN_ANNOUNCEMENT_MS: 1450
});
effects.playFireballEffect({ formationSlot: "E1" });
effects.showFloatingCombatNumber(5, { formationSlot: "E1" });
effects.playBattleScreenShake();
assert.equal(effectElements.battleCamera.children.length, 1);
effects.clearVisualTimers();
assert.equal(tasks.size, 0);
assert.equal(shakeCancellations, 1, "Web Animations are cancelled alongside visual timeouts");
assert.equal(effectElements.battleCamera.children.length, 0, "cancellation removes temporary number DOM immediately");
assert.equal(effectElements.fireballEffect.classList.contains("fireball-active"), false);
const afterEffects = snapshot();
advance(1000);
assert.equal(snapshot(), afterEffects, "cancelled nested flash callbacks cannot mutate DOM later");

console.log("Battle presentation: API, action/intro/terminal exit, listener re-entry, summary cancellation, actor timing, corpse poses and effect cleanup passed.");
