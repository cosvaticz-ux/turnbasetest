import assert from "node:assert/strict";

class MockClassList {
    constructor(owner) {
        this.owner = owner;
        this.values = new Set();
    }
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
}

class MockStyle {
    constructor() { this.values = new Map(); }
    setProperty(name, value) { this.values.set(name, String(value)); }
    getPropertyValue(name) { return this.values.get(name) || ""; }
}

class MockElement {
    constructor(tagName = "div", id = "") {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.attributes = new Map();
        this.classList = new MockClassList(this);
        this.style = new MockStyle();
        this.listeners = new Map();
        this.hidden = false;
        this.inert = false;
        this.disabled = false;
        this.textContent = "";
        this.title = "";
        this.src = "";
        this.alt = "";
        this.scrollTop = 0;
        this.scrollHeight = 0;
        this.isContentEditable = false;
    }
    set className(value) {
        this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    }
    get className() { return [...this.classList.values].join(" "); }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    appendChild(node) {
        if (node.parentNode) node.parentNode.children = node.parentNode.children.filter(child => child !== node);
        node.parentNode = this;
        this.children.push(node);
        this.scrollHeight = this.children.length;
        return node;
    }
    replaceChildren(...nodes) {
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        this.append(...nodes);
    }
    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    get offsetWidth() { return 100; }
    getBoundingClientRect() {
        if (this.id === "battlefield") return { left: 0, top: 0, width: 1280, height: 720 };
        if (this.classList.contains("character-hud-anchor")) {
            const slot = this.parentNode;
            const camera = elements.get("battle-camera");
            const slotX = Number.parseFloat(slot?.style.getPropertyValue("--slot-x")) || 0;
            const slotY = Number.parseFloat(slot?.style.getPropertyValue("--slot-y")) || 0;
            const anchorX = Number.parseFloat(this.style.getPropertyValue("--hud-anchor-x")) || 50;
            const anchorY = Number.parseFloat(this.style.getPropertyValue("--hud-anchor-y")) || 40;
            const scale = Number.parseFloat(camera?.style.getPropertyValue("--camera-scale")) || 1;
            const panX = Number.parseFloat(camera?.style.getPropertyValue("--camera-x")) || 0;
            const panY = Number.parseFloat(camera?.style.getPropertyValue("--camera-y")) || 0;
            const worldX = slotX * 12.8 + anchorX * 2;
            const worldY = slotY * 7.2 + anchorY * 2;
            return {
                left: (worldX - 640) * scale + 640 + panX * 12.8,
                top: (worldY - 360) * scale + 360 + panY * 7.2,
                width: 1,
                height: 1
            };
        }
        return { left: 0, top: 0, width: 100, height: 60 };
    }
}

const ids = [
    "battle-screen", "battlefield", "battle-camera", "battle-world-background", "battle-hud", "formation-layer", "party-hud-layer", "enemy-hud-layer",
    "battle-menu", "turn-text", "battle-log", "damage-number", "fireball-effect", "icepike-effect",
    "poison-effect", "turn-popup", "turn-popup-text", "command-box", "command-category-title",
    "previous-command-tab", "next-command-tab", "menu-content", "battle-summary", "battle-summary-next",
    "battle-intro-overlay", "status-tooltip", "status-tooltip-title", "status-tooltip-lines"
];
const elements = new Map(ids.map(id => [id, new MockElement("div", id)]));
elements.get("battle-menu").hidden = true;
elements.get("battle-summary").hidden = true;
elements.get("battle-intro-overlay").hidden = true;

globalThis.document = {
    createElement: tagName => new MockElement(tagName),
    getElementById: id => elements.get(id) || null,
    addEventListener() {}
};

globalThis.Audio = class {
    constructor(src) { this.src = src; this.currentTime = 0; this.volume = 1; this.loop = false; }
    play() { return Promise.resolve(); }
    pause() {}
};

const module = await import("../game.js");
const { BattleInputManager, Game, party, enemies, player, dummy, enemy, highlandMan, sceneManager } = module;
Game.randomSource = () => 0.5;

let queuedBattleTasks = [];
let queuedPostBattleTasks = [];
Game.cancelPendingBattleTimers();
Game.scheduleBattleTask = (callback, delay) => {
    queuedBattleTasks.push({ callback, delay });
    return queuedBattleTasks.length;
};
Game.schedulePostBattleTask = (callback, delay) => {
    queuedPostBattleTasks.push({ callback, delay });
    return queuedPostBattleTasks.length;
};
Game.cancelPendingBattleTimers = () => {
    queuedBattleTasks = [];
    queuedPostBattleTasks = [];
    Game.pendingBattleTimers.clear();
    Game.pendingPostBattleTimers.clear();
};
function runNextBattleTask() {
    const task = queuedBattleTasks.shift();
    assert.ok(task, "expected a queued battle task");
    task.callback();
    return task.delay;
}
function runNextPostBattleTask() {
    const task = queuedPostBattleTasks.shift();
    assert.ok(task, "expected a queued post-battle task");
    task.callback();
    return task.delay;
}
function pressKey(key) {
    let prevented = false;
    const handled = BattleInputManager.handleKeyDown({
        key,
        repeat: false,
        target: new MockElement("div"),
        preventDefault() { prevented = true; }
    });
    return { handled, prevented };
}
function pressRepeatedKey(key) {
    let prevented = false;
    const handled = BattleInputManager.handleKeyDown({
        key,
        repeat: true,
        target: new MockElement("div"),
        preventDefault() { prevented = true; }
    });
    return { handled, prevented };
}
function findDescendant(root, predicate) {
    if (predicate(root)) return root;
    for (const child of root.children || []) {
        const found = findDescendant(child, predicate);
        if (found) return found;
    }
    return null;
}

sceneManager.transitionTo("battle");
assert.equal(Game.battleIntroActive, true);
assert.equal(elements.get("battle-intro-overlay").hidden, false);
assert.equal(elements.get("battle-menu").hidden, true, "battle input stays closed during intro");
assert.equal(queuedBattleTasks[0].delay, 520);
runNextBattleTask();
assert.equal(elements.get("battle-intro-overlay").hidden, true);
assert.equal(elements.get("turn-popup-text").textContent, "BATTLE START!");
assert.equal(queuedBattleTasks[0].delay, 1000);
runNextBattleTask();
assert.equal(Game.battleIntroActive, false);
assert.equal(elements.get("battle-menu").hidden, false);

assert.equal(party.length, 2);
assert.equal(enemies.length, 2);
assert.notEqual(player, dummy, "party members have independent objects");
assert.notEqual(enemy, highlandMan, "enemies have independent objects");
assert.deepEqual(party.map(member => member.ap), [1, 1], "every party member starts battle at 1 AP");
assert.deepEqual(party.map(member => member.hasActedThisTurn), [false, false]);
assert.equal(player.assetId, "luke");
assert.equal(enemy.sprite, "./assets/images/character/enemies/highwayman/highwayman-idle1.png");
assert.equal(highlandMan.assetId, null, "Highland Man does not borrow Highwayman art");
assert.equal(highlandMan.visual.type, "placeholder");
assert.equal(highlandMan.visual.family, "humanoid");
assert.equal(enemy.animations.attack.frames, 9);
assert.equal(elements.get("fireball-effect").src, "./assets/images/skill/fireball/effect.png");
assert.equal(elements.get("icepike-effect").src, "./assets/images/skill/ice-pike/effect.png");
assert.equal(
    elements.get("battle-world-background").style.getPropertyValue("--battle-background-image"),
    'url("./assets/images/background/battle/battle-front-forest-background.png")',
    "the available forest battle background is resolved from battle content"
);
assert.equal(elements.get("formation-layer").children.length, 7, "P1-P3 and E1-E4 render");
assert.equal(elements.get("party-hud-layer").children.length, 2);
assert.equal(elements.get("enemy-hud-layer").children.length, 2);
assert.equal(elements.get("battle-menu").parentNode, elements.get("battle-hud"), "Action Bar stays in the screen-space overlay");
assert.ok(elements.get("battle-menu").style.getPropertyValue("--action-screen-x").endsWith("px"), "Action Bar follows Luke's screen-space marker");
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-scale"), "1.55");
assert.equal(elements.get("battle-screen").dataset.cameraMode, "player-focus");
assert.equal(elements.get("turn-popup").style.getPropertyValue("--announcement-duration"), "1450ms");
const lukeHud = elements.get("party-hud-layer").children.find(child => child.dataset.entityId === "luke");
const dummyHud = elements.get("party-hud-layer").children.find(child => child.dataset.entityId === "dummy");
const highwaymanHud = elements.get("enemy-hud-layer").children.find(child => child.dataset.entityId === "highwayman");
const highlandHud = elements.get("enemy-hud-layer").children.find(child => child.dataset.entityId === "highland-man");
assert.equal(lukeHud.style.getPropertyValue("--hud-screen-x"), "", "fixed Party Status does not consume camera-anchor coordinates");
assert.equal(dummyHud.style.getPropertyValue("--hud-screen-x"), "", "all Party Status cards remain fixed in the left list");
assert.equal(highwaymanHud.dataset.hudAnchor, "above-head");
assert.equal(highlandHud.dataset.hudAnchor, "above-head");
assert.equal(highwaymanHud.parentNode, elements.get("enemy-hud-layer"), "enemy HUD stays outside the camera layer");
assert.ok(highwaymanHud.style.getPropertyValue("--hud-screen-x").endsWith("px"), "enemy HUD receives a screen-space anchor position");
assert.ok(highlandHud.style.getPropertyValue("--hud-screen-y").endsWith("px"), "every enemy HUD receives its own screen-space anchor position");

assert.equal(pressKey("ArrowDown").prevented, true, "mapped battle keys prevent page scrolling");
assert.equal(pressRepeatedKey("ArrowDown").prevented, true, "held navigation keys also suppress page scrolling");
assert.equal(elements.get("menu-content").children[1].classList.contains("keyboard-selected"), true);
assert.equal(pressKey("ArrowUp").handled, true);
assert.equal(elements.get("menu-content").children[0].classList.contains("keyboard-selected"), true);
assert.equal(pressKey("ArrowRight").handled, true);
assert.equal(elements.get("command-category-title").textContent, "Skill");
assert.equal(pressKey("Escape").handled, true);
assert.equal(elements.get("command-category-title").textContent, "Action");
assert.equal(pressKey(" ").handled, true, "Space confirms the highlighted Attack command");
assert.ok(Game.targetSelection);
assert.equal(pressKey("Escape").handled, true, "Escape cancels target selection");
assert.equal(Game.targetSelection, null);

assert.equal(Game.beginTargetSelection({ type: "attack", apCost: 1 }), true);
assert.equal(Game.selectedTargetId, "highwayman");
assert.equal(elements.get("battle-menu").hidden, true, "target selection hides the contextual Action Bar");
const highwaymanHudPosition = {
    x: highwaymanHud.style.getPropertyValue("--hud-screen-x"),
    y: highwaymanHud.style.getPropertyValue("--hud-screen-y")
};
assert.equal(pressKey("ArrowDown").handled, true, "vertical input uses formation-aware target movement");
assert.equal(Game.selectedTargetId, "highland-man");
assert.notDeepEqual(
    {
        x: highwaymanHud.style.getPropertyValue("--hud-screen-x"),
        y: highwaymanHud.style.getPropertyValue("--hud-screen-y")
    },
    highwaymanHudPosition,
    "target camera movement repositions the HUD from transformed character anchors"
);
assert.equal(pressKey("ArrowUp").handled, true);
assert.equal(Game.selectedTargetId, "highwayman");
assert.equal(Game.changeTarget(1), true);
assert.equal(Game.selectedTargetId, "highland-man");
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-x"), "-20%");
assert.equal(Game.cancelTargetSelection(), true);
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-scale"), "1.55");
assert.equal(elements.get("battle-menu").hidden, false, "cancelling target selection restores the anchored Action Bar");

assert.equal(Game.beginTargetSelection({ type: "attack", apCost: 1 }), true);
assert.equal(pressKey(" ").handled, true, "Space confirms the selected target");
assert.equal(queuedBattleTasks.length, 1);
assert.equal(queuedBattleTasks[0].delay, 825, "camera return plus responsive pause totals 825 ms");
assert.equal(elements.get("battle-menu").hidden, true, "Action Bar hides immediately after confirmation");
assert.equal(Game.targetSelection, null);
assert.equal(
    elements.get("formation-layer").children
        .find(child => child.dataset.formationSlot === "P1")
        .classList.contains("awaiting-command"),
    false,
    "active diamond clears on confirmation"
);
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-scale"), "1", "confirmed action resets camera");
assert.equal(pressKey("Escape").handled, false, "Escape cannot cancel a committed action");
queuedBattleTasks = [];

assert.equal(Game.beginPlayerAction(1), false, "rapid input cannot begin a second action");
const attackResult = Game.playerAttack(enemy);
assert.equal(attackResult.executed, true);
assert.equal(attackResult.rolledDamage, 15, "basic Attack rolls from Luke's configured 10-20 range");
assert.equal(attackResult.damage, 12, "rolled damage continues through enemy defense");
assert.equal(enemy.hp, 48, "final damage applies once to the selected enemy");
assert.equal(
    elements.get("battle-log").children.at(-1).textContent,
    "Luke attacks Highwayman for 12 damage.",
    "Battle Log reports actual final rolled damage"
);
assert.equal(player.ap, 1, "the current zero-cost basic Attack preserves AP before turn completion");
elements.get("turn-popup-text").textContent = "SIDE ANNOUNCEMENT SENTINEL";
assert.equal(Game.completePlayerAction(), true);
assert.equal(player.ap, 2, "normal action regenerates +1 AP");
assert.equal(player.hasActedThisTurn, true);
assert.equal(Game.getActivePlayer(), dummy, "successful action immediately advances character turn");
assert.equal(elements.get("battle-menu").parentNode, elements.get("battle-hud"));
assert.equal(elements.get("turn-popup-text").textContent, "SIDE ANNOUNCEMENT SENTINEL", "Luke to Dummy does not announce YOUR TURN again");
assert.equal(elements.get("battle-menu").dataset.anchorVisible, "true", "Dummy receives the same anchored Action Bar architecture");

assert.equal(Game.endPlayerTurn(), true);
assert.equal(elements.get("battle-menu").hidden, true);
assert.equal(queuedBattleTasks[0].delay, 300, "manual End Turn waits only for camera reset");
runNextBattleTask();
assert.equal(dummy.ap, 3, "manual End Turn with no action regenerates +2 AP up to cap");
assert.equal(Game.currentTurn, "enemy");
assert.equal(queuedBattleTasks[0].delay, 1450, "enemy action waits for the readable turn announcement");
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-scale"), "1");
queuedBattleTasks = [];

Game.enemySequencePhase = "queued";
assert.equal(Game.resolveEnemyTurn(), true);
const highwaymanSlot = elements.get("formation-layer").children.find(child => child.dataset.formationSlot === "E1");
const highwaymanSprite = findDescendant(highwaymanSlot, node => node.tagName === "IMG");
assert.match(highwaymanSprite.src, /attack\/highwayman-attack-v2-01\.png$/, "Highwayman begins its attack animation before damage");
queuedBattleTasks = [];
assert.equal(Game.applyEnemyAttack(), true);
queuedBattleTasks = [];
assert.equal(player.hp, player.maxHp, "a living party member not randomly selected takes no damage");
assert.equal(dummy.hp, dummy.maxHp - 10, "Highwayman randomly selects Dummy for this action");
elements.get("turn-popup-text").textContent = "ENEMY SIDE SENTINEL";
assert.equal(Game.advanceEnemySequence(), true);
assert.equal(elements.get("turn-popup-text").textContent, "ENEMY SIDE SENTINEL", "Highwayman to Highland Man does not announce ENEMY TURN again");
queuedBattleTasks = [];
assert.equal(Game.resolveEnemyTurn(), true);
const highlandSlot = elements.get("formation-layer").children.find(child => child.dataset.formationSlot === "E2");
const highlandSprite = findDescendant(highlandSlot, node => node.dataset?.placeholderFamily);
assert.equal(highlandSprite.dataset.placeholderFamily, "humanoid");
assert.equal(highlandSprite.dataset.animationState, "attack", "Highland Man toggles its CSS attack state");
queuedBattleTasks = [];
assert.equal(Game.applyEnemyAttack(), true);
queuedBattleTasks = [];
assert.equal(dummy.hp, dummy.maxHp - 21, "Highland Man resolves its independently selected target");
assert.equal(Game.advanceEnemySequence(), true);
assert.equal(Game.currentTurn, "player");
assert.deepEqual(party.map(member => member.ap), [2, 3], "enemy phase does not overwrite regenerated AP");
assert.equal(player.hasActedThisTurn, false, "turn action state resets on the next turn");

assert.equal(Game.beginTargetSelection({ type: "skill", skillId: "fireball", apCost: 2 }), true, "free Attack lets Luke retain enough AP for Fireball next round");
assert.equal(Game.cancelTargetSelection(), true);
assert.equal(Game.getActivePlayer(), player);
assert.equal(Game.canAcceptPlayerInput(), true);

assert.equal(Game.playerGuard(), true);
assert.equal(queuedBattleTasks[0].delay, 825);
runNextBattleTask();
await new Promise(resolve => setTimeout(resolve, 500));
assert.equal(player.isGuarding, true);
assert.equal(player.ap, 3, "Guard receives +1 regeneration up to the AP cap");
assert.equal(Game.getActivePlayer(), dummy, "Guard ends the acting character's turn");
queuedBattleTasks = [];

Game.start({ skipIntro: true });
assert.deepEqual(party.map(member => member.ap), [1, 1]);
player.ap = 2;
assert.equal(Game.beginPlayerAction(1), true);
const skillResult = Game.useSkill("ice-pike", highlandMan);
assert.equal(skillResult.executed, true);
assert.equal(highlandMan.hp, 57, "skill resolves against the selected independent target");
assert.equal(enemy.hp, 60, "skill does not damage an unselected enemy");
Game.completePlayerAction();
assert.equal(player.ap, 2, "1 AP Skill followed by +1 regeneration preserves 2 AP");
assert.equal(Game.getActivePlayer(), dummy, "Skill ends the acting character's turn");

Game.start({ skipIntro: true });
player.ap = 2;
assert.equal(Game.beginPlayerAction(1), true);
const poisonResult = Game.useSkill("poison", highlandMan);
assert.equal(poisonResult.executed, true);
let currentHighlandHud = elements.get("enemy-hud-layer").children.find(child => child.dataset.entityId === "highland-man");
let poisonIcon = findDescendant(currentHighlandHud, node => node.dataset.status === "poison");
assert.ok(poisonIcon, "Poison renders on the affected enemy Status Bar");
assert.match(poisonIcon.getAttribute("aria-label"), /5 damage \/ turn/);
assert.match(poisonIcon.getAttribute("aria-label"), /3 turns left/);
poisonIcon.listeners.get("mouseenter")[0]();
assert.equal(elements.get("status-tooltip").hidden, false, "hover opens the screen-space status tooltip");
assert.equal(elements.get("status-tooltip-title").textContent, "Poison");
assert.deepEqual(
    elements.get("status-tooltip-lines").children.slice(0, 2).map(line => line.textContent),
    ["5 damage / turn", "3 turns left"]
);
poisonIcon.listeners.get("mouseleave")[0]();
assert.equal(elements.get("status-tooltip").hidden, true);
Game.completePlayerAction();
Game.currentTurn = "enemy";
Game.enemyTurnPending = true;
Game.enemySequencePhase = "recovery";
assert.equal(Game.completeEnemyTurn(), true, "an enemy-side completion advances Poison runtime state");
currentHighlandHud = elements.get("enemy-hud-layer").children.find(child => child.dataset.entityId === "highland-man");
poisonIcon = findDescendant(currentHighlandHud, node => node.dataset.status === "poison");
assert.match(poisonIcon.getAttribute("aria-label"), /2 turns left/, "tooltip source reflects the updated remaining duration");

player.statusEffects = Array.from({ length: 8 }, (_, index) => ({
    id: `player-status-${index + 1}`,
    name: `Player Status ${index + 1}`,
    remainingTurns: index + 1
}));
enemy.statusEffects = Array.from({ length: 8 }, (_, index) => ({
    id: `enemy-status-${index + 1}`,
    name: `Enemy Status ${index + 1}`,
    remainingTurns: index + 1
}));
Game.updateUI();
const currentLukeHud = elements.get("party-hud-layer").children.find(child => child.dataset.entityId === "luke");
const currentHighwaymanHud = elements.get("enemy-hud-layer").children.find(child => child.dataset.entityId === "highwayman");
assert.equal(currentLukeHud.children.find(child => child.classList.contains("status-list")).children.length, 8, "Party HUD supports eight external status icons");
assert.equal(currentHighwaymanHud.children.find(child => child.classList.contains("status-list")).children.length, 8, "Enemy HUD supports eight external status icons");
player.statusEffects = [];
enemy.statusEffects = [];

Game.start({ skipIntro: true });
player.hp = 80;
const potion = {
    id: "test-potion",
    name: "Test Potion",
    battleUsable: true,
    quantity: 1,
    apCost: 0,
    use: ({ player: itemUser }) => {
        itemUser.hp = Math.min(itemUser.maxHp, itemUser.hp + 10);
        return true;
    }
};
player.battleItems.push(potion);
assert.equal(Game.useItem("test-potion"), true);
assert.equal(queuedBattleTasks[0].delay, 825);
runNextBattleTask();
assert.equal(player.hp, 90, "Item resolves before completing the turn");
assert.equal(potion.quantity, 0, "successful Item use consumes exactly one item");
assert.equal(player.ap, 2, "zero-cost Item receives normal +1 turn regeneration");
assert.equal(Game.getActivePlayer(), dummy, "Item ends the acting character's turn");
player.battleItems = [];

Game.start({ skipIntro: true });
player.criticalChance = 1;
let combatRolls = [0.75, 0.5];
Game.randomSource = () => combatRolls.shift() ?? 0.5;
assert.equal(Game.beginPlayerAction(1), true);
const criticalResult = Game.playerAttack(enemy);
assert.equal(criticalResult.hitType, "critical");
assert.equal(criticalResult.rolledDamage, 15, "Critical retains the underlying RNG damage roll");
assert.equal(criticalResult.damage, 22, "Critical deals 150% after bypassing armor");
assert.match(elements.get("battle-log").children.at(-1).textContent, /22 damage\. CRITICAL!$/);

Game.start({ skipIntro: true });
player.criticalChance = 1;
combatRolls = [0.25, 0.5];
Game.randomSource = () => combatRolls.shift() ?? 0.5;
assert.equal(Game.beginPlayerAction(1), true);
const fatalResult = Game.playerAttack(enemy);
assert.equal(fatalResult.hitType, "fatal");
assert.equal(fatalResult.damage, 30, "Fatal deals 200% after bypassing armor");
assert.match(elements.get("battle-log").children.at(-1).textContent, /30 damage\. FATAL!$/);
delete player.criticalChance;
Game.randomSource = () => 0.5;

Game.start({ skipIntro: true });
const lukeSlot = elements.get("formation-layer").children.find(child => child.dataset.formationSlot === "P1");
const lukeSprite = findDescendant(lukeSlot, node => node.dataset?.spriteSheet === "true");
assert.ok(lukeSprite, "Luke uses the spritesheet renderer");
lukeSprite.src = "./assets/images/character/player/luke/punch/luke-puch.png";
assert.equal(Game.beginTargetSelection({ type: "attack", apCost: 1 }), true);
assert.equal(Game.confirmTargetSelection(), true);
assert.equal(queuedBattleTasks.length, 1);
assert.equal(Game.finishBattle("victory"), true);
assert.equal(queuedBattleTasks.length, 0, "Victory cancels delayed action execution");
assert.equal(queuedPostBattleTasks.length, 1);
assert.equal(queuedPostBattleTasks[0].delay, 1850);
assert.equal(Game.targetSelection, null);
assert.equal(elements.get("battle-menu").hidden, true);
assert.equal(elements.get("battle-screen").dataset.inputMode, "locked");
assert.equal(elements.get("battle-camera").style.getPropertyValue("--camera-scale"), "1");
assert.match(lukeSprite._sheetImage.src, /idle\/luke-idle\.png$/, "Victory returns surviving players to Idle");
assert.equal(elements.get("turn-popup-text").textContent, "VICTORY!");
assert.equal(elements.get("turn-popup").style.getPropertyValue("--announcement-duration"), "1850ms");
assert.equal(elements.get("turn-popup").classList.contains("result-announcement"), true);
const apAtVictory = player.ap;
assert.equal(Game.completePlayerAction(), false);
assert.equal(player.ap, apAtVictory, "post-victory completion cannot regenerate AP");
assert.equal(Game.beginTargetSelection({ type: "attack", apCost: 1 }), false);
assert.equal(runNextPostBattleTask(), 1850);
assert.equal(Game.battleEndPhase, "summary");
assert.equal(elements.get("battle-summary").hidden, false);
assert.equal(elements.get("battle-screen").dataset.inputMode, "summary");
assert.equal(pressKey(" ").handled, true, "Space confirms Battle Summary NEXT");
assert.equal(Game.battleEndPhase, "complete");
assert.equal(elements.get("battle-summary").hidden, true);

Game.start({ skipIntro: true });
for (const member of party) member.hp = 0;
assert.equal(Game.finishBattle("defeat"), true);
assert.equal(Game.canAcceptPlayerInput(), false);
assert.equal(elements.get("battle-menu").hidden, true);
assert.equal(elements.get("turn-popup-text").textContent, "DEFEAT");

Game.start({ skipIntro: true, enablePrepare: true });
assert.equal(Game.prepareTurnActive, true, "eligible encounters begin with a non-damaging Prepare Turn");
assert.equal(Game.battlePhase, "prepare");
assert.equal(Object.getOwnPropertyDescriptor(Game, "prepareTurnActive").set, undefined, "Prepare compatibility state is read-only");
const prepareTurnCounter = Game.turnCounter;
assert.equal(Game.completePrepareTurn("focus"), true);
assert.equal(Game.prepareTurnActive, false);
assert.equal(Game.battlePhase, "player");
assert.equal(Game.turnCounter, prepareTurnCounter, "initial Prepare completion does not advance the normal round");
assert.deepEqual(party.map(member => member.ap), [2, 2], "Focus is free and grants the party 1 AP before normal commands");
assert.equal(Game.finishBattle("defeat"), true);

Game.start({ skipIntro: true });
assert.equal(Game.battlePhase, "player", "battles without explicit Prepare configuration start in Player");
assert.equal(Game.requestPreparePhase({ reason: "phase change" }), false, "Prepare reopening requires explicit permission");
const reopenTurnCounter = Game.turnCounter;
assert.equal(Game.requestPreparePhase({ reason: "phase change", allowReopen: true }), true);
assert.equal(Game.battlePhase, "prepare");
assert.equal(Game.completePrepareTurn("skip"), true);
assert.equal(Game.battlePhase, "player");
assert.equal(Game.turnCounter, reopenTurnCounter, "reopened Prepare resumes without advancing the normal round");
assert.equal(Game.finishBattle("defeat"), true);

// Class commands use the live scene's target selection, AP and Prepare lifecycle.
const { ClassDebug } = await import("../src/core/ClassDebug.js");
const { createWeaponAttackProfile } = await import("../src/data/weapons.js");
Game.start({skipIntro:true,enablePrepare:true});
ClassDebug.unlockAll(player);
player.classState.currentClass="mercenary";
ClassDebug.setSkillTier(player,"quick-reload",3);
player.equipment.weapon="soldier-crossbow";
player.basicAttack=createWeaponAttackProfile(player.equipment);
player.classCombat.loaded=false;
assert.equal(Game.executePrepareAction(`reload:${player.id}`),true);
assert.equal(Game.prepareTurnActive,true,"free mastery III reload does not consume Prepare");
assert.equal(player.classCombat.loaded,true);
assert.equal(Game.completePrepareTurn("skip"),true);
queuedBattleTasks=[];
const classCommand=module.commandCategoryDefinitions.find(category=>category.id==="class").getCommands().find(command=>command.id.startsWith("class:crossbow-shot:"));
assert.equal(classCommand.isEnabled(),true);
assert.equal(classCommand.execute(null),true);
assert.equal(Game.targetSelection.type,"class-skill");
const targetHp=Game.getSelectedTarget().hp;
assert.equal(Game.confirmTargetSelection(),true);
runNextBattleTask();
assert.ok(enemy.hp<targetHp);
assert.equal(player.classCombat.loaded,false);
assert.equal(Game.getActivePlayer(),dummy,"a class action follows normal party turn order");
assert.equal(Game.masteryDisciplinesUsed.get(player.id).has("technique:crossbow-shot"),true);
Game.finishBattle("defeat");
assert.equal(player.classCombat,undefined,"temporary class state clears at battle end");

// A Wizard's prepared legacy spell bypasses its normal AP requirement once.
Game.start({skipIntro:true,enablePrepare:true});
player.classState.currentClass="wizard";
assert.equal(Game.executePrepareAction(`prepare-spell:${player.id}:ice-pike`),true);
player.ap=0;
assert.equal(Game.beginPlayerAction(0),true);
assert.equal(Game.useSkill("ice-pike",enemy).executed,true);
assert.equal(player.ap,0);
assert.equal(player.classCombat.preparedSpell,undefined);
Game.finishBattle("defeat");
console.log("Battle state integration: original mechanics, class targeting, mastery, free Prepare reload, cleanup and prepared legacy spells passed.");
